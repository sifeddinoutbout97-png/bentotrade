/**
 * BentoTrade v5.0 Quant Engine - Module 4: Guardrails & Behavioral Telemetry
 * Algorithmic auditor scanning trade execution logs for tilt, revenge trading, overtrading, and drawdown breaches.
 */

import { Trade } from '@/types';

export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type GuardrailAlertType = 
  | 'REVENGE_TRADING' 
  | 'POSITION_SPIKE' 
  | 'POOR_RR' 
  | 'DAILY_DRAWDOWN' 
  | 'OVERTRADING_VELOCITY';

export interface GuardrailAlert {
  id: string;
  type: GuardrailAlertType;
  severity: AlertSeverity;
  title: string;
  reason: string;
  metricBreached: string;
  timestamp?: string;
  tradeIds?: string[];
}

export interface TiltState {
  isLocked: boolean;
  title?: string;
  reason?: string;
  tiltType?: 'CONSECUTIVE_LOSSES' | 'DAILY_DRAWDOWN' | 'SIZE_ESCALATION';
  remainingSeconds: number; // e.g., 900 (15 minutes countdown)
  unlockTime?: string;
}

/**
 * Live predictive risk auditor run BEFORE a new trade execution.
 * Triggers a SYSTEM LOCKOUT if 3 consecutive losses occur within 20 mins or drawdown limit is breached.
 */
export function checkLiveTiltState(
  recentTrades: Trade[],
  accountBalance: number = 50000
): TiltState {
  if (!recentTrades || recentTrades.length === 0) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  // Sort trades chronologically newest to oldest
  const sortedNewestFirst = [...recentTrades].sort(
    (a, b) => new Date(b.trade_date || b.created_at).getTime() - new Date(a.trade_date || a.created_at).getTime()
  );

  const nowMs = Date.now();

  // --- Rule 1: 3 Consecutive Losses within a 20-minute window ---
  if (sortedNewestFirst.length >= 3) {
    const last3 = sortedNewestFirst.slice(0, 3);
    const all3AreLosses = last3.every(t => t.status === 'loss' || Number(t.pnl) < 0);

    if (all3AreLosses) {
      const newestMs = new Date(last3[0].trade_date || last3[0].created_at).getTime();
      const oldestMs = new Date(last3[2].trade_date || last3[2].created_at).getTime();
      const diffMinsBetweenLosses = Math.abs(newestMs - oldestMs) / (1000 * 60);

      // Check if the 3 losses happened within 20 mins of each other
      if (diffMinsBetweenLosses <= 20) {
        // Compute 15-minute cooldown from the latest loss timestamp
        const lockDurationMs = 15 * 60 * 1000;
        const lockExpiresMs = newestMs + lockDurationMs;
        const remainingSeconds = Math.max(10, Math.ceil((lockExpiresMs - nowMs) / 1000));

        // If lock period hasn't expired yet (or triggered in current session)
        if (remainingSeconds > 0) {
          return {
            isLocked: true,
            title: 'CRITICAL: TILT DETECTED',
            reason: '3 consecutive losses logged within a 20-minute window. SYSTEM LOCKOUT ENGAGED.',
            tiltType: 'CONSECUTIVE_LOSSES',
            remainingSeconds: remainingSeconds > 0 ? remainingSeconds : 900,
            unlockTime: new Date(nowMs + (remainingSeconds > 0 ? remainingSeconds : 900) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        }
      }
    }
  }

  // --- Rule 2: Daily Drawdown Limit Exceeded (-3% or -$500 threshold) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = sortedNewestFirst.filter(
    t => (t.trade_date || t.created_at || '').startsWith(todayStr)
  );

  if (todayTrades.length > 0) {
    const dailyNetPnL = todayTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
    const maxLossThreshold = Math.min(-500, -(accountBalance * 0.03));

    if (dailyNetPnL <= maxLossThreshold) {
      return {
        isLocked: true,
        title: 'CRITICAL: DAILY DRAWDOWN BREACH',
        reason: `Daily cumulative loss reached $${Math.abs(dailyNetPnL).toFixed(2)}, breaching maximum drawdown limit ($${Math.abs(maxLossThreshold).toFixed(2)}).`,
        tiltType: 'DAILY_DRAWDOWN',
        remainingSeconds: 900, // 15-minute lockout
        unlockTime: new Date(nowMs + 900 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Evaluates trade log history against quantitative behavioral guardrails
 */
export function evaluateGuardrails(
  trades: Trade[], 
  accountBalance: number = 50000
): GuardrailAlert[] {
  if (!trades || trades.length === 0) {
    return [];
  }

  const alerts: GuardrailAlert[] = [];

  // Sort trades chronologically (oldest to newest)
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date || a.created_at).getTime() - new Date(b.trade_date || b.created_at).getTime()
  );

  // --- 1. REVENGE TRADING & POSITION SPIKE DETECTION ---
  for (let i = 1; i < sorted.length; i++) {
    const prevTrade = sorted[i - 1];
    const currTrade = sorted[i];

    const prevLoss = prevTrade.status === 'loss' || Number(prevTrade.pnl) < 0;
    const currLoss = currTrade.status === 'loss' || Number(currTrade.pnl) < 0;

    const prevTime = new Date(prevTrade.trade_date || prevTrade.created_at).getTime();
    const currTime = new Date(currTrade.trade_date || currTrade.created_at).getTime();
    const timeDiffMinutes = (currTime - prevTime) / (1000 * 60);

    // Rule 1A: Rapid Consecutive Losses (< 15 mins after loss)
    if (prevLoss && currLoss && timeDiffMinutes >= 0 && timeDiffMinutes < 15) {
      alerts.push({
        id: `revenge-rapid-${currTrade.id}`,
        type: 'REVENGE_TRADING',
        severity: 'CRITICAL',
        title: 'Revenge Trading Alert (Rapid Re-Entry)',
        reason: `Consecutive loss logged on ${currTrade.ticker} within ${Math.round(timeDiffMinutes)} minutes of previous losing trade.`,
        metricBreached: `Time delta = ${timeDiffMinutes.toFixed(1)} mins (< 15m threshold)`,
        timestamp: currTrade.trade_date || currTrade.created_at,
        tradeIds: [prevTrade.id, currTrade.id]
      });
    }

    // Rule 1B: Position Size Spike After Loss (> 50% increase)
    const prevSize = Number(prevTrade.position_size) || 1;
    const currSize = Number(currTrade.position_size) || 1;
    const sizeIncreasePct = ((currSize - prevSize) / prevSize) * 100;

    if (prevLoss && sizeIncreasePct >= 50) {
      alerts.push({
        id: `position-spike-${currTrade.id}`,
        type: 'POSITION_SPIKE',
        severity: 'CRITICAL',
        title: 'Position Size Spike (Tilt Escalation)',
        reason: `Position size increased by +${Math.round(sizeIncreasePct)}% on ${currTrade.ticker} immediately following a loss.`,
        metricBreached: `Size increase = +${sizeIncreasePct.toFixed(1)}% (>= +50% threshold)`,
        timestamp: currTrade.trade_date || currTrade.created_at,
        tradeIds: [prevTrade.id, currTrade.id]
      });
    }
  }

  // --- 2. POOR RISK:REWARD EXECUTION ---
  for (const trade of sorted) {
    const rRatio = Number(trade.risk_reward_ratio);
    
    // Check if explicitly planned R:R or realized R:R is less than 1.2
    if (!isNaN(rRatio) && rRatio > 0 && rRatio < 1.2) {
      alerts.push({
        id: `poor-rr-${trade.id}`,
        type: 'POOR_RR',
        severity: 'WARNING',
        title: 'Sub-Optimal Risk:Reward Ratio',
        reason: `Execution on ${trade.ticker} set or realized an R:R ratio of 1:${rRatio.toFixed(2)}, breaching institutional 1:1.2 baseline.`,
        metricBreached: `R:R = 1:${rRatio.toFixed(2)} (< 1:1.20 target)`,
        timestamp: trade.trade_date || trade.created_at,
        tradeIds: [trade.id]
      });
    }
  }

  // --- 3. OVERTRADING & DAILY DRAWDOWN BREACH ---
  // Group trades by date (YYYY-MM-DD)
  const tradesByDateMap = new Map<string, Trade[]>();
  for (const trade of sorted) {
    const dateKey = (trade.trade_date || trade.created_at || '').split('T')[0] || '1970-01-01';
    if (!tradesByDateMap.has(dateKey)) {
      tradesByDateMap.set(dateKey, []);
    }
    tradesByDateMap.get(dateKey)!.push(trade);
  }

  const maxDailyDrawdownPctThreshold = 3.0; // 3% daily drawdown limit
  const maxExecutionsPerSessionThreshold = 6;  // 6 trades per session limit

  for (const [dateKey, dayTrades] of tradesByDateMap.entries()) {
    // 3A: Daily Execution Velocity Guard
    if (dayTrades.length > maxExecutionsPerSessionThreshold) {
      alerts.push({
        id: `overtrading-${dateKey}`,
        type: 'OVERTRADING_VELOCITY',
        severity: 'WARNING',
        title: 'High Execution Velocity (Overtrading)',
        reason: `${dayTrades.length} trade executions logged on ${dateKey}, exceeding daily session limit of ${maxExecutionsPerSessionThreshold}.`,
        metricBreached: `Daily Executions = ${dayTrades.length} (limit = ${maxExecutionsPerSessionThreshold})`,
        timestamp: dateKey,
        tradeIds: dayTrades.map(t => t.id)
      });
    }

    // 3B: Cumulative Daily Drawdown Guard
    let dailyNetPnL = 0;
    let maxIntradayDrawdown = 0;
    let peakEquity = 0;

    for (const t of dayTrades) {
      dailyNetPnL += (Number(t.pnl) || 0);
      if (dailyNetPnL > peakEquity) {
        peakEquity = dailyNetPnL;
      }
      const currentDD = peakEquity - dailyNetPnL;
      if (currentDD > maxIntradayDrawdown) {
        maxIntradayDrawdown = currentDD;
      }
    }

    const netLossPct = (Math.abs(Math.min(0, dailyNetPnL)) / accountBalance) * 100;
    const maxDDPct = (maxIntradayDrawdown / accountBalance) * 100;

    if (netLossPct >= maxDailyDrawdownPctThreshold || maxDDPct >= maxDailyDrawdownPctThreshold) {
      alerts.push({
        id: `daily-drawdown-${dateKey}`,
        type: 'DAILY_DRAWDOWN',
        severity: 'CRITICAL',
        title: 'Daily Drawdown Guardrail Triggered',
        reason: `Cumulative daily drawdown reached -${maxDDPct.toFixed(2)}% (-$${maxIntradayDrawdown.toFixed(2)}) on ${dateKey}.`,
        metricBreached: `Daily Drawdown = -${maxDDPct.toFixed(2)}% (>= -${maxDailyDrawdownPctThreshold}% limit)`,
        timestamp: dateKey,
        tradeIds: dayTrades.map(t => t.id)
      });
    }
  }

  // De-duplicate alerts by ID and return sorted by severity (CRITICAL first)
  const uniqueMap = new Map<string, GuardrailAlert>();
  for (const alert of alerts) {
    uniqueMap.set(alert.id, alert);
  }

  return Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
    return 0;
  });
}
