/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trade } from '@/types';
import { calculateProfitFactor as quantProfitFactor, calculateRealizedRR as quantRealizedRR } from '@/lib/quant-engine';

/**
 * Total Gross Profit / Absolute value of Total Gross Loss.
 */
export const calculateProfitFactor = (trades: Trade[]): number => {
  return quantProfitFactor(trades);
};

/**
 * Average dollar amount of winners / Absolute average dollar amount of losers.
 */
export const calculateAverageRR = (trades: Trade[]): number => {
  return quantRealizedRR(trades);
};

/**
 * Calculate Max Drawdown from peak to trough in absolute dollar terms.
 */
export const calculateMaxDrawdown = (trades: Trade[]): number => {
  if (!trades || trades.length === 0) return 0;

  // Sort trades by date
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.trade_date || a.created_at).getTime() - new Date(b.trade_date || b.created_at).getTime()
  );

  let currentEquity = 0;
  let peak = 0;
  let maxDD = 0;

  for (const trade of sortedTrades) {
    currentEquity += (Number(trade.pnl) || 0);
    
    if (currentEquity > peak) {
      peak = currentEquity;
    }

    const currentDD = peak - currentEquity;
    if (currentDD > maxDD) {
      maxDD = currentDD;
    }
  }

  return Math.round((maxDD + Number.EPSILON) * 100) / 100;
};
