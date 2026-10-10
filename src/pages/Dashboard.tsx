/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Activity, 
  PlusCircle, 
  Percent, 
  ShieldCheck, 
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useTrades } from '@/context/TradeContext';
import { AIPerformanceEngine } from '@/components/AIPerformanceEngine';
import { DynamicAIDirective } from '@/components/dashboard/DynamicAIDirective';
import { LiveTape } from '@/components/dashboard/LiveTape';
import { QuickExecutionPad } from '@/components/dashboard/QuickExecutionPad';
import { motion } from 'motion/react';

// Sleek dark-themed tooltip for Equity Performance
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isPositiveEquity = data.equity >= 0;
  const isPositiveTrade = data.tradePnl >= 0;

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl p-3.5 shadow-2xl text-white font-mono min-w-[200px] space-y-2 z-50">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[10px] text-zinc-400">
        <span className="font-semibold text-zinc-300">{data.date}</span>
        <span className="font-bold text-white uppercase tracking-wider">${data.ticker}</span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[10px] uppercase">Cum. Equity:</span>
          <span className={cn(
            "font-bold font-mono tracking-tight",
            isPositiveEquity 
              ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" 
              : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
          )}>
            {isPositiveEquity 
              ? `+$${data.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : `-$${Math.abs(data.equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[10px] uppercase">Trade P&L:</span>
          <span className={cn(
            "font-semibold font-mono",
            isPositiveTrade 
              ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" 
              : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
          )}>
            {isPositiveTrade ? `+$${data.tradePnl.toFixed(2)}` : `-$${Math.abs(data.tradePnl).toFixed(2)}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { trades, loading, isConnected } = useTrades();

  // Summary calculations
  const summary = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    const netPnl = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const winCount = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0).length;
    const lossCount = trades.filter(t => t.status === 'loss' || Number(t.pnl) < 0).length;
    const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
    
    const winners = trades.filter(t => (t.status === 'win' || Number(t.pnl) > 0) && Number(t.pnl) > 0);
    const losers = trades.filter(t => (t.status === 'loss' || Number(t.pnl) < 0) && Number(t.pnl) < 0);
    
    const grossProfit = winners.reduce((sum, t) => sum + Number(t.pnl), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + Number(t.pnl), 0));
    
    const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
    const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
    const rr = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 2.5 : 0);
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 9.99 : 0);
    
    // Mathematical expectancy per trade
    const pWin = winRate / 100;
    const pLoss = 1 - pWin;
    const expectancy = (pWin * avgWin) - (pLoss * avgLoss);

    return { 
      netPnl, 
      winRate, 
      rr, 
      totalTrades: trades.length, 
      winCount, 
      lossCount,
      grossProfit,
      grossLoss,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy
    };
  }, [trades]);

  // Compute smooth cumulative equity curve data
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    let runningEquity = 0;
    return [...trades]
      .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime())
      .map((t) => {
        const tradePnl = Number(t.pnl) || 0;
        runningEquity += tradePnl;
        return {
          date: new Date(t.trade_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          tradePnl,
          equity: runningEquity,
          ticker: t.ticker?.toUpperCase() || 'TRADE'
        };
      });
  }, [trades]);

  // Clean abbreviated Y-axis formatter
  const formatYAxis = (val: number) => {
    if (val === 0) return '$0';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  const isNetPositive = summary ? summary.netPnl >= 0 : true;

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-[85vh] rounded-2xl p-4 sm:p-6 md:p-8 space-y-6 text-white border border-white/5 animate-in fade-in duration-300">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 bg-white/5 rounded-xl" />
            <Skeleton className="h-4 w-72 bg-white/5 rounded-md" />
          </div>
        </header>

        {/* Bento skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          <Skeleton className="lg:col-span-12 h-20 rounded-2xl bg-white/5" />
          <Skeleton className="lg:col-span-8 lg:row-span-2 h-[380px] rounded-2xl bg-white/5" />
          <Skeleton className="lg:col-span-4 h-[180px] rounded-2xl bg-white/5" />
          <Skeleton className="lg:col-span-4 h-[180px] rounded-2xl bg-white/5" />
          <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl bg-white/5" />
          <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] text-white -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 min-h-full rounded-none md:rounded-3xl border-0 md:border md:border-white/5 animate-in fade-in duration-500 space-y-6">
      {/* 1. Institutional Terminal Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              TERMINAL // v5 PRO
            </h1>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 font-mono ring-1",
              isConnected 
                ? "ring-emerald-500/30 bg-emerald-500/10 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" 
                : "ring-white/10 bg-white/5 text-zinc-400"
            )}>
              <span className="relative flex h-2 w-2">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isConnected ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-400")}></span>
              </span>
              {isConnected ? "Realtime Active" : "Telemetry Synced"}
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm font-mono">
            Asymmetric Bento Box institutional telemetry & automated execution edge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/journal">
            <button className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white ring-1 ring-white/10 transition-all flex items-center gap-1.5 hover:-translate-y-0.5">
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Journal</span>
            </button>
          </Link>
        </div>
      </header>

      {/* 2. Top Banner: Dynamic AI Directive */}
      <DynamicAIDirective trades={trades || []} />

      {/* 3. True Asymmetric Bento Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        
        {/* HERO COMPONENT: Equity Curve (Spans 8 columns on desktop) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl group">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <h2 className="text-xs sm:text-sm font-mono font-bold text-white uppercase tracking-[0.18em]">
                  Hero Equity Curve
                </h2>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Compounding
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                Cumulative closed-trade compounding telemetry
              </p>
            </div>
            
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Net Cumulative Return
              </span>
              <span className={cn(
                "text-lg sm:text-xl font-black font-mono tracking-tight",
                (summary?.netPnl || 0) >= 0 
                  ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" 
                  : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
              )}>
                {(summary?.netPnl || 0) >= 0 
                  ? `+$${(summary?.netPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : `-$${Math.abs(summary?.netPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>

          {/* Chart Container strictly wrapped with defined height (Rule 4) */}
          <div className="h-[320px] sm:h-[360px] min-h-[320px] w-full mt-auto">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/10 rounded-xl space-y-2">
                <TrendingUp className="w-8 h-8 text-zinc-500" />
                <p className="text-xs font-mono text-zinc-400">Equity curve initializes upon first closed trade</p>
                <p className="text-[10px] font-mono text-zinc-500">Use the Quick Execution Pad below to log an entry</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="45%" stopColor="#10b981" stopOpacity={0.10} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="rgba(255,255,255,0.06)" 
                  />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }}
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }}
                    tickFormatter={formatYAxis}
                    dx={-4}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#34d399" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#equityGradient)" 
                    activeDot={{ r: 5, fill: '#34d399', stroke: '#0a0a0a', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* FLANKING COMPACT KPI CARDS (Spans 4 columns on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5 justify-between">
          
          {/* KPI Card 1: Total Net Realized PnL */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.18em]">
                Total Net Realized P/L
              </span>
              <div className="w-7 h-7 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-zinc-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="my-3">
              <div className={cn(
                "text-2xl sm:text-3xl font-black font-mono tracking-tight",
                isNetPositive 
                  ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" 
                  : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
              )}>
                {summary 
                  ? (summary.netPnl >= 0 
                      ? `+$${summary.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : `-$${Math.abs(summary.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : '$0.00'}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                {summary ? `${summary.totalTrades} closed executions · Realized Net` : 'Awaiting executions'}
              </p>
            </div>

            {/* Micro Gross breakdown */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-zinc-400 block uppercase">Gross Gain:</span>
                <span className="text-emerald-400 font-bold">
                  +${(summary?.grossProfit || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block uppercase">Gross Loss:</span>
                <span className="text-rose-400 font-bold">
                  -${(summary?.grossLoss || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Card 2: Win Rate & Efficiency */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.18em]">
                Win Rate & Payoff Ratio
              </span>
              <div className="w-7 h-7 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-zinc-400">
                <Target className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="my-3 flex items-baseline justify-between">
              <div>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                  {summary ? `${summary.winRate.toFixed(1)}%` : '0.0%'}
                </div>
                <p className="text-[11px] font-mono text-zinc-400 mt-1">
                  {summary ? `${summary.winCount}W / ${summary.lossCount}L recorded ratio` : 'Historical sample'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Reward/Risk
                </span>
                <span className="text-lg font-bold font-mono text-white">
                  {summary ? `${summary.rr.toFixed(2)}R` : '0.00R'}
                </span>
              </div>
            </div>

            {/* Expectancy & Profit factor footer */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-zinc-400 block uppercase">Profit Factor:</span>
                <span className="text-white font-bold">
                  {summary ? `${summary.profitFactor.toFixed(2)}` : '0.00'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block uppercase">Expectancy:</span>
                <span className={cn(
                  "font-bold",
                  (summary?.expectancy || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {(summary?.expectancy || 0) >= 0 ? `+$${(summary?.expectancy || 0).toFixed(2)}` : `-$${Math.abs(summary?.expectancy || 0).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2 ACTIONABLE WIDGETS */}
        
        {/* Quick Execution Pad (Spans 6 cols on md, 4 cols on lg) */}
        <div className="md:col-span-1 lg:col-span-4 flex flex-col">
          <QuickExecutionPad className="h-full" />
        </div>

        {/* Live Tape Feed (Spans 6 cols on md, 4 cols on lg) */}
        <div className="md:col-span-1 lg:col-span-4 flex flex-col">
          <LiveTape trades={trades || []} className="h-full" />
        </div>

        {/* Institutional Risk Architecture Card (Spans 4 cols on lg) */}
        <div className="md:col-span-2 lg:col-span-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-white">
                  Risk Architecture
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div className="mt-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Max Drawdown Limit:</span>
                <span className="text-white font-bold">-2.5% / Session</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Position Sizing Protocol:</span>
                <span className="text-white font-bold">Kelly 0.5x Fractional</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">R:R Target Standard:</span>
                <span className="text-white font-bold">1:2.0 Minimum</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Re-entry Cooldown:</span>
                <span className="text-white font-bold">15m Post-Stop</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Terminal Guard Status</span>
            <span className="text-emerald-400 font-bold">100% Calibrated</span>
          </div>
        </div>

        {/* ROW 3: AI PERFORMANCE ENGINE (Spans full 12 columns) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-12">
          <AIPerformanceEngine trades={trades || []} className="w-full" />
        </div>

      </div>
    </div>
  );
};
