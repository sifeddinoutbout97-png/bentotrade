/**
 * BentoTrade V6 - Serverless Broker Blotter Synchronization
 * Endpoint: /api/broker/sync
 * Self-contained file with zero relative imports to prevent Vercel ERR_MODULE_NOT_FOUND.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const METAAPI_TOKEN = (process.env.METAAPI_TOKEN || process.env.VITE_METAAPI_TOKEN || '').trim();
const SUPABASE_URL = (
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  'https://yaqigszrmgorhxmvdvif.supabase.co'
).trim();

const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_yBPJdgdVo6dXBbIz4dZTrA_8JgBJPg5'
).trim();

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const provisioningBaseUrl = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const STANDARD_REGIONS = ['new-york', 'london', 'vint-hill', 'singapore', 'frankfurt'];

function normalizeServerName(server: string): string {
  if (!server) return 'FundedNext-Server 3';
  const trimmed = server.trim();
  const match = trimmed.match(/^FundedNext-Server\s*(\d+)$/i);
  if (match) {
    return `FundedNext-Server ${match[1]}`;
  }
  return trimmed;
}

async function safeFetch(url: string, options: any, stepName: string) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err: any) {
    const causeMsg = err.cause?.message || err.cause?.code || JSON.stringify(err.cause) || err.message;
    throw new Error(`[${stepName}] fetch failed for URL "${url}": ${err.message} | cause: ${causeMsg}`);
  }
}

async function getOrCreateAndDeployAccount(login: string, server: string, platform: string, password: string | undefined, token: string) {
  const headers = {
    'auth-token': token,
    'Content-Type': 'application/json',
  };

  const loginStr = String(login);
  const normalizedServer = normalizeServerName(server);

  const accountsRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, { headers }, 'MetaApi-FetchAccounts');
  if (!accountsRes.ok) {
    const errText = await accountsRes.text();
    throw new Error(`Failed to fetch MetaApi accounts (${accountsRes.status}): ${errText}`);
  }

  const accountsData = await accountsRes.json();
  const accountList = Array.isArray(accountsData) ? accountsData : (accountsData.items || []);

  const matchingAccounts = accountList.filter((a: any) => String(a.login) === loginStr);
  let account = matchingAccounts.find(
    (a: any) => a.server && a.server.toLowerCase() === normalizedServer.toLowerCase() && a.state === 'DEPLOYED' && a.connectionStatus === 'CONNECTED'
  ) || matchingAccounts.find(
    (a: any) => a.server && a.server.toLowerCase() === normalizedServer.toLowerCase()
  ) || matchingAccounts.find(
    (a: any) => a.state === 'DEPLOYED' && a.connectionStatus === 'CONNECTED'
  ) || matchingAccounts[0];

  let metaApiAccountId = account?._id || account?.id;

  if (!account || !metaApiAccountId) {
    if (!password || !password.trim()) {
      throw new Error(`MetaApi account for login ${loginStr} on ${normalizedServer} not found. Please click "Disconnect Uplink" and enter your MT5 Investor/Master password so MetaApi can authenticate.`);
    }

    console.log(`[MetaApi] Account ${loginStr} on ${normalizedServer} not found. Creating cloud account...`);
    let createPayload: any = {
      name: `BentoTrade-${loginStr}`,
      type: 'cloud',
      login: loginStr,
      password: password,
      server: normalizedServer,
      platform: platform === 'mt4' ? 'mt4' : 'mt5',
      magic: 1000,
    };

    let createHeaders = {
      ...headers,
      'transaction-id': crypto.randomUUID().replace(/-/g, ''),
    };

    let createRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(createPayload),
    }, 'MetaApi-CreateAccount');

    if (!createRes.ok) {
      const errText = await createRes.text();
      let errData: any = {};
      try { errData = JSON.parse(errText); } catch {}

      if (createRes.status === 400 && errData?.code === 'E_SRV_NOT_FOUND' && errData?.details?.serversByBrokers) {
        const suggestedServers = errData.details.serversByBrokers;
        const bestMatch = suggestedServers.find((s: string) => s.toLowerCase().includes(normalizedServer.toLowerCase().replace(/\s+/g, ''))) || suggestedServers[0];
        if (bestMatch) {
          console.log(`[MetaApi] Retrying account creation with suggested server: "${bestMatch}"`);
          createPayload.server = bestMatch;
          createHeaders['transaction-id'] = crypto.randomUUID().replace(/-/g, '');
          createRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, {
            method: 'POST',
            headers: createHeaders,
            body: JSON.stringify(createPayload),
          }, 'MetaApi-CreateAccountRetry');
        }
      }

      if (!createRes.ok) {
        const finalErrText = await createRes.text();
        throw new Error(`Failed to create MetaApi account for login ${loginStr} on server ${normalizedServer} (${createRes.status}): ${finalErrText}`);
      }
    }

    const createdData = await createRes.json();
    metaApiAccountId = createdData._id || createdData.id;
  } else if (password && password.trim().length > 0) {
    console.log(`[MetaApi] Updating account ${metaApiAccountId} password/server on MetaApi...`);
    await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        password: password,
        server: normalizedServer,
        name: account.name || `BentoTrade ${loginStr}`,
      }),
    }, 'MetaApi-UpdateAccount').catch(() => {});
  }

  let fullAccount: any = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const detailRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, { headers }, `MetaApi-GetAccountDetail-${attempt}`);
    if (detailRes.ok) {
      fullAccount = await detailRes.json();
      if (fullAccount.state !== 'DEPLOYED') {
        await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}/deploy`, { method: 'POST', headers }, 'MetaApi-Deploy').catch(() => {});
      }
      if (fullAccount.connectionStatus === 'CONNECTED') {
        break;
      }
    }
    if (attempt < 6) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!fullAccount) {
    const detailRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, { headers }, 'MetaApi-GetAccountDetail-Final');
    if (detailRes.ok) {
      fullAccount = await detailRes.json();
    } else {
      throw new Error(`Failed to fetch full account metadata for account ID ${metaApiAccountId}`);
    }
  }

  const region = fullAccount.region || 'new-york';
  return { metaApiAccountId, region, fullAccount };
}

async function fetchAccountInformation(metaApiAccountId: string, primaryRegion: string, fullAccount: any, headers: any) {
  const primaryBaseUrl = `https://mt-client-api-v1.${primaryRegion}.agiliumtrade.ai`;
  let lastStatus = 0;
  let lastErrText = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `${primaryBaseUrl}/users/current/accounts/${metaApiAccountId}/account-information`;
      const res = await safeFetch(url, { headers }, `MetaApi-AccountInfo-${primaryRegion}-attempt${attempt}`);
      if (res.ok) {
        return await res.json();
      }
      lastStatus = res.status;
      lastErrText = await res.text();

      // Check if it's a regional 404 that specifically mentions matching account region
      if (res.status === 404 && lastErrText.includes('matches your account region')) {
        const fallbackRegions = STANDARD_REGIONS.filter(r => r !== primaryRegion);
        for (const fallbackReg of fallbackRegions) {
          try {
            const fallbackUrl = `https://mt-client-api-v1.${fallbackReg}.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/account-information`;
            const fbRes = await fetch(fallbackUrl, { headers });
            if (fbRes.ok) {
              return await fbRes.json();
            }
          } catch {
            // Ignore DNS/network errors on fallback region
          }
        }
      }

      if ([400, 504].includes(res.status) || lastErrText.includes('E_NOT_SYNCHRONIZED')) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
    } catch (err: any) {
      lastErrText = err?.message || String(err);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    }
  }

  throw new Error(`Account ${fullAccount.login || 'Unknown'} (ID: ${metaApiAccountId}, region: ${primaryRegion}) state=${fullAccount.state}, connectionStatus=${fullAccount.connectionStatus}. Details (${lastStatus}): ${lastErrText}`);
}

export interface StandardTradeRecord {
  user_id: string;
  ticker: string;
  market_type: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  position_size: number;
  pnl: number;
  fees: number;
  trade_date: string;
  status: 'win' | 'loss' | 'breakeven';
  notes: string;
  tags: string[];
  created_at?: string;
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET' || req.method === 'POST') {
      const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : (req.query || {});
      const login = body.login || body.accountId || '35211973';
      const server = body.server || 'FundedNext-Server 3';
      const platform = body.platform || 'mt5';
      const password = body.password;
      const userId = body.userId;

      if (!METAAPI_TOKEN) {
        throw new Error('METAAPI_TOKEN environment variable is not configured. Please provide a valid MetaApi token.');
      }

      const headers = {
        'auth-token': METAAPI_TOKEN,
        'Content-Type': 'application/json',
      };

      const { metaApiAccountId, region, fullAccount } = await getOrCreateAndDeployAccount(
        login,
        server,
        platform,
        password,
        METAAPI_TOKEN
      );

      const accountInfo = await fetchAccountInformation(metaApiAccountId, region, fullAccount, headers);
      const balance = Number(accountInfo.balance) || 0;
      const equity = Number(accountInfo.equity) || balance;
      const currency = accountInfo.currency || 'USD';

      // Fetch history deals
      const startTime = new Date(Date.now() - 90 * 86400000).toISOString();
      const endTime = new Date().toISOString();

      let rawDeals: any[] = [];
      const primaryBaseUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
      const dealsUrl = `${primaryBaseUrl}/users/current/accounts/${metaApiAccountId}/history-deals/time/${startTime}/${endTime}`;
      const dealsRes = await safeFetch(dealsUrl, { headers }, `MetaApi-HistoryDeals-${region}`).catch(() => null);

      if (dealsRes && dealsRes.ok) {
        rawDeals = await dealsRes.json().catch(() => []);
      } else if (dealsRes && dealsRes.status === 404) {
        const dealsErrText = await dealsRes.text().catch(() => '');
        if (dealsErrText.includes('matches your account region')) {
          const fallbackRegions = STANDARD_REGIONS.filter(r => r !== region);
          for (const fallbackReg of fallbackRegions) {
            try {
              const fbUrl = `https://mt-client-api-v1.${fallbackReg}.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/history-deals/time/${startTime}/${endTime}`;
              const fbRes = await fetch(fbUrl, { headers });
              if (fbRes.ok) {
                rawDeals = await fbRes.json().catch(() => []);
                break;
              }
            } catch {
              // ignore DNS / network error on fallback
            }
          }
        }
      }

      const filteredDeals = (Array.isArray(rawDeals) ? rawDeals : []).filter((d: any) => {
        if (d.type === 'DEAL_TYPE_BALANCE' || d.type === 'DEAL_TYPE_CREDIT') return false;
        if (d.entry && d.entry !== 'DEAL_ENTRY_OUT' && d.entry !== 'DEAL_ENTRY_INOUT') return false;
        return d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL';
      });

      const formattedTrades: StandardTradeRecord[] = filteredDeals.map((d: any) => ({
        user_id: userId || 'anonymous',
        ticker: d.symbol || 'EURUSD',
        market_type: (d.symbol?.toUpperCase().includes('USD') || d.symbol?.toUpperCase().includes('EUR')) ? 'forex' : 'futures',
        direction: (d.type === 'DEAL_TYPE_BUY' ? 'long' : 'short') as 'long' | 'short',
        entry_price: d.price || 1.0,
        exit_price: d.price || 1.0,
        position_size: d.volume || 1.0,
        pnl: Number(d.profit) || 0,
        fees: Number(d.commission || 0) + Number(d.fee || 0),
        trade_date: d.time ? new Date(d.time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        status: ((Number(d.profit) || 0) > 0 ? 'win' : (Number(d.profit) || 0) < 0 ? 'loss' : 'breakeven') as 'win' | 'loss' | 'breakeven',
        notes: `MetaApi Live Sync: Deal #${d.id || 'N/A'} on ${d.symbol || 'Unknown'}.`,
        tags: ['#MT5_Sync', '#MetaApi', fullAccount.server || server],
      }));

      const totalNetPnl = formattedTrades.reduce((sum, t) => sum + t.pnl, 0);

      if (userId && userId !== 'anonymous' && formattedTrades.length > 0) {
        const payloadWithUser = formattedTrades.map(t => ({
          ...t,
          user_id: userId,
          created_at: new Date().toISOString(),
        }));

        const { error: dbErr } = await supabaseAdmin.from('trades').insert(payloadWithUser);
        if (dbErr) {
          throw new Error(`Supabase trades table upsert error: ${dbErr.message}`);
        }
        try {
          await supabaseAdmin.from('journal_logs').insert(payloadWithUser);
        } catch {
          // secondary log non-fatal
        }
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' EST';

      return res.status(200).json({
        success: true,
        balance,
        equity,
        currency,
        count: formattedTrades.length,
        totalPnl: totalNetPnl,
        tradesSynced: formattedTrades.length,
        netPnl: totalNetPnl,
        trades: formattedTrades,
        syncedAt: `Just now (${timeStr})`,
        source: 'metaapi-regional-rest',
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API /api/broker/sync Error]:', error);
    const causeStr = error?.cause ? String(error.cause?.message || error.cause?.code || error.cause) : undefined;
    return res.status(500).json({
      error: error?.message || 'Internal Server Error',
      cause: causeStr,
      stack: error?.stack || null,
    });
  }
}
