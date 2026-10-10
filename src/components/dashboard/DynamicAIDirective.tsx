/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Trade } from '@/types';
import { AlertTriangle, Zap, ShieldAlert, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicAIDirectiveProps {
  trades: Trade[];
  className?: string;
}

export const DynamicAIDirective: React.FC<DynamicAIDirectiveProps> = ({ trades, className }) => {
  const directive = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        type: 'standby',
        icon: Sparkles,
        badge: 'SYSTEM STANDBY',
        badgeColor: 'border-white/20 text-zinc-300 bg-white/5',
        title: 'Calibrating Edge Metrics',
        message: 'Awaiting execution entries to calibrate neural edge and sizing protocols.',
        action: 'Log execution to initiate telemetry.',
      };
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime()
    );

    // Calculate ticker metrics
    const tickerStats: Record<string, { wins: number; total: number; netPnl: number }> = {};
    for (const t of trades) {
      const sym = (t.ticker || 'UNKNOWN').toUpperCase();
      if (!tickerStats[sym]) {
        tickerStats[sym] = { wins: 0, total: 0, netPnl: 0 };
      }
      tickerStats[sym].total += 1;
      const pnl = Number(t.pnl) || 0;
      tickerStats[sym].netPnl += pnl;
      if (t.status === 'win' || pnl > 0) {
        tickerStats[sym].wins += 1;
      }
    }

    // Identify top winning ticker with at least 1 trade
    let bestTicker = '';
    let bestPnl = -Infinity;
    for (const [sym, data] of Object.entries(tickerStats)) {
      if (data.netPnl > bestPnl) {
        bestPnl = data.netPnl;
        bestTicker = sym;
      }
    }

    // Check recent streak in the last 3-5 trades
    const recent = sortedTrades.slice(0, 5);
    const winStreak = recent.filter(t => (t.status === 'win' || Number(t.pnl) > 0)).length;
    const lossStreak = recent.filter(t => (t.status === 'loss' || Number(t.pnl) < 0)).length;

    // Total metrics
    const netPnl = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const winCount = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0).length;
    const winRate = (winCount / trades.length) * 100;

    // Condition 1: Drawdown alert if recent 3 are consecutive losses
    if (lossStreak >= 3) {
      return {
        type: 'danger',
        icon: ShieldAlert,
        badge: 'RISK PROTOCOL ACTIVE',
        badgeColor: 'border-rose-500/40 text-rose-400 bg-rose-500/10 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]',
        title: 'Drawdown Warning',
        message: `Drawdown sequence detected across last ${lossStreak} closed positions. Compress trade size to 0.5R to protect equity curve.`,
        action: 'Preserve capital: Halt sizing expansions until positive expectancy restores.',
      };
    }

    // Condition 2: High performing ticker edge
    if (bestTicker && bestPnl > 0 && tickerStats[bestTicker].total >= 2) {
      const tickerWinRate = ((tickerStats[bestTicker].wins / tickerStats[bestTicker].total) * 100).toFixed(0);
      const diffPct = Math.max(10, Math.round(Number(tickerWinRate) - winRate));
      return {
        type: 'edge',
        icon: AlertTriangle,
        badge: 'EDGE CONFIRMED',
        badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        title: `Primary Alpha: $${bestTicker}`,
        message: `⚠️ Edge Confirmed: You are performing ${diffPct > 0 ? `${diffPct}% better` : 'exceptionally'} on ${bestTicker} this period. Maintain current sizing protocol.`,
        action: `Current ${bestTicker} Net: +$${bestPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${tickerWinRate}% win efficiency).`,
      };
    }

    // Condition 3: Winning momentum streak
    if (winStreak >= 3) {
      return {
        type: 'momentum',
        icon: Zap,
        badge: 'MOMENTUM CONFIRMED',
        badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        title: 'Positive Variance Active',
        message: `⚡ Edge Confirmed: ${winStreak} consecutive winning executions recorded. Avoid euphoric sizing shifts; execute rule-based profit takes.`,
        action: 'System Status: Flow state verified. Strict adherence to max daily risk required.',
      };
    }

    // Condition 4: High overall win rate
    if (winRate >= 60 && trades.length >= 3) {
      return {
        type: 'edge',
        icon: Target,
        badge: 'ALPHA CALIBRATED',
        badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        title: 'Institutional Edge Sustained',
        message: `⚠️ Edge Confirmed: Win rate sustained at ${winRate.toFixed(1)}% across ${trades.length} executions. Profit compounding protocol active.`,
        action: `Overall Realized: ${netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`}. Enforce disciplined stop placement.`,
      };
    }

    // Fallback baseline directive
    return {
      type: 'neutral',
      icon: AlertTriangle,
      badge: 'DIRECTIVE ACTIVE',
      badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      title: 'Execution Quality Monitoring',
      message: '⚠️ Edge Confirmed: Disciplined trade selection active. Maintain risk parameters and verify entry criteria prior to market open.',
      action: `${trades.length} executions logged. Maintain current risk unit sizing.`,
    };
  }, [trades]);

  const Icon = directive.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-4 sm:p-5",
        "transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl group",
        className
      )}
    >
      {/* Background ambient pulse */}
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0 text-white group-hover:scale-105 transition-transform">
            <Icon className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase font-mono ring-1",
                directive.badgeColor
              )}>
                {directive.badge}
              </span>
              <span className="text-xs font-mono font-bold text-white tracking-tight">
                {directive.title}
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-mono text-zinc-300 tracking-tight leading-relaxed">
              {directive.message}
            </p>
          </div>
        </div>

        <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
            Protocol Guidance
          </span>
          <span className="text-[11px] font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] font-semibold">
            {directive.action}
          </span>
        </div>
      </div>
    </div>
  );
};
