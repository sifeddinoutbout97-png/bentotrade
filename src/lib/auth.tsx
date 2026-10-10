/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  role: string | null;
  full_name: string | null;
  display_name: string | null;
  status?: string | null;
}

export type AppUser = User & { displayName?: string };

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  impersonatingUserId: string | null;
  initiateGhostMode: (id: string) => void;
  exitGhostMode: () => void;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  const effectiveEmail = user?.email;
  const isAdmin = profile?.role === 'admin' || effectiveEmail === 'sifeddinoutbout97@gmail.com';

  const initiateGhostMode = (targetId: string) => {
    try {
      localStorage.setItem('bt_ghost_mode_id', targetId);
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
    setImpersonatingUserId(targetId);
    toast.info("GHOST_PROTOCOL_ACTIVE", { 
      icon: "👻",
      description: "Secure Impersonation Mode is now live."
    });
  };

  const exitGhostMode = () => {
    try {
      localStorage.removeItem('bt_ghost_mode_id');
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
    setImpersonatingUserId(null);
    toast.success("Standard session restored.");
  };

  // Google Sign-In strictly using Supabase OAuth
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Supabase Google Sign-in error:', error);
      toast.error(error.message || 'Google sign-in failed.');
      throw error;
    }
  };

  const syncUserAndProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    const fallbackProfile: Profile = {
      id: currentUser.id,
      role: currentUser.email === 'sifeddinoutbout97@gmail.com' ? 'admin' : 'trader',
      full_name: 
        currentUser.user_metadata?.full_name || 
        currentUser.user_metadata?.name || 
        currentUser.email?.split('@')[0] || 
        'Trader',
      display_name: 
        currentUser.user_metadata?.full_name || 
        currentUser.user_metadata?.name || 
        currentUser.email?.split('@')[0] || 
        'Trader',
      status: 'active'
    };

    const appUser: AppUser = {
      ...currentUser,
      displayName: fallbackProfile.display_name || fallbackProfile.full_name || 'Trader'
    };
    setUser(appUser);

    try {
      // Bounded profile fetch with timeout so slow/unreachable DB never stalls the app
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Profile query timeout') }), 1500)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(fallbackProfile);
      }
    } catch (e) {
      console.warn('Error reading Supabase profile:', e);
      setProfile(fallbackProfile);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Restore impersonation from localStorage if exists
    try {
      const storedImpersonation = localStorage.getItem('bt_ghost_mode_id');
      if (storedImpersonation && isMounted) {
        setImpersonatingUserId(storedImpersonation);
      }
      localStorage.removeItem('bt_guest_session');
    } catch (e) {
      console.warn('localStorage error:', e);
    }

    const checkSession = async () => {
      try {
        // Enforce maximum 2.5s timeout on initial getSession to prevent any infinite stall
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: Session | null }; error: any }>((resolve) =>
          setTimeout(() => {
            resolve({ data: { session: null }, error: new Error('Session fetch timed out') });
          }, 2500)
        );

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
        if (error) {
          console.warn('Supabase initial session check note:', error.message || error);
        }

        const initialSession = data?.session || null;
        if (isMounted) {
          setSession(initialSession);
          if (initialSession?.user) {
            await syncUserAndProfile(initialSession.user);
          } else {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.warn('Supabase session initialization caught error:', err);
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    // 2. Real-time Supabase Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      try {
        if (newSession?.user) {
          await syncUserAndProfile(newSession.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.warn('Error syncing profile on auth state change:', e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      localStorage.removeItem('bt_ghost_mode_id');
    } catch (e) {
      console.warn('localStorage error:', e);
    }
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.warn('Supabase signOut error:', e?.message);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
    toast.success("Signed out successfully.");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      isLoading: loading,
      isAdmin, 
      impersonatingUserId, 
      initiateGhostMode, 
      exitGhostMode, 
      signInWithGoogle, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
