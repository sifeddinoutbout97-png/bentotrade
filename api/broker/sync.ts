/**
 * BentoTrade V6 - Serverless Broker Blotter Synchronization
 * Endpoint: /api/broker/sync
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateAndDeployAccount, fetchAccountInformationWithMultiRegionFallback, safeFetch } from '../_lib/metaApiHelper';

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

      const accountInfo = await fetchAccountInformationWithMultiRegionFallback(metaApiAccountId, region, headers);
      const balance = Number(accountInfo.balance) || 0;
      const equity = Number(accountInfo.equity) || balance;
      const currency = accountInfo.currency || 'USD';

      // Fetch history deals using regional client API with multi-region fallback
      const startTime = new Date(Date.now() - 90 * 86400000).toISOString();
      const endTime = new Date().toISOString();

      let rawDeals: any[] = [];
      const regionsToTry = [region, ...['new-york', 'london', 'vint-hill', 'singapore', 'tokyo'].filter(r => r !== region)];
      
      for (const reg of regionsToTry) {
        const regionalBaseUrl = `https://mt-client-api-v1.${reg}.agiliumtrade.ai`;
        const dealsUrl = `${regionalBaseUrl}/users/current/accounts/${metaApiAccountId}/history-deals/time/${startTime}/${endTime}`;
        const dealsRes = await safeFetch(dealsUrl, { headers }, `MetaApi-HistoryDeals-${reg}`).catch(() => null);
        if (dealsRes && dealsRes.ok) {
          rawDeals = await dealsRes.json().catch(() => []);
          break;
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
