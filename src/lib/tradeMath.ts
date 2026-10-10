/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trade } from '@/types';

/**
 * Total Gross Profit / Absolute value of Total Gross Loss.
 */
export const calculateProfitFactor = (trades: Trade[]): number => {
  const grossProfit = trades
    .filter((t) => t.pnl > 0)
    .reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = trades
    .filter((t) => t.pnl < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnl), 0);

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
};

/**
 * Average dollar amount of winners / Absolute average dollar amount of losers.
 */
export const calculateAverageRR = (trades: Trade[]): number => {
  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);

  if (losers.length === 0) return winners.length > 0 ? Infinity : 0;
  
  const avgWin = winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length;
  const avgLoss = losers.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losers.length;
  
  if (avgLoss === 0) return 0;
  return avgWin / avgLoss;
};

/**
 * Calculate Max Drawdown from peak to trough in absolute dollar terms.
 */
export const calculateMaxDrawdown = (trades: Trade[]): number => {
  if (trades.length === 0) return 0;

  // Sort trades by date
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  let currentEquity = 0;
  let peak = 0;
  let maxDD = 0;

  for (const trade of sortedTrades) {
    currentEquity += trade.pnl;
    
    if (currentEquity > peak) {
      peak = currentEquity;
    }

    const currentDD = peak - currentEquity;
    if (currentDD > maxDD) {
      maxDD = currentDD;
    }
  }

  return maxDD;
};
