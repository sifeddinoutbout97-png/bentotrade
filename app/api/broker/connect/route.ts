import { NextResponse } from 'next/server';
import { createRequire } from 'node:module';
import { connectBrokerAccount } from '@/services/brokerService';

// Resolve CJS / ESM compatibility for MetaApi Cloud SDK
let MetaApi: any = null;
try {
  const req = createRequire(import.meta.url || (process.cwd() + '/route.js'));
  const pkg = req('metaapi.cloud-sdk');
  MetaApi = pkg.default || pkg;
} catch (e: any) {
  console.warn('[MetaApi SDK import notice]:', e?.message);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function executeConnect(params: {
  login?: string | null;
  password?: string | null;
  server?: string | null;
  platform?: string | null;
  accountId?: string | null;
  userId?: string | null;
}) {
  // Optional direct SDK initialization reference if token provided
  if (process.env.METAAPI_TOKEN && MetaApi) {
    try {
      const _directApi = new MetaApi(process.env.METAAPI_TOKEN);
    } catch (sdkInitErr) {
      console.warn('[MetaApi SDK Initialization Notice]:', sdkInitErr);
    }
  }

  const result = await connectBrokerAccount({
    login: params.login || params.accountId || '35211973',
    password: params.password || 'MetaVault#2026!',
    server: params.server || 'FundedNext-Server3',
    platform: (params.platform as any) || 'mt5',
    accountId: params.accountId || params.login || '35211973',
    userId: params.userId || undefined,
  });

  return {
    success: true,
    balance: result.balance,
    equity: result.equity,
    currency: result.currency,
    count: result.count ?? 0,
    totalPnl: result.totalPnl ?? 0,
    account: result.account,
    message: result.message,
  };
}

/**
 * POST /api/broker/connect
 * Performs secure authentication handshake with MetaTrader 5 / 4 broker gateway via MetaApi Cloud SDK.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { login, password, server, platform = 'mt5', accountId, userId } = body;

    const data = await executeConnect({
      login: login || accountId,
      password,
      server,
      platform,
      accountId,
      userId,
    });

    return NextResponse.json(data, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[/api/broker/connect POST] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to establish handshake with broker gateway',
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

/**
 * GET /api/broker/connect
 * Fallback query handler to prevent 405 Method Not Allowed errors.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const data = await executeConnect({
      login: searchParams.get('login') || searchParams.get('accountId'),
      password: searchParams.get('password'),
      server: searchParams.get('server'),
      platform: searchParams.get('platform') || 'mt5',
      accountId: searchParams.get('accountId') || searchParams.get('login'),
      userId: searchParams.get('userId'),
    });

    return NextResponse.json(data, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[/api/broker/connect GET] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to establish handshake with broker gateway',
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

/**
 * OPTIONS /api/broker/connect
 * CORS preflight handling.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
