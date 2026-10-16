import { connectBrokerAccount } from '../../src/services/brokerService.ts';

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
      const { login, password, server, platform = 'mt5', accountId, userId } = body;

      const result = await connectBrokerAccount({
        login: login || accountId || '35211973',
        password: password || 'MetaVault#2026!',
        server: server || 'FundedNext-Server3',
        platform: (platform as any) || 'mt5',
        accountId: accountId || login || '35211973',
        userId: userId || undefined,
      });

      return res.status(200).json({
        success: true,
        balance: result.balance,
        equity: result.equity,
        currency: result.currency || 'USD',
        count: result.count ?? 0,
        totalPnl: result.totalPnl ?? 0,
        account: result.account,
        message: result.message,
      });
    } catch (error: any) {
      console.error('[Vercel API /api/broker/connect] Error:', error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  }

  // 3. Reject other methods
  return res.status(405).json({ error: 'Method Not Allowed' });
}
