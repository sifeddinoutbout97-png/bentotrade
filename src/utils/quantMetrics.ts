/**
 * BentoTrade v5.0 Quantitative Analytics & Risk Calculation Engine
 * Purely typed financial mathematics for institutional performance evaluation
 */

import { TradeData, DrawdownResult, WinLossStreakInfo, QuantMetricsData } from '@/types';

/**
 * Calculates the Sharpe Ratio from an array of trade returns or percentage changes.
 * @param returns Array of periodic returns or trade PnL figures
 * @param riskFreeRate Optional per-period risk-free benchmark rate (default 0)
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (!returns || returns.length < 2) return 0;

  const n = returns.length;
  const mean = returns.reduce((acc, val) => acc + val, 0) / n;
  const variance = returns.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualized Sharpe (assuming ~252 trading sessions)
  const tradeSharpe = (mean - riskFreeRate) / stdDev;
  return Number((tradeSharpe * Math.sqrt(Math.min(252, n))).toFixed(2));
}

/**
 * Calculates Maximum Drawdown, peak, and valley indices from an equity curve.
 * @param equityCurve Array of cumulative equity numbers [0, 150, 400, 250, ...]
 */
export function calculateMaxDrawdown(equityCurve: number[]): DrawdownResult {
  if (!equityCurve || equityCurve.length < 2) {
    return { maxDrawdown: 0, peakIndex: 0, valleyIndex: 0, maxDrawdownPct: 0 };
  }

  let peak = equityCurve[0];
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxPeakIndex = 0;
  let valleyIndex = 0;
  let maxDrawdownPct = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    const current = equityCurve[i];
    if (current > peak) {
      peak = current;
      peakIndex = i;
    } else {
      const dd = peak - current;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxPeakIndex = peakIndex;
        valleyIndex = i;
        maxDrawdownPct = peak !== 0 ? Math.min(100, Math.abs(dd / peak) * 100) : 0;
      }
    }
  }

  return {
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    peakIndex: maxPeakIndex,
    valleyIndex,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(1))
  };
}

/**
 * Calculates Profit Factor (Gross Profits / Absolute Gross Losses).
 */
export function calculateProfitFactor(trades: TradeData[]): number {
  if (!trades || trades.length === 0) return 0;

  const grossProfit = trades
    .filter(t => t.pnl > 0)
    .reduce((sum, t) => sum + t.pnl, 0);

  const grossLoss = trades
    .filter(t => t.pnl < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnl), 0);

  if (grossLoss === 0) {
    return grossProfit > 0 ? 99.99 : 0;
  }

  return Number((grossProfit / grossLoss).toFixed(2));
}

/**
 * Calculates Execution Efficiency based on achieved R-multiples vs nominal risk.
 * Outputs a normalized percentage index (0 - 100%).
 */
export function calculateExecutionEfficiency(rMultiples: number[]): number {
  if (!rMultiples || rMultiples.length === 0) return 75;

  const positiveR = rMultiples.filter(r => r > 0);
  if (positiveR.length === 0) return 40;

  const avgWinR = positiveR.reduce((a, b) => a + b, 0) / positiveR.length;
  // Normalized benchmark: 2.0R target = 100% efficiency
  const rawScore = (avgWinR / 2.0) * 100;
  return Number(Math.min(99, Math.max(25, Math.round(rawScore))));
}

/**
 * Calculates Win/Loss Streak distribution (longest win streak, longest loss streak, current streak).
 */
export function calculateStreaks(trades: TradeData[]): {
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
} {
  if (!trades || trades.length === 0) {
    return {
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      maxWinStreak: 0,
      maxLossStreak: 0
    };
  }

  // Sort chronologically
  const sorted = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  let longestWin = 0;
  let longestLoss = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const trade of sorted) {
    if (trade.pnl > 0) {
      currentWin++;
      currentLoss = 0;
      if (currentWin > longestWin) longestWin = currentWin;
    } else if (trade.pnl < 0) {
      currentLoss++;
      currentWin = 0;
      if (currentLoss > longestLoss) longestLoss = currentLoss;
    }
  }

  // Current streak is positive for win streak, negative for loss streak
  const currentStreak = currentWin > 0 ? currentWin : currentLoss > 0 ? -currentLoss : 0;

  return {
    currentStreak,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    maxWinStreak: longestWin,
    maxLossStreak: longestLoss
  };
}

/**
 * Calculates mathematical Expectancy per trade: (Win% * AvgWin) - (Loss% * AvgLoss)
 */
export function calculateExpectancy(trades: TradeData[]): number {
  if (!trades || trades.length === 0) return 0;

  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl < 0);

  const winRate = winners.length / trades.length;
  const lossRate = losers.length / trades.length;

  const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losers.length : 0;

  const exp = (winRate * avgWin) - (lossRate * avgLoss);
  return Number(exp.toFixed(2));
}

/**
 * Mathematical formula for Risk of Ruin based on win rate, reward-to-risk ratio, and risk percentage.
 */
export function calculateRiskOfRuinFormula(
  winRate: number,
  rewardRiskRatio: number = 1.5,
  riskPerTradePct: number = 2
): number {
  if (winRate <= 0) return 100;
  if (winRate >= 1) return 0;
  
  // Normalized probability
  const p = winRate > 1 ? winRate / 100 : winRate;
  const q = 1 - p;

  if (p <= 0.3) return 85.0;
  if (p >= 0.7) return 0.1;

  // Capital units before 100% loss given risk per trade (e.g., 2% = 50 units)
  const units = Math.max(5, Math.min(100, Math.round(100 / Math.max(0.5, riskPerTradePct))));

  // Adjusted edge with reward/risk ratio
  const edge = p * (1 + rewardRiskRatio) - 1;
  if (edge <= 0) {
    const ror = Math.min(99.9, Math.pow(q / Math.max(0.01, p), Math.min(units, 20)) * 100);
    return Number(ror.toFixed(1));
  }

  const ratio = q / (p * Math.max(1, rewardRiskRatio));
  const ror = Math.pow(Math.min(0.99, ratio), units) * 100;
  return Number(Math.max(0.1, Math.min(99.9, ror)).toFixed(1));
}

/**
 * Estimates Risk of Ruin percentage supporting either trades array or (winRate, rewardRiskRatio, riskPerTradePct)
 */
export function calculateRiskOfRuin(
  tradesOrWinRate: TradeData[] | number,
  rewardRiskOrUnits: number = 20,
  riskPerTradePct: number = 2
): number {
  if (typeof tradesOrWinRate === 'number') {
    return calculateRiskOfRuinFormula(tradesOrWinRate, rewardRiskOrUnits, riskPerTradePct);
  }

  const trades = tradesOrWinRate;
  if (!trades || trades.length < 5) return 0.5;

  const winners = trades.filter(t => t.pnl > 0);
  const winRate = winners.length / trades.length;

  if (winRate <= 0.3) return 85.0;
  if (winRate >= 0.7) return 0.1;

  const p = winRate;
  const q = 1 - p;

  const capitalUnits = rewardRiskOrUnits || 20;

  if (p === q) return 50.0;
  if (p < q) {
    const ror = Math.pow(q / p, capitalUnits);
    return Number(Math.min(99.9, ror * 100).toFixed(1));
  }

  const ror = Math.pow(q / p, capitalUnits);
  return Number(Math.max(0.1, ror * 100).toFixed(1));
}

/**
 * Compiles a comprehensive quantitative performance dataset from trade history.
 */
export function computeQuantMetrics(trades: TradeData[]): QuantMetricsData {
  if (!trades || trades.length === 0) {
    return {
      sharpeRatio: 0,
      maxDrawdown: { maxDrawdown: 0, peakIndex: 0, valleyIndex: 0, maxDrawdownPct: 0 },
      profitFactor: 0,
      executionEfficiency: 75,
      winRate: 0,
      expectancy: 0,
      winLossStreaks: { currentStreak: 0, longestWinStreak: 0, longestLossStreak: 0 },
      riskOfRuin: 0,
      totalTrades: 0,
      totalPnL: 0
    };
  }

  // Sort chronologically
  const sorted = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  // Cumulative equity curve
  let runningEquity = 0;
  const equityCurve: number[] = [0];
  const returns: number[] = [];
  const rMultiples: number[] = [];

  for (const t of sorted) {
    runningEquity += t.pnl;
    equityCurve.push(runningEquity);
    returns.push(t.pnl);

    if (t.risk_reward_ratio) {
      rMultiples.push(t.risk_reward_ratio);
    } else if (t.stop_loss && Math.abs(t.entry_price - t.stop_loss) > 0) {
      const risk = Math.abs(t.entry_price - t.stop_loss);
      const reward = Math.abs((t.exit_price ?? t.entry_price) - t.entry_price);
      rMultiples.push(reward / risk);
    }
  }

  const sharpeRatio = calculateSharpeRatio(returns);
  const maxDrawdown = calculateMaxDrawdown(equityCurve);
  const profitFactor = calculateProfitFactor(sorted);
  const executionEfficiency = calculateExecutionEfficiency(rMultiples);
  const winLossStreaks = calculateStreaks(sorted);
  const expectancy = calculateExpectancy(sorted);
  const riskOfRuin = calculateRiskOfRuin(sorted);

  const winCount = sorted.filter(t => t.pnl > 0).length;
  const winRate = Number(((winCount / sorted.length) * 100).toFixed(1));

  return {
    sharpeRatio,
    maxDrawdown,
    profitFactor,
    executionEfficiency,
    winRate,
    expectancy,
    winLossStreaks,
    riskOfRuin,
    totalTrades: sorted.length,
    totalPnL: runningEquity
  };
}
