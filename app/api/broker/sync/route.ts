import { NextResponse } from 'next/server';
import { syncBrokerTrades } from '@/services/brokerService';

/**
 * POST /api/broker/sync
 * Syncs broker execution blotter and persists paired trades to Supabase trades and journal_logs.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { login, server, platform, accountId, userId, force } = body;

    const result = await syncBrokerTrades({
      login: login || accountId,
      server,
      platform,
      accountId,
      userId,
      force,
    });

    return NextResponse.json({
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
    }, { status: 200 });
  } catch (err: any) {
    console.error('[/api/broker/sync] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to synchronize executions from broker',
      },
      { status: 400 }
    );
  }
}
