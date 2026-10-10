/**
 * BentoTrade v5.5 Institutional Quant Engine Web Worker
 * Offloads compute-intensive quant metrics, drawdowns, and 10,000-path Monte Carlo simulations
 */

import { 
  TradeData, 
  DrawdownResult, 
  MonteCarloSimulationParams, 
  MonteCarloSimulationResult,
  QuantWorkerRequest,
  QuantWorkerResponse
} from '../types';

/**
 * Calculates Sharpe Ratio from returns
 */
function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (!returns || returns.length < 2) return 0;

  const n = returns.length;
  const mean = returns.reduce((acc, val) => acc + val, 0) / n;
  const variance = returns.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const tradeSharpe = (mean - riskFreeRate) / stdDev;
  return Number((tradeSharpe * Math.sqrt(Math.min(252, n))).toFixed(2));
}

/**
 * Calculates Maximum Drawdown and associated turning points
 */
function calculateMaxDrawdown(equityCurve: number[]): DrawdownResult {
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
 * Runs high-performance Monte Carlo Simulation (default 10,000 equity curve paths)
 * Evaluates risk of ruin, percentile equity distributions, and tail-risk drawdowns.
 */
function runMonteCarloRiskOfRuin(params: MonteCarloSimulationParams = {}): MonteCarloSimulationResult {
  const {
    trades = [],
    initialCapital = 50000,
    simulations = 10000,
    tradesPerSimulation = 100,
    ruinThresholdPct = 50 // Ruined if account loses 50% or more
  } = params;

  let tradePnLs: number[] = [];

  if (trades && trades.length >= 5) {
    tradePnLs = trades.map(t => t.pnl);
  } else {
    // Generate synthetic distribution using given or default stats
    const winRate = params.winRate ?? 0.55;
    const avgWin = params.avgWin ?? 420;
    const avgLoss = params.avgLoss ?? 260;

    for (let i = 0; i < 200; i++) {
      if (Math.random() < winRate) {
        tradePnLs.push(avgWin * (0.8 + Math.random() * 0.4));
      } else {
        tradePnLs.push(-avgLoss * (0.8 + Math.random() * 0.4));
      }
    }
  }

  const pnlLength = tradePnLs.length;
  const ruinEquity = initialCapital * (1 - ruinThresholdPct / 100);

  let ruinedCount = 0;
  const finalEquities: number[] = new Array(simulations);
  let worstDrawdownPct = 0;

  // Collect a few representative sample paths for charting
  const samplePaths: Array<{ index: number; equity: number }[]> = [];
  const sampleIndices = new Set([0, 10, 50, 100, 500]);

  for (let s = 0; s < simulations; s++) {
    let currentEquity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdownInPath = 0;
    let isRuined = false;

    const recordSample = sampleIndices.has(s);
    const pathPoints: { index: number; equity: number }[] = recordSample ? [{ index: 0, equity: initialCapital }] : [];

    for (let t = 0; t < tradesPerSimulation; t++) {
      // Fast pseudorandom sampling with replacement
      const randomIndex = (Math.random() * pnlLength) | 0;
      const pnl = tradePnLs[randomIndex];
      currentEquity += pnl;

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      } else {
        const dd = peakEquity - currentEquity;
        if (dd > maxDrawdownInPath) {
          maxDrawdownInPath = dd;
        }
      }

      if (currentEquity <= ruinEquity && !isRuined) {
        isRuined = true;
      }

      if (recordSample) {
        pathPoints.push({ index: t + 1, equity: Math.round(currentEquity) });
      }
    }

    if (isRuined) {
      ruinedCount++;
    }

    const ddPct = peakEquity > 0 ? (maxDrawdownInPath / peakEquity) * 100 : 0;
    if (ddPct > worstDrawdownPct) {
      worstDrawdownPct = ddPct;
    }

    finalEquities[s] = currentEquity;

    if (recordSample) {
      samplePaths.push(pathPoints);
    }
  }

  // Sort final equities to calculate percentiles
  finalEquities.sort((a, b) => a - b);

  const medianIndex = Math.floor(simulations * 0.5);
  const tenthIndex = Math.floor(simulations * 0.1);
  const ninetiethIndex = Math.floor(simulations * 0.9);

  const riskOfRuinPct = Number(((ruinedCount / simulations) * 100).toFixed(2));

  return {
    simulationsRun: simulations,
    tradesPerPath: tradesPerSimulation,
    riskOfRuinPct,
    medianFinalEquity: Math.round(finalEquities[medianIndex]),
    tenthPercentileEquity: Math.round(finalEquities[tenthIndex]),
    ninetiethPercentileEquity: Math.round(finalEquities[ninetiethIndex]),
    worstMaxDrawdownPct: Number(worstDrawdownPct.toFixed(1)),
    samplePaths
  };
}

// Web Worker message listener
self.onmessage = (event: MessageEvent<QuantWorkerRequest>) => {
  const { id, type, payload } = event.data;
  const startTime = performance.now();

  try {
    let result: any = null;

    switch (type) {
      case 'CALCULATE_SHARPE': {
        const { returns, riskFreeRate } = payload || {};
        result = calculateSharpeRatio(returns || [], riskFreeRate || 0);
        break;
      }

      case 'CALCULATE_MAX_DRAWDOWN': {
        const { equityCurve } = payload || {};
        result = calculateMaxDrawdown(equityCurve || []);
        break;
      }

      case 'RUN_MONTE_CARLO': {
        result = runMonteCarloRiskOfRuin(payload || {});
        break;
      }

      default:
        throw new Error(`Unknown QuantWorker Task Type: ${type}`);
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    const response: QuantWorkerResponse = {
      id,
      type,
      success: true,
      result,
      executionTimeMs
    };

    self.postMessage(response);
  } catch (err: any) {
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    const response: QuantWorkerResponse = {
      id,
      type,
      success: false,
      error: err?.message || 'Quant calculation failed',
      executionTimeMs
    };

    self.postMessage(response);
  }
};
