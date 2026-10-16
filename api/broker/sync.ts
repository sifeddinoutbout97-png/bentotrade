import { syncBrokerTrades } from '../../src/services/brokerService.ts';

export default async function handler(req: any, res: any) {
  // 1. Handle CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Handle POST Request
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { login, server, platform, accountId, userId, force } = body;

      const result = await syncBrokerTrades({
        login: login || accountId || '35211973',
        server: server || 'FundedNext-Server3',
        platform: platform || 'mt5',
        accountId: accountId || login || '35211973',
        userId: userId || undefined,
        force: force !== false,
      });

      return res.status(200).json({
        success: true,
        balance: result.balance,
        equity: result.equity,
        currency: result.currency || 'USD',
        count: result.count,
        totalPnl: result.totalPnl,
        tradesSynced: result.tradesSynced,
        netPnl: result.netPnl,
        trades: result.trades,
        syncedAt: result.syncedAt,
        source: result.source,
      });
    } catch (error: any) {
      console.error('[Vercel API /api/broker/sync] Error:', error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  }

  // 3. Reject other methods
  return res.status(405).json({ error: 'Method Not Allowed' });
}
