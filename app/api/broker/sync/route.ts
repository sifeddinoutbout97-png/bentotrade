import { NextResponse } from 'next/server';
import { syncBrokerTrades } from '@/services/brokerService';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function executeSync(params: {
  login?: string | null;
  server?: string | null;
  platform?: string | null;
  accountId?: string | null;
  userId?: string | null;
  force?: boolean;
}) {
  const result = await syncBrokerTrades({
    login: params.login || params.accountId || '35211973',
    server: params.server || 'FundedNext-Server3',
    platform: params.platform || 'mt5',
    accountId: params.accountId || params.login || '35211973',
    userId: params.userId || undefined,
    force: params.force !== false,
  });

  return {
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
}

/**
 * POST /api/broker/sync
 * Syncs broker execution blotter with payload from LiveBrokerSync.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { login, server, platform, accountId, userId, force } = body;

    const data = await executeSync({
      login: login || accountId,
      server,
      platform,
      accountId,
      userId,
      force,
    });

    return NextResponse.json(data, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[/api/broker/sync POST] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to synchronize executions from broker',
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

/**
 * GET /api/broker/sync
 * Fallback and health check query handler to prevent 405 Method Not Allowed errors.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const data = await executeSync({
      login: searchParams.get('login') || searchParams.get('accountId'),
      server: searchParams.get('server'),
      platform: searchParams.get('platform'),
      accountId: searchParams.get('accountId') || searchParams.get('login'),
      userId: searchParams.get('userId'),
      force: searchParams.get('force') !== 'false',
    });

    return NextResponse.json(data, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[/api/broker/sync GET] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to synchronize executions from broker',
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

/**
 * OPTIONS /api/broker/sync
 * CORS preflight handling.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
