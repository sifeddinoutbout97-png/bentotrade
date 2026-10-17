/**
 * BentoTrade V6 - Serverless Broker Gateway Handshake
 * Endpoint: /api/broker/connect
 */

import { getOrCreateAndDeployAccount, fetchAccountInformationWithMultiRegionFallback } from '../_lib/metaApiHelper';

const METAAPI_TOKEN = (process.env.METAAPI_TOKEN || process.env.VITE_METAAPI_TOKEN || '').trim();

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

      return res.status(200).json({
        success: true,
        balance,
        equity,
        currency,
        count: 0,
        totalPnl: 0,
        account: {
          accountId: metaApiAccountId,
          login: String(login),
          server: fullAccount.server || server,
          platform: (platform || 'mt5').toUpperCase(),
          balance,
          equity,
          margin: Number(accountInfo.margin) || 0,
          freeMargin: Number(accountInfo.freeMargin) || equity,
          leverage: Number(accountInfo.leverage) || 100,
          currency,
          name: accountInfo.name || `Trader #${login}`,
          isSimulated: false,
          connectedAt: new Date().toISOString(),
          latencyMs: 14,
        },
        message: `Live MetaApi Cloud Bridge active: Connected to ${fullAccount.server || server} (${login}).`,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API /api/broker/connect Error]:', error);
    const causeStr = error?.cause ? String(error.cause?.message || error.cause?.code || error.cause) : undefined;
    return res.status(500).json({
      error: error?.message || 'Internal Server Error',
      cause: causeStr,
      stack: error?.stack || null,
    });
  }
}
