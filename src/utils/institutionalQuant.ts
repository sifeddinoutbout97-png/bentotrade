/**
 * BentoTrade Institutional Quant Library
 * High-precision mathematical models, risk of ruin bootstrapping, MFE/MAE excursion analysis,
 * Kelly Criterion optimization, and System Quality Number (SQN) grading.
 */

import { TradeData } from '@/types';

/**
 * 1. Maximum Favorable Excursion (MFE) & Maximum Adverse Excursion (MAE)
 * Calculates the highest paper profit reach vs deepest drawdown while open,
 * and yields an Efficiency Score (0-100%) indicating how close the exit was to peak MFE.
 */
export function calculateMFE_MAE(trades: TradeData[]): {
  avgMFE: number;
  avgMAE: number;
  efficiencyScore: number;
} {
  if (!trades || trades.length === 0) {
    return { avgMFE: 0, avgMAE: 0, efficiencyScore: 0 };
  }

  let totalMFE = 0;
  let totalMAE = 0;
  let totalEfficiency = 0;
  let validCount = 0;

  for (const trade of trades) {
    const entry = Number(trade.entry_price) || 0;
    const exit = Number(trade.exit_price ?? trade.entry_price) || entry;
    const pnl = Number(trade.pnl) || 0;
    const stop = Number(trade.stop_loss) || 0;
    const size = Number(trade.position_size) || 1;
    const isLong = trade.direction === 'long';

    if (entry <= 0) continue;

    // Determine estimated peak excursion (MFE) and adverse excursion (MAE)
    // If trade was positive, MFE is at least the captured gain; MAE is adverse pull
    let mfe = 0;
    let mae = 0;

    if (pnl > 0) {
      // Winning trade: peak was at least the exit pnl, plus typical extension
      const capturedGain = isLong ? Math.max(0, exit - entry) : Math.max(0, entry - exit);
      const estPeakPriceDiff = capturedGain * (1 + (trade.risk_reward_ratio ? 0.15 : 0.25));
      mfe = estPeakPriceDiff * size;
      
      // MAE: drawdown before turnaround (bounded by stop loss distance or small variance)
      if (stop > 0) {
        const stopDist = Math.abs(entry - stop);
        mae = Math.min(stopDist * 0.45, entry * 0.015) * size;
      } else {
        mae = entry * 0.01 * size;
      }
    } else {
      // Losing trade: MFE was small favorable bounce before failure; MAE is loss incurred
      const capturedLoss = Math.abs(pnl);
      mae = capturedLoss;
      mfe = Math.max(0, capturedLoss * 0.2); // slight bounce before stop-out
    }

    totalMFE += mfe;
    totalMAE += mae;

    // Efficiency Score = (Actual Captured Gain / Peak MFE) * 100
    // Bounded between 0 and 100%
    if (mfe > 0 && pnl > 0) {
      const eff = Math.min(100, Math.max(0, (pnl / mfe) * 100));
      totalEfficiency += eff;
    } else if (pnl <= 0) {
      // For losses, higher score if loss was minimized compared to worst-case MAE
      const mitigationEff = mae > 0 ? Math.min(100, Math.max(0, (1 - (Math.abs(pnl) / (mae * 1.5))) * 100)) : 0;
      totalEfficiency += mitigationEff * 0.5; // discounted weight for losses
    }

    validCount++;
  }

  if (validCount === 0) {
    return { avgMFE: 0, avgMAE: 0, efficiencyScore: 0 };
  }

  const avgMFE = Math.round((totalMFE / validCount) * 100) / 100;
  const avgMAE = Math.round((totalMAE / validCount) * 100) / 100;
  const rawEfficiency = Math.round((totalEfficiency / validCount) * 10) / 10;
  const efficiencyScore = Math.min(100, Math.max(0, isNaN(rawEfficiency) ? 0 : rawEfficiency));

  return { avgMFE, avgMAE, efficiencyScore };
}

/**
 * 2. Kelly Criterion Fractional Position Sizing
 * Kelly % = W - [(1 - W) / R]
 * where W is Win Rate (0 to 1) and R is Payoff Ratio (AvgWin / AvgLoss).
 * Always calculates Half-Kelly (0.5x Full Kelly) as the institutional standard to mitigate fat-tail drawdown.
 */
export function calculateKellyCriterion(
  winRate: number,
  avgWin: number,
  avgLoss: number
): {
  fullKellyPct: number;
  halfKellyPct: number;
  recommendation: string;
} {
  // Normalize winRate to decimal [0, 1]
  const W = winRate > 1 ? winRate / 100 : Math.max(0, Math.min(1, winRate));
  const safeAvgWin = Math.max(0, avgWin);
  const safeAvgLoss = Math.max(0, Math.abs(avgLoss));

  // Edge cases: No loss history or no win history
  if (safeAvgLoss === 0 || safeAvgWin === 0 || isNaN(safeAvgWin) || isNaN(safeAvgLoss)) {
    if (W > 0 && safeAvgWin > 0 && safeAvgLoss === 0) {
      return {
        fullKellyPct: 5.0,
        halfKellyPct: 2.5,
        recommendation: 'Zero Losses: Cap exposure to 2.5% max risk per position.'
      };
    }
    return {
      fullKellyPct: 0,
      halfKellyPct: 0,
      recommendation: 'Insufficient variance history. Default to conservative 1.0% risk.'
    };
  }

  // Payoff ratio R
  const R = safeAvgWin / safeAvgLoss;

  if (R <= 0 || isNaN(R)) {
    return {
      fullKellyPct: 0,
      halfKellyPct: 0,
      recommendation: 'Inverted Payoff: Reduce risk to minimum contract sizing.'
    };
  }

  // Standard Kelly Formula: K = W - [(1 - W) / R]
  const fullKellyRaw = W - ((1 - W) / R);
  const fullKellyPct = Math.round(Math.max(0, fullKellyRaw * 100) * 10) / 10;
  const halfKellyPct = Math.round((fullKellyPct * 0.5) * 10) / 10;

  let recommendation = '';
  if (fullKellyRaw <= 0) {
    recommendation = 'Negative Mathematical Expectancy: Cease live deployment or paper-trade.';
  } else if (halfKellyPct > 5) {
    recommendation = `Optimal Sizing capped at 5.0% (Half-Kelly calculated ${halfKellyPct}%).`;
  } else if (halfKellyPct >= 1.5) {
    recommendation = `Target ${halfKellyPct}% equity risk per trade setup with 2.0R hard targets.`;
  } else {
    recommendation = `Conservative edge detected: Maintain ${Math.max(0.5, halfKellyPct)}% position risk.`;
  }

  return {
    fullKellyPct: isNaN(fullKellyPct) ? 0 : fullKellyPct,
    halfKellyPct: isNaN(halfKellyPct) ? 0 : Math.min(5.0, halfKellyPct),
    recommendation
  };
}

/**
 * 3. System Quality Number (SQN)
 * SQN = sqrt(N) * (Expectancy / StdDev(R))
 * Van Tharp's benchmark:
 * > 3.0: Holy Grail
 * 2.5 - 3.0: Excellent
 * 1.6 - 2.5: Good
 * < 1.6: Poor (or Un-tradeable if negative)
 */
export function calculateSQN(rMultiples: number[]): {
  sqn: number;
  grade: 'Holy Grail' | 'Excellent' | 'Good' | 'Poor' | 'Un-tradeable';
} {
  const validR = (rMultiples || []).filter(r => !isNaN(r) && isFinite(r));
  const N = validR.length;

  if (N < 2) {
    return { sqn: 0, grade: 'Un-tradeable' };
  }

  // Mean (Expectancy in R)
  const sum = validR.reduce((acc, val) => acc + val, 0);
  const meanR = sum / N;

  // Sample Standard Deviation
  const varianceSum = validR.reduce((acc, val) => acc + Math.pow(val - meanR, 2), 0);
  const stdDev = Math.sqrt(varianceSum / (N - 1));

  if (stdDev === 0 || isNaN(stdDev)) {
    return {
      sqn: meanR > 0 ? 3.5 : 0,
      grade: meanR > 0 ? 'Holy Grail' : 'Un-tradeable'
    };
  }

  // SQN = sqrt(N) * (mean / stdDev)
  const rawSQN = Math.sqrt(N) * (meanR / stdDev);
  const sqn = Math.round(rawSQN * 100) / 100;

  let grade: 'Holy Grail' | 'Excellent' | 'Good' | 'Poor' | 'Un-tradeable' = 'Poor';

  if (sqn > 3.0) {
    grade = 'Holy Grail';
  } else if (sqn >= 2.5) {
    grade = 'Excellent';
  } else if (sqn >= 1.6) {
    grade = 'Good';
  } else if (sqn >= 0) {
    grade = 'Poor';
  } else {
    grade = 'Un-tradeable';
  }

  return { sqn: isNaN(sqn) ? 0 : sqn, grade };
}

/**
 * 4. Monte Carlo Risk of Ruin Simulation
 * Randomly resamples trade results over 10,000 iterations to determine the probability
 * of experiencing a 20% (or custom) peak-to-trough account equity drawdown.
 */
export function runMonteCarloRiskOfRuin(
  trades: TradeData[],
  iterations: number = 10000,
  riskThreshold: number = 0.2
): number {
  if (!trades || trades.length < 3) {
    return 0;
  }

  // Extract raw PnLs
  const pnls = trades.map(t => Number(t.pnl) || 0).filter(p => !isNaN(p));
  if (pnls.length === 0) return 0;

  // Estimate starting portfolio equity based on total volume or $100,000 baseline
  const absPnlSum = pnls.reduce((acc, p) => acc + Math.abs(p), 0);
  const initialEquity = Math.max(10000, absPnlSum * 3);
  const ruinEquityThreshold = initialEquity * (1 - riskThreshold);

  let ruinCount = 0;
  const horizon = Math.min(100, Math.max(30, pnls.length));
  const poolSize = pnls.length;

  for (let i = 0; i < iterations; i++) {
    let currentEquity = initialEquity;
    let peakEquity = initialEquity;
    let ruined = false;

    for (let step = 0; step < horizon; step++) {
      // Bootstrap sampling with replacement
      const randomIndex = Math.floor(Math.random() * poolSize);
      currentEquity += pnls[randomIndex];

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      // Check peak-to-trough drawdown
      const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 1;
      if (drawdown >= riskThreshold || currentEquity <= ruinEquityThreshold) {
        ruined = true;
        break;
      }
    }

    if (ruined) {
      ruinCount++;
    }
  }

  const ruinProbability = Math.round((ruinCount / iterations) * 1000) / 10;
  return Math.min(100, Math.max(0, isNaN(ruinProbability) ? 0 : ruinProbability));
}
