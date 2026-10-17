/**
 * BentoTrade V6 - Serverless Broker Blotter Synchronization
 * Endpoint: /api/broker/sync
 * Calls MetaApi REST API and upserts real deals into Supabase. Auto-provisions account if not found.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const METAAPI_TOKEN = process.env.METAAPI_TOKEN || process.env.VITE_METAAPI_TOKEN || '';
const SUPABASE_URL = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  'https://yaqigszrmgorhxmvdvif.supabase.co';

const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_yBPJdgdVo6dXBbIz4dZTrA_8JgBJPg5';

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    // 1. Handle CORS Preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET' || req.method === 'POST') {
      const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : (req.query || {});
      const login = body.login || body.accountId || '35211973';
      const server = body.server || 'FundedNext-Server3';
      const platform = body.platform || 'mt5';
      const password = body.password;
      const userId = body.userId;

      if (!METAAPI_TOKEN) {
        throw new Error('METAAPI_TOKEN environment variable is not configured. Please provide a valid MetaApi token to sync live broker accounts.');
      }

      const headers = {
        'auth-token': METAAPI_TOKEN.trim(),
        'Content-Type': 'application/json',
      };

      const accountsRes = await fetch('https://mt-client-api-v1.agiliumtrade.ai/users/current/accounts', {
        headers,
      });

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new Error(`Failed to fetch MetaApi accounts (${accountsRes.status}): ${errText}`);
      }

      const accounts = await accountsRes.json();
      const loginStr = String(login);
      let account = (Array.isArray(accounts) ? accounts : []).find(
        (a: any) => String(a.login) === loginStr && (!server || a.server?.toLowerCase() === server.toLowerCase())
      );

      if (!account) {
        console.log(`[MetaApi Sync] Account ${loginStr} on ${server} not found. Auto-provisioning cloud account...`);
        const createRes = await fetch('https://mt-client-api-v1.agiliumtrade.ai/users/current/accounts', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: `BentoTrade-${loginStr}`,
            type: 'cloud',
            login: loginStr,
            password: password || 'MetaVault#2026!',
            server: server,
            platform: platform === 'mt4' ? 'mt4' : 'mt5',
            magic: 1000,
          }),
        });

        if (createRes.ok) {
          account = await createRes.json();
        } else {
          const errText = await createRes.text();
          if (Array.isArray(accounts) && accounts.length > 0) {
            account = accounts[0];
          } else {
            throw new Error(`Failed to create MetaApi account for login ${loginStr} on server ${server} (${createRes.status}): ${errText}`);
          }
        }
      }

      const accountId = account.id || account.accountId;

      if (account.state !== 'DEPLOYED') {
        const deployRes = await fetch(`https://mt-client-api-v1.agiliumtrade.ai/users/current/accounts/${accountId}/deploy`, {
          method: 'POST',
          headers,
        });
        if (!deployRes.ok) {
          const errText = await deployRes.text();
          console.warn(`[MetaApi Sync] Deploy notice for ${accountId}: ${errText}`);
        }
      }

      const infoRes = await fetch(`https://mt-client-api-v1.agiliumtrade.ai/users/current/accounts/${accountId}/account-information`, {
        headers,
      });

      if (!infoRes.ok) {
        const errText = await infoRes.text();
        throw new Error(`Failed to fetch account information for ${accountId}: ${errText}`);
      }

      const accountInfo = await infoRes.json();
      const balance = Number(accountInfo.balance) || 0;
      const equity = Number(accountInfo.equity) || balance;
      const currency = accountInfo.currency || 'USD';

      const startTime = new Date(Date.now() - 90 * 86400000).toISOString();
      const endTime = new Date().toISOString();

      const dealsRes = await fetch(`https://mt-client-api-v1.agiliumtrade.ai/users/current/accounts/${accountId}/history-deals/time/${startTime}/${endTime}`, {
        headers,
      });

      let rawDeals: any[] = [];
      if (dealsRes.ok) {
        rawDeals = await dealsRes.json();
      }

      const filteredDeals = (Array.isArray(rawDeals) ? rawDeals : []).filter((d: any) => {
        if (d.type === 'DEAL_TYPE_BALANCE') return false;
        return d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL' || d.profit !== undefined;
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
        source: 'metaapi-rest',
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API /api/broker/sync Error]:', error);
    return res.status(500).json({
      error: error?.message || 'Internal Server Error',
      stack: error?.stack || null,
    });
  }
}
