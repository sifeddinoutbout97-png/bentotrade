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

/**
 * POST /api/broker/connect
 * Performs secure authentication handshake with MetaTrader 5 / 4 broker gateway via MetaApi Cloud SDK.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { login, password, server, platform = 'mt5', accountId, userId } = body;

    // Optional direct SDK initialization reference if token provided
    if (process.env.METAAPI_TOKEN) {
      try {
        const _directApi = new MetaApi(process.env.METAAPI_TOKEN);
      } catch (sdkInitErr) {
        console.warn('[MetaApi SDK Initialization Notice]:', sdkInitErr);
      }
    }

    const result = await connectBrokerAccount({
      login: login || accountId,
      password,
      server,
      platform,
      accountId,
      userId,
    });

    return NextResponse.json({
      success: true,
      balance: result.balance,
      equity: result.equity,
      currency: result.currency,
      count: result.count ?? 0,
      totalPnl: result.totalPnl ?? 0,
      account: result.account,
      message: result.message,
    }, { status: 200 });
  } catch (err: any) {
    console.error('[/api/broker/connect] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to establish handshake with broker gateway',
      },
      { status: 400 }
    );
  }
}
