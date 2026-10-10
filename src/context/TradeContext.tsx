/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Trade } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getMarketTypeFromTicker } from '@/lib/utils';
import { 
  getAllTrades, 
  createTrade as apiCreateTrade, 
  deleteTrade as apiDeleteTrade, 
  deleteAllTrades as apiDeleteAllTrades, 
  updateTrade as apiUpdateTrade 
} from '@/lib/trades';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TradeContextType {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refetchTrades: () => Promise<void>;
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  createTrade: (trade: Omit<Trade, 'id' | 'created_at' | 'user_id'>) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<void>;
  deleteAllTrades: () => Promise<void>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, impersonatingUserId } = useAuth();
  const effectiveUserId = impersonatingUserId || authUser?.id || null;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!effectiveUserId) {
      setTrades([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user's trades from Supabase
      const data = await getAllTrades(effectiveUserId);

      // Retroactive Fix Logic for market_type
      const fixedTrades = await Promise.all(
        data.map(async (trade) => {
          if (!trade.market_type || (trade.market_type as any) === 'UNKNOWN') {
            const ticker = trade.ticker?.toUpperCase() || '';
            const newType = getMarketTypeFromTicker(ticker);
            if (trade.market_type !== newType) {
              try {
                await apiUpdateTrade(trade.id, { market_type: newType });
                return { ...trade, market_type: newType };
              } catch {
                return trade;
              }
            }
          }
          return trade;
        })
      );

      // Deduplicate trades by ID to prevent duplicate key errors
      const uniqueTradesMap = new Map<string, Trade>();
      fixedTrades.forEach((t) => {
        if (t && t.id) {
          uniqueTradesMap.set(t.id, t);
        }
      });
      const uniqueTrades = Array.from(uniqueTradesMap.values()).sort(
        (a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime()
      );

      setTrades(uniqueTrades);
    } catch (err: any) {
      console.error('Error fetching global trades:', err);
      setError(err.message || 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  // Initial and reactive fetch on user change
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Realtime subscription setup
  useEffect(() => {
    let isMounted = true;

    if (!effectiveUserId) {
      setIsConnected(false);
      return;
    }

    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channelName = `realtime-global-trades-${effectiveUserId}-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trades',
            filter: `user_id=eq.${effectiveUserId}`
          },
          (payload) => {
            if (!isMounted) return;
            const newTrade = payload.new as Trade;
            setTrades((prev) => {
              if (prev.some((t) => t.id === newTrade.id)) return prev;
              return [newTrade, ...prev].sort(
                (a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime()
              );
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trades',
            filter: `user_id=eq.${effectiveUserId}`
          },
          (payload) => {
            if (!isMounted) return;
            const updatedTrade = payload.new as Trade;
            setTrades((prev) =>
              prev.map((t) => (t.id === updatedTrade.id ? { ...t, ...updatedTrade } : t))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'trades',
            filter: `user_id=eq.${effectiveUserId}`
          },
          (payload) => {
            if (!isMounted) return;
            const deletedId = payload.old.id;
            setTrades((prev) => prev.filter((t) => t.id !== deletedId));
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    } catch (err: any) {
      console.error('Supabase Realtime subscription error:', err);
    }

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [effectiveUserId]);

  const createTrade = useCallback(
    async (tradeData: Omit<Trade, 'id' | 'created_at' | 'user_id'>) => {
      const created = await apiCreateTrade(tradeData);
      setTrades((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [created, ...prev].sort(
          (a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime()
        );
      });
      return created;
    },
    []
  );

  const deleteTrade = useCallback(async (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    await apiDeleteTrade(id);
  }, []);

  const deleteAllTrades = useCallback(async () => {
    setTrades([]);
    await apiDeleteAllTrades();
  }, []);

  const updateTrade = useCallback(async (id: string, updates: Partial<Trade>) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    await apiUpdateTrade(id, updates);
  }, []);

  return (
    <TradeContext.Provider
      value={{
        trades,
        loading,
        error,
        isConnected,
        refetchTrades: fetchTrades,
        setTrades,
        createTrade,
        deleteTrade,
        deleteAllTrades,
        updateTrade,
      }}
    >
      {children}
    </TradeContext.Provider>
  );
};

export const useTrades = () => {
  const context = useContext(TradeContext);
  if (!context) {
    throw new Error('useTrades must be used within a TradeProvider');
  }
  return context;
};
