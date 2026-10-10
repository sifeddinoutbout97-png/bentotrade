/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useTrades } from '@/context/TradeContext';
import { TradeData } from '@/types';

interface UseRealtimeTradesOptions {
  userId?: string | null;
  limit?: number;
}

export function useRealtimeTrades(options: UseRealtimeTradesOptions = {}) {
  const { trades, loading, error, isConnected, refetchTrades } = useTrades();
  const limit = options.limit;

  const limitedTrades = limit && limit > 0 ? trades.slice(0, limit) : trades;

  return {
    trades: limitedTrades as TradeData[],
    loading,
    error,
    isConnected,
    refetch: refetchTrades
  };
}
