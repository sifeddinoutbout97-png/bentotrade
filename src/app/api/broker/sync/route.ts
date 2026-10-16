import { syncBrokerTrades } from '@/services/brokerService';

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { login, server, platform, accountId, userId, force } = body;

    const result = await syncBrokerTrades({
      login: login || accountId || '35211973',
      server: server || 'FundedNext-Server3',
      platform: platform || 'mt5',
      accountId: accountId || login || '35211973',
      userId: userId || undefined,
      force: force !== false,
    });

    const responsePayload = {
      success: true,
      balance: result.balance,
      equity: result.equity,
      currency: result.currency,
      count: result.count,
      totalPnl: result.totalPnl,
      tradesSynced: result.tradesSynced,
      netPnl: result.netPnl,
      trades: result.trades,
      syncedAt: result.syncedAt,
      source: result.source,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (err: any) {
    console.error('[/api/broker/sync POST] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to synchronize executions from broker',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const result = await syncBrokerTrades({
      login: searchParams.get('login') || searchParams.get('accountId') || '35211973',
      server: searchParams.get('server') || 'FundedNext-Server3',
      platform: (searchParams.get('platform') as any) || 'mt5',
      accountId: searchParams.get('accountId') || searchParams.get('login') || '35211973',
      userId: searchParams.get('userId') || undefined,
      force: searchParams.get('force') !== 'false',
    });

    const responsePayload = {
      success: true,
      balance: result.balance,
      equity: result.equity,
      currency: result.currency,
      count: result.count,
      totalPnl: result.totalPnl,
      tradesSynced: result.tradesSynced,
      netPnl: result.netPnl,
      trades: result.trades,
      syncedAt: result.syncedAt,
      source: result.source,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (err: any) {
    console.error('[/api/broker/sync GET] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to synchronize executions from broker',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}
