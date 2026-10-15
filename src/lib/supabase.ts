/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yaqigszrmgorhxmvdvif.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yBPJdgdVo6dXBbIz4dZTrA_8JgBJPg5';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) missing; fallback active.'
  );
}

// In-process lock implementation to prevent Web Locks API (navigator.locks) contention and lock-stealing errors
// in iframes and concurrent component lifecycle requests
const inProcessLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return await fn();
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: inProcessLock,
  },
});

export const getSupabase = (): SupabaseClient => supabase;

/**
 * Detects whether an error from Supabase / PostgREST is due to an expired JWT.
 */
export const isJwtExpiredError = (err: any): boolean => {
  if (!err) return false;
  const code = err.code || err?.error?.code || err?.status;
  const message = err.message || err?.error?.message || err?.error_description || (typeof err === 'string' ? err : '');
  const stringified = typeof err === 'object' ? JSON.stringify(err) : '';
  return code === 'PGRST303' || 
         /jwt expired/i.test(message) || 
         /invalid refresh token/i.test(message) ||
         /refresh token not found/i.test(message) ||
         /PGRST303/i.test(stringified) ||
         /jwt expired/i.test(stringified) ||
         /invalid refresh token/i.test(stringified);
};

export const clearStaleAuthStorage = async () => {
  try {
    await supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('Error clearing stale auth storage:', e);
  }
};

let refreshPromise: Promise<boolean> | null = null;

/**
 * Safely refreshes the Supabase session, deduplicating concurrent calls.
 * Returns true if refresh succeeded with a valid session, false otherwise.
 */
export const safeRefreshSession = async (): Promise<boolean> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        const msg = error?.message || '';
        if (/refresh token/i.test(msg) || /invalid/i.test(msg) || error?.status === 400) {
          console.warn('Invalid refresh token detected. Clearing stale auth session.');
          await clearStaleAuthStorage();
        } else {
          console.warn('Session refresh note:', msg || 'No active session to refresh');
        }
        return false;
      }
      return true;
    } catch (e: any) {
      console.warn('Exception during session refresh:', e?.message || e);
      await clearStaleAuthStorage();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Proactively verifies if the current session token is still valid.
 * If expired or expiring within 15 seconds, refreshes it before queries fire.
 */
export const ensureFreshSession = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const expiresAt = session.expires_at;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // If token is expired or expires in under 15 seconds, refresh now
    if (expiresAt && expiresAt - nowInSeconds <= 15) {
      const success = await safeRefreshSession();
      if (success) {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        return freshSession?.user?.id || null;
      }
    }
    return session.user.id;
  } catch (e) {
    console.warn('Error verifying session freshness:', e);
    return null;
  }
};

/**
 * Wraps a Supabase operation with automatic JWT expiration retry.
 * If a PGRST303 / "JWT expired" error occurs, refreshes the session and retries.
 */
export const withAuthRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  // Proactively check freshness before executing
  await ensureFreshSession().catch(() => {});

  try {
    return await operation();
  } catch (err: any) {
    if (isJwtExpiredError(err)) {
      console.warn('JWT expired detected (PGRST303). Refreshing Supabase session and retrying...');
      const refreshed = await safeRefreshSession();
      if (refreshed) {
        try {
          return await operation();
        } catch (retryErr: any) {
          if (isJwtExpiredError(retryErr)) {
            console.warn('Session refresh did not resolve expired JWT. Clearing stale auth.');
            await supabase.auth.signOut().catch(() => {});
            throw new Error('Your session has expired. Please sign in again.');
          }
          throw retryErr;
        }
      } else {
        console.warn('Unable to refresh expired session. Clearing stale auth.');
        await supabase.auth.signOut().catch(() => {});
        throw new Error('Your session has expired. Please sign in again.');
      }
    }
    throw err;
  }
};
