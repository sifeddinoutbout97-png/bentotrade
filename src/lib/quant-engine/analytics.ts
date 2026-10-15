/**
 * BentoTrade v5.0 Quant Engine - Module 1: Performance Analytics Engine
 * Institutional mathematical formulas for win rate, profit factor, expectancy, Sharpe & Sortino ratios.
 */

import { Trade } from '@/types';

export interface PerformanceAnalyticsResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;            // Percentage 0 - 100
  lossRate: number;           // Percentage 0 - 100
  grossWins: number;          // Total $ gross profit
  grossLosses: number;        // Total $ gross loss (positive number)
  totalCommissions: number;   // Total $ fees/commissions
  totalSlippage: number;      // Total $ slippage
  netProfit: number;          // Net $ profit
  profitFactor: number;       // Gross Wins / Gross Losses
  netProfitFactor: number;    // (Gross Wins - Comm - Slip) / (Gross Losses + Comm + Slip)
  avgWinDollars: number;      // Avg $ per winning trade
  avgLossDollars: number;     // Avg $ per losing trade
  avgWinR: number;            // Avg R per winning trade
  avgLossR: number;           // Avg R per losing trade
  expectancyDollars: number;  // $ expected per trade
  expectancyR: number;        // R expected per trade
  realizedRR: number;         // Realized Real R:R ratio (Avg Win $ / Avg Loss $)
  sharpeRatio: number;        // Annualized Sharpe Ratio
  sortinoRatio: number;       // Annualized Sortino Ratio
}

/**
 * Calculates Win Rate percentage (0 - 100%)
 */
export function calculateWinRate(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;
  const winners = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0).length;
  return Math.round(((winners / trades.length) * 100 + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Profit Factor (Gross Wins / Abs(Gross Losses))
 */
export function calculateProfitFactor(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;

  const grossWins = trades
    .filter(t => t.status === 'win' || Number(t.pnl) > 0)
    .reduce((sum, t) => sum + Math.max(0, Number(t.pnl) || 0), 0);

  const grossLosses = Math.abs(
    trades
      .filter(t => t.status === 'loss' || Number(t.pnl) < 0)
      .reduce((sum, t) => sum + Math.min(0, Number(t.pnl) || 0), 0)
  );

  if (grossLosses === 0) {
    return grossWins > 0 ? Math.round((grossWins + Number.EPSILON) * 100) / 100 : 0;
  }

  return Math.round(((grossWins / grossLosses) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Net Profit Factor accounting for commissions and slippage
 */
export function calculateNetProfitFactor(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;

  let grossWins = 0;
  let grossLosses = 0;
  let totalCommissions = 0;
  let totalSlippage = 0;

  for (const t of trades) {
    const pnl = Number(t.pnl) || 0;
    const fees = Number(t.fees) || 0;
    // Estimated slippage if recorded or default 0
    const slip = (t as any).slippage || 0;

    totalCommissions += fees;
    totalSlippage += slip;

    if (pnl > 0) grossWins += pnl;
    else if (pnl < 0) grossLosses += Math.abs(pnl);
  }

  const numerator = grossWins - totalCommissions - totalSlippage;
  const denominator = grossLosses + totalCommissions + totalSlippage;

  if (denominator === 0) {
    return numerator > 0 ? Math.round((numerator + Number.EPSILON) * 100) / 100 : 0;
  }

  const ratio = numerator / denominator;
  return Math.round((ratio + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Realized Real Risk-to-Reward Ratio (Avg Win $ / Abs(Avg Loss $))
 */
export function calculateRealizedRR(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;

  const winningTrades = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0);
  const losingTrades = trades.filter(t => t.status === 'loss' || Number(t.pnl) < 0);

  if (winningTrades.length === 0) return 0;

  const avgWin = winningTrades.reduce((s, t) => s + Number(t.pnl), 0) / winningTrades.length;

  if (losingTrades.length === 0) {
    // If no losses, return avgWin or infinite risk proxy
    return Math.round((avgWin + Number.EPSILON) * 100) / 100;
  }

  const avgLoss = Math.abs(losingTrades.reduce((s, t) => s + Number(t.pnl), 0)) / losingTrades.length;

  if (avgLoss === 0) return Math.round((avgWin + Number.EPSILON) * 100) / 100;

  return Math.round(((avgWin / avgLoss) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Mathematical Expectancy ($ and R) per executed trade
 * Expectancy ($) = (Win Rate * Avg Win ($)) - (Loss Rate * Avg Loss ($)) - Avg Fees
 * Expectancy (R) = (Win Rate * Avg Win R) - (Loss Rate * Avg Loss R)
 */
export function calculateExpectancy(trades: Trade[]): { expectancyDollars: number; expectancyR: number } {
  if (!trades || trades.length === 0) {
    return { expectancyDollars: 0, expectancyR: 0 };
  }

  const total = trades.length;
  const winningTrades = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0);
  const losingTrades = trades.filter(t => t.status === 'loss' || Number(t.pnl) < 0);

  const winRate = winningTrades.length / total;
  const lossRate = losingTrades.length / total;

  const grossWins = winningTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const grossLosses = Math.abs(losingTrades.reduce((s, t) => s + Number(t.pnl), 0));
  const totalFees = trades.reduce((s, t) => s + (Number(t.fees) || 0), 0);

  const avgWin = winningTrades.length > 0 ? grossWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLosses / losingTrades.length : 0;
  const avgFee = totalFees / total;

  // Dollar Expectancy
  const expectancyDollarsRaw = (winRate * avgWin) - (lossRate * avgLoss) - avgFee;
  const expectancyDollars = Math.round((expectancyDollarsRaw + Number.EPSILON) * 100) / 100;

  // R Expectancy
  // Determine baseline 1R: either explicit risk_reward_ratio or average dollar loss (or $100 baseline)
  let avgWinR = 0;
  let avgLossR = 0;

  let rCount = 0;
  let sumWinR = 0;
  let sumLossR = 0;

  for (const t of trades) {
    const pnl = Number(t.pnl) || 0;
    const rMultiple = Number(t.risk_reward_ratio);

    if (!isNaN(rMultiple) && rMultiple !== 0) {
      rCount++;
      if (pnl > 0) sumWinR += Math.abs(rMultiple);
      else if (pnl < 0) sumLossR += Math.abs(rMultiple);
    }
  }

  if (rCount > 0) {
    avgWinR = winningTrades.length > 0 ? sumWinR / winningTrades.length : 0;
    avgLossR = losingTrades.length > 0 ? sumLossR / losingTrades.length : 1;
  } else {
    const nominalR = avgLoss > 0 ? avgLoss : 100;
    avgWinR = avgWin / nominalR;
    avgLossR = avgLoss > 0 ? 1 : 0;
  }

  const expectancyRRaw = (winRate * avgWinR) - (lossRate * avgLossR);
  const expectancyR = Math.round((expectancyRRaw + Number.EPSILON) * 100) / 100;

  return { expectancyDollars, expectancyR };
}

/**
 * Calculates Annualized Sharpe & Sortino Ratios based on daily trade returns
 */
export function calculateSharpeSortino(
  trades: Trade[], 
  riskFreeRateAnnual: number = 0.04
): { sharpeRatio: number; sortinoRatio: number } {
  if (!trades || trades.length < 2) {
    return { sharpeRatio: 0, sortinoRatio: 0 };
  }

  // Group PnL by calendar day (YYYY-MM-DD)
  const dailyPnLMap = new Map<string, number>();
  for (const t of trades) {
    const dateKey = (t.trade_date || t.created_at || '').split('T')[0] || '1970-01-01';
    const current = dailyPnLMap.get(dateKey) || 0;
    dailyPnLMap.set(dateKey, current + (Number(t.pnl) || 0));
  }

  const dailyReturns = Array.from(dailyPnLMap.values());
  const nDays = dailyReturns.length;

  if (nDays < 2) {
    return { sharpeRatio: 0, sortinoRatio: 0 };
  }

  const meanDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / nDays;
  const variance = dailyReturns.reduce((acc, val) => acc + Math.pow(val - meanDailyReturn, 2), 0) / (nDays - 1);
  const stdDev = Math.sqrt(variance);

  // Daily risk-free rate approximation (252 trading days/year)
  const dailyRiskFree = riskFreeRateAnnual / 252;

  // Annualized Sharpe Ratio
  let sharpeRatio = 0;
  if (stdDev > 0) {
    const dailySharpe = (meanDailyReturn - dailyRiskFree) / stdDev;
    sharpeRatio = dailySharpe * Math.sqrt(Math.min(252, nDays));
  }

  // Downside Deviation for Sortino Ratio
  const negativeReturns = dailyReturns.filter(r => r < 0);
  let downsideDev = 0;
  if (negativeReturns.length > 0) {
    const downsideSumSquares = dailyReturns.reduce((acc, val) => {
      const negativeVal = Math.min(0, val);
      return acc + Math.pow(negativeVal, 2);
    }, 0);
    downsideDev = Math.sqrt(downsideSumSquares / nDays);
  }

  let sortinoRatio = 0;
  if (downsideDev > 0) {
    const dailySortino = (meanDailyReturn - dailyRiskFree) / downsideDev;
    sortinoRatio = dailySortino * Math.sqrt(Math.min(252, nDays));
  } else if (meanDailyReturn > 0) {
    sortinoRatio = 9.99; // Cap for positive return with zero downside dev
  }

  return {
    sharpeRatio: Math.round((sharpeRatio + Number.EPSILON) * 100) / 100,
    sortinoRatio: Math.round((sortinoRatio + Number.EPSILON) * 100) / 100
  };
}

/**
 * Master Performance Analytics Evaluator
 */
export function calculatePerformanceAnalytics(
  trades: Trade[], 
  riskFreeRateAnnual: number = 0.04
): PerformanceAnalyticsResult {
  const total = trades ? trades.length : 0;
  const winningTradesList = trades ? trades.filter(t => t.status === 'win' || Number(t.pnl) > 0) : [];
  const losingTradesList = trades ? trades.filter(t => t.status === 'loss' || Number(t.pnl) < 0) : [];
  const breakevenTradesList = trades ? trades.filter(t => t.status === 'breakeven' || Number(t.pnl) === 0) : [];

  const winningTrades = winningTradesList.length;
  const losingTrades = losingTradesList.length;
  const breakevenTrades = breakevenTradesList.length;

  const winRate = total > 0 ? Math.round(((winningTrades / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
  const lossRate = total > 0 ? Math.round(((losingTrades / total) * 100 + Number.EPSILON) * 100) / 100 : 0;

  const grossWins = winningTradesList.reduce((s, t) => s + Math.max(0, Number(t.pnl) || 0), 0);
  const grossLosses = Math.abs(losingTradesList.reduce((s, t) => s + Math.min(0, Number(t.pnl) || 0), 0));

  const totalCommissions = trades ? trades.reduce((s, t) => s + (Number(t.fees) || 0), 0) : 0;
  const totalSlippage = trades ? trades.reduce((s, t) => s + (Number((t as any).slippage) || 0), 0) : 0;
  const netProfit = grossWins - grossLosses - totalCommissions - totalSlippage;

  const profitFactor = calculateProfitFactor(trades);
  const netProfitFactor = calculateNetProfitFactor(trades);

  const avgWinDollars = winningTrades > 0 ? Math.round(((grossWins / winningTrades) + Number.EPSILON) * 100) / 100 : 0;
  const avgLossDollars = losingTrades > 0 ? Math.round(((grossLosses / losingTrades) + Number.EPSILON) * 100) / 100 : 0;

  const nominalR = avgLossDollars > 0 ? avgLossDollars : 100;
  const avgWinR = nominalR > 0 ? Math.round(((avgWinDollars / nominalR) + Number.EPSILON) * 100) / 100 : 0;
  const avgLossR = losingTrades > 0 ? 1.0 : 0;

  const { expectancyDollars, expectancyR } = calculateExpectancy(trades);
  const realizedRR = calculateRealizedRR(trades);
  const { sharpeRatio, sortinoRatio } = calculateSharpeSortino(trades, riskFreeRateAnnual);

  return {
    totalTrades: total,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    lossRate,
    grossWins: Math.round((grossWins + Number.EPSILON) * 100) / 100,
    grossLosses: Math.round((grossLosses + Number.EPSILON) * 100) / 100,
    totalCommissions: Math.round((totalCommissions + Number.EPSILON) * 100) / 100,
    totalSlippage: Math.round((totalSlippage + Number.EPSILON) * 100) / 100,
    netProfit: Math.round((netProfit + Number.EPSILON) * 100) / 100,
    profitFactor,
    netProfitFactor,
    avgWinDollars,
    avgLossDollars,
    avgWinR,
    avgLossR,
    expectancyDollars,
    expectancyR,
    realizedRR,
    sharpeRatio,
    sortinoRatio
  };
}
