/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';
import { Trade } from '@/types';

export const createTrade = async (trade: Omit<Trade, 'id' | 'created_at' | 'user_id'>) => {
  const { data: { session } } = await supabase.auth.getSession();
  const effectiveUserId = session?.user?.id;
  
  if (!effectiveUserId) {
    throw new Error('User must be authenticated to log a trade.');
  }

  const { data, error } = await supabase
    .from('trades')
    .insert([
      {
        ...trade,
        user_id: effectiveUserId
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getTradeSummary = async (targetUserId?: string | null) => {
  let effectiveUserId = targetUserId;
  if (!effectiveUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    effectiveUserId = session?.user?.id;
  }
  if (!effectiveUserId) return null;

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', effectiveUserId);

  if (error) throw error;
  
  const trades = (data as Trade[]) || [];
  if (trades.length === 0) return null;

  const netPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winCount = trades.filter(t => t.status === 'win').length;
  const winRate = (winCount / trades.length) * 100;
  
  const winners = trades.filter(t => t.status === 'win' && t.pnl > 0);
  const losers = trades.filter(t => t.status === 'loss' && t.pnl < 0);
  const avgWin = winners.length > 0 ? (winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length) : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0) / losers.length) : 0;
  const rr = avgLoss > 0 ? (avgWin / avgLoss) : 0;

  return {
    netPnl,
    winRate,
    rr,
    totalTrades: trades.length,
    trades // Return raw trades for chart
  };
};

export const getRecentTrades = async (limit = 20, targetUserId?: string | null) => {
  let effectiveUserId = targetUserId;
  if (!effectiveUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    effectiveUserId = session?.user?.id;
  }
  if (!effectiveUserId) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('trade_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Trade[]) || [];
};

export const getAllTrades = async (targetUserId?: string | null) => {
  let effectiveUserId = targetUserId;
  if (!effectiveUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    effectiveUserId = session?.user?.id;
  }
  if (!effectiveUserId) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('trade_date', { ascending: false });

  if (error) throw error;
  return (data as Trade[]) || [];
};

export const deleteTrade = async (id: string) => {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const deleteAllTrades = async () => {
  const { error } = await supabase
    .from('trades')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw error;
};

export const updateTrade = async (id: string, updates: Partial<Trade>) => {
  const { error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};
