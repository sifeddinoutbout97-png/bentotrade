import { connectBrokerAccount } from '@/services/brokerService';

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
    const { login, password, server, platform = 'mt5', accountId, userId } = body;

    const result = await connectBrokerAccount({
      login: login || accountId || '35211973',
      password: password || 'MetaVault#2026!',
      server: server || 'FundedNext-Server3',
      platform: (platform as any) || 'mt5',
      accountId: accountId || login || '35211973',
      userId: userId || undefined,
    });

    const responsePayload = {
      success: true,
      balance: result.balance,
      equity: result.equity,
      currency: result.currency,
      count: result.count ?? 0,
      totalPnl: result.totalPnl ?? 0,
      account: result.account,
      message: result.message,
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
    console.error('[/api/broker/connect POST] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to establish handshake with broker gateway',
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

    const result = await connectBrokerAccount({
      login: searchParams.get('login') || searchParams.get('accountId') || '35211973',
      password: searchParams.get('password') || 'MetaVault#2026!',
      server: searchParams.get('server') || 'FundedNext-Server3',
      platform: (searchParams.get('platform') as any) || 'mt5',
      accountId: searchParams.get('accountId') || searchParams.get('login') || '35211973',
      userId: searchParams.get('userId') || undefined,
    });

    const responsePayload = {
      success: true,
      balance: result.balance,
      equity: result.equity,
      currency: result.currency,
      count: result.count ?? 0,
      totalPnl: result.totalPnl ?? 0,
      account: result.account,
      message: result.message,
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
    console.error('[/api/broker/connect GET] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to establish handshake with broker gateway',
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
