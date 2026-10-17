/**
 * BentoTrade V6 - Serverless Broker Blotter Synchronization
 * Endpoint: /api/broker/sync
 * Calls MetaApi Provisioning & Regional Client APIs, normalizes servers, auto-recovers E_SRV_NOT_FOUND, adds transaction-id, and polls account info.
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

async function fetchAccountInformationWithRetry(regionalBaseUrl: string, accountId: string, headers: any): Promise<any> {
  const url = `${regionalBaseUrl}/users/current/accounts/${accountId}/account-information`;
  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await safeFetch(url, { headers }, `MetaApi-AccountInformation-Attempt${attempt}`);
      if (res.ok) {
        return await res.json();
      }
      const errText = await res.text();
      if ([404, 400, 504].includes(res.status) || errText.includes('E_NOT_SYNCHRONIZED') || errText.includes('NotFoundError')) {
        console.warn(`[MetaApi] Account ${accountId} not yet synchronized (attempt ${attempt}/3). Waiting 2.5s...`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }
      }
      throw new Error(`Failed to fetch account information (${res.status}): ${errText}`);
    } catch (err: any) {
      lastError = err;
      if (attempt < 3) {
        console.warn(`[MetaApi] Retry ${attempt}/3 for account information after error: ${err.message}`);
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
    }
  }
  throw lastError || new Error(`Failed to fetch account information for ${accountId} after 3 attempts.`);
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
      const rawServer = body.server || 'FundedNext-Server 3';
      const server = normalizeServerName(rawServer);
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

      const provisioningBaseUrl = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
      const accountsUrl = `${provisioningBaseUrl}/users/current/accounts`;
      const accountsRes = await safeFetch(accountsUrl, { headers }, 'MetaApi-FetchAccounts');

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new Error(`Failed to fetch MetaApi accounts (${accountsRes.status}): ${errText}`);
      }

      const accounts = await accountsRes.json();
      const loginStr = String(login);
      let account = (Array.isArray(accounts) ? accounts : []).find(
        (a: any) => String(a.login) === loginStr && (!server || a.server?.toLowerCase() === server.toLowerCase())
      ) || (Array.isArray(accounts) ? accounts.find((a: any) => String(a.login) === loginStr) : null);

      if (!account) {
        console.log(`[MetaApi Sync] Account ${loginStr} on ${server} not found. Auto-provisioning cloud account...`);
        let createPayload: any = {
          name: `BentoTrade-${loginStr}`,
          type: 'cloud',
          login: loginStr,
          password: password || 'MetaVault#2026!',
          server: server,
          platform: platform === 'mt4' ? 'mt4' : 'mt5',
          magic: 1000,
        };

        let createHeaders = {
          ...headers,
          'transaction-id': crypto.randomUUID().replace(/-/g, ''),
        };

        let createRes = await safeFetch(accountsUrl, {
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
            console.warn(`[MetaApi] E_SRV_NOT_FOUND for server "${server}". Suggested servers:`, suggestedServers);
            const bestMatch = suggestedServers.find((s: string) => s.toLowerCase().includes(server.toLowerCase().replace(/\s+/g, ''))) || suggestedServers[0];
            if (bestMatch) {
              console.log(`[MetaApi] Retrying account creation with suggested server: "${bestMatch}"`);
              createPayload.server = bestMatch;
              createHeaders['transaction-id'] = crypto.randomUUID().replace(/-/g, '');
              createRes = await safeFetch(accountsUrl, {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify(createPayload),
              }, 'MetaApi-CreateAccountRetry');
            }
          }

          if (!createRes.ok) {
            const finalErrText = await createRes.text();
            if (Array.isArray(accounts) && accounts.length > 0) {
              account = accounts[0];
            } else {
              throw new Error(`Failed to create MetaApi account for login ${loginStr} on server ${server} (${createRes.status}): ${finalErrText}`);
            }
          } else {
            account = await createRes.json();
          }
        } else {
          account = await createRes.json();
        }
      }

      const accountId = account._id || account.id || account.accountId;
      const region = account.region || 'new-york';
      const regionalBaseUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

      if (account.state !== 'DEPLOYED') {
        const deployUrl = `${provisioningBaseUrl}/users/current/accounts/${accountId}/deploy`;
        const deployRes = await safeFetch(deployUrl, { method: 'POST', headers }, 'MetaApi-DeployAccount').catch(() => null);
        if (deployRes && !deployRes.ok) {
          const errText = await deployRes.text().catch(() => '');
          console.warn(`[MetaApi Sync] Deploy notice for ${accountId}: ${errText}`);
        }
      }

      const accountInfo = await fetchAccountInformationWithRetry(regionalBaseUrl, accountId, headers);
      const balance = Number(accountInfo.balance) || 0;
      const equity = Number(accountInfo.equity) || balance;
      const currency = accountInfo.currency || 'USD';

      const startTime = new Date(Date.now() - 90 * 86400000).toISOString();
      const endTime = new Date().toISOString();

      const dealsUrl = `${regionalBaseUrl}/users/current/accounts/${accountId}/history-deals/time/${startTime}/${endTime}`;
      const dealsRes = await safeFetch(dealsUrl, { headers }, 'MetaApi-HistoryDeals').catch(() => null);

      let rawDeals: any[] = [];
      if (dealsRes && dealsRes.ok) {
        rawDeals = await dealsRes.json().catch(() => []);
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
        tags: ['#MT5_Sync', '#MetaApi', server],
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
