import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TradeData } from '../types';
import { toast } from 'sonner';

interface UseOptimisticTradesOptions {
  userId?: string | null;
  initialTrades?: TradeData[];
}

export function useOptimisticTrades(options: UseOptimisticTradesOptions = {}) {
  const { userId, initialTrades = [] } = options;
  const [trades, setTrades] = useState<TradeData[]>(initialTrades);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Store a snapshot ref to rollback in case of mutation errors
  const tradesSnapshotRef = useRef<TradeData[]>(trades);
  useEffect(() => {
    tradesSnapshotRef.current = trades;
  }, [trades]);

  // Initial load from Supabase
  const loadTrades = useCallback(async () => {
    try {
      setLoading(true);
      let targetUserId = userId;

      if (!targetUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        targetUserId = session?.user?.id || null;
      }

      if (!targetUserId) {
        setTrades([]);
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', targetUserId)
        .order('trade_date', { ascending: false });

      if (error) throw error;
      setTrades((data as TradeData[]) || []);
    } catch (err: any) {
      console.error('OptimisticTrades load error:', err);
      toast.error('Failed to synchronize trade portfolio from cloud');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  /**
   * Optimistically logs a new trade.
   * Instantly prepends the trade to local state, then executes background Supabase insert.
   * If insert fails, rolls back state and displays descriptive error toast.
   */
  const logTrade = useCallback(async (newTradeInput: Omit<TradeData, 'id' | 'created_at'> & { id?: string }) => {
    const previousTrades = tradesSnapshotRef.current;

    let targetUserId = newTradeInput.user_id || userId;
    if (!targetUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      targetUserId = session?.user?.id || '';
    }

    // Generate optimistic temporary ID and timestamp
    const optimisticId = newTradeInput.id || `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticTrade: TradeData = {
      ...newTradeInput,
      id: optimisticId,
      user_id: targetUserId,
      created_at: new Date().toISOString()
    };

    // 1. Zero-latency optimistic UI update
    setTrades(prev => [optimisticTrade, ...prev]);
    setIsSyncing(true);

    try {
      // 2. Background database persistence
      const { data, error } = await supabase
        .from('trades')
        .insert([{
          user_id: targetUserId,
          ticker: optimisticTrade.ticker,
          market_type: optimisticTrade.market_type || 'futures',
          entry_price: optimisticTrade.entry_price,
          exit_price: optimisticTrade.exit_price ?? null,
          stop_loss: optimisticTrade.stop_loss ?? null,
          trade_date: optimisticTrade.trade_date,
          position_size: optimisticTrade.position_size,
          direction: optimisticTrade.direction,
          status: optimisticTrade.status,
          pnl: optimisticTrade.pnl,
          fees: optimisticTrade.fees ?? 0,
          risk_reward_ratio: optimisticTrade.risk_reward_ratio ?? null,
          notes: optimisticTrade.notes ?? null,
          image_urls: optimisticTrade.image_urls ?? []
        }])
        .select()
        .single();

      if (error) throw error;

      // 3. Swap optimistic ID with confirmed cloud record ID
      if (data) {
        setTrades(prev => prev.map(t => t.id === optimisticId ? (data as TradeData) : t));
      }

      toast.success(`Trade logged for ${optimisticTrade.ticker} (Instant Sync)`);
      return data as TradeData;
    } catch (err: any) {
      console.error('Optimistic logTrade failed, rolling back:', err);
      // Graceful rollback to prior snapshot
      setTrades(previousTrades);
      toast.error(`Failed to save trade for ${optimisticTrade.ticker}. State reverted.`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  /**
   * Optimistically removes a trade.
   * Instantly filters out from local state, then executes background Supabase deletion.
   */
  const removeTrade = useCallback(async (tradeId: string) => {
    const previousTrades = tradesSnapshotRef.current;
    const targetTrade = previousTrades.find(t => t.id === tradeId);

    // 1. Instant local removal
    setTrades(prev => prev.filter(t => t.id !== tradeId));
    setIsSyncing(true);

    try {
      // 2. Background database delete
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId);

      if (error) throw error;

      toast.success(`Execution deleted from journal`);
    } catch (err: any) {
      console.error('Optimistic removeTrade failed, rolling back:', err);
      // Rollback to previous state
      setTrades(previousTrades);
      toast.error(`Failed to delete trade ${targetTrade?.ticker || ''}. State reverted.`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Optimistically updates an existing trade.
   */
  const updateTrade = useCallback(async (tradeId: string, updates: Partial<TradeData>) => {
    const previousTrades = tradesSnapshotRef.current;

    // 1. Instant local mutation
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
    setIsSyncing(true);

    try {
      const { data, error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTrades(prev => prev.map(t => t.id === tradeId ? (data as TradeData) : t));
      }

      toast.success('Trade updated');
      return data as TradeData;
    } catch (err: any) {
      console.error('Optimistic updateTrade failed, rolling back:', err);
      setTrades(previousTrades);
      toast.error('Failed to update trade. Changes reverted.');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    trades,
    loading,
    isSyncing,
    logTrade,
    removeTrade,
    updateTrade,
    refetch: loadTrades
  };
}
