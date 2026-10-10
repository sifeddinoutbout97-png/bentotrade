/**
 * Web Worker for Monte Carlo Risk of Ruin & Quantitative Computations
 * Offloads 10,000-iteration bootstrapping off the main thread to maintain 60 FPS UI rendering.
 */

export interface MonteCarloWorkerPayload {
  pnls: number[];
  iterations?: number;
  riskThreshold?: number;
}

export interface MonteCarloWorkerResult {
  ruinProbability: number;
  medianDrawdown: number;
  maxDrawdown: number;
  pathsSampled: number;
  calculatedAt: number;
}

self.onmessage = (event: MessageEvent<MonteCarloWorkerPayload>) => {
  const { pnls = [], iterations = 10000, riskThreshold = 0.2 } = event.data;

  if (!pnls || pnls.length < 3) {
    const fallbackResult: MonteCarloWorkerResult = {
      ruinProbability: 0,
      medianDrawdown: 0,
      maxDrawdown: 0,
      pathsSampled: 0,
      calculatedAt: Date.now()
    };
    self.postMessage(fallbackResult);
    return;
  }

  const validPnls = pnls.filter(p => !isNaN(p) && isFinite(p));
  const absPnlSum = validPnls.reduce((acc, p) => acc + Math.abs(p), 0);
  const initialEquity = Math.max(10000, absPnlSum * 3);
  const ruinEquityThreshold = initialEquity * (1 - riskThreshold);

  let ruinCount = 0;
  let overallMaxDrawdown = 0;
  const drawdowns: number[] = [];
  const horizon = Math.min(100, Math.max(30, validPnls.length));
  const poolSize = validPnls.length;

  for (let i = 0; i < iterations; i++) {
    let currentEquity = initialEquity;
    let peakEquity = initialEquity;
    let pathMaxDrawdown = 0;
    let ruined = false;

    for (let step = 0; step < horizon; step++) {
      // Fast pseudorandom uniform index
      const randomIndex = (Math.random() * poolSize) | 0;
      currentEquity += validPnls[randomIndex];

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 1;
      if (drawdown > pathMaxDrawdown) {
        pathMaxDrawdown = drawdown;
      }

      if (drawdown >= riskThreshold || currentEquity <= ruinEquityThreshold) {
        ruined = true;
        break;
      }
    }

    if (ruined) {
      ruinCount++;
    }

    if (pathMaxDrawdown > overallMaxDrawdown) {
      overallMaxDrawdown = pathMaxDrawdown;
    }

    // Keep sample drawdowns for median calculation
    if (i < 1000) {
      drawdowns.push(pathMaxDrawdown);
    }
  }

  drawdowns.sort((a, b) => a - b);
  const medianDrawdown = drawdowns.length > 0 
    ? Math.round(drawdowns[Math.floor(drawdowns.length / 2)] * 1000) / 10 
    : 0;

  const ruinProbability = Math.round((ruinCount / iterations) * 1000) / 10;

  const result: MonteCarloWorkerResult = {
    ruinProbability: Math.min(100, Math.max(0, isNaN(ruinProbability) ? 0 : ruinProbability)),
    medianDrawdown,
    maxDrawdown: Math.round(overallMaxDrawdown * 1000) / 10,
    pathsSampled: iterations,
    calculatedAt: Date.now()
  };

  self.postMessage(result);
};
