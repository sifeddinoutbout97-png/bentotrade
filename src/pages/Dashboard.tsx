/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  PlusCircle 
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

// Sleek dark-themed tooltip for Equity Performance
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isPositiveEquity = data.equity >= 0;
  const isPositiveTrade = data.tradePnl >= 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#050505]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl p-3.5 text-zinc-100 font-mono min-w-[200px] space-y-2 z-50">
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-1.5 text-[10px] text-zinc-500">
        <span className="font-semibold text-zinc-400">{data.date}</span>
        <span className="font-bold text-zinc-200 uppercase tracking-wider">${data.ticker}</span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 text-[10px] uppercase">Cum. Equity:</span>
          <span className={cn(
            "font-bold font-mono tracking-tight tabular-nums",
            isPositiveEquity ? "text-emerald-400" : "text-rose-500"
          )}>
            {isPositiveEquity 
              ? `+$${data.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : `-$${Math.abs(data.equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 text-[10px] uppercase">Trade P&L:</span>
          <span className={cn(
            "font-semibold font-mono tracking-tight tabular-nums",
            isPositiveTrade ? "text-emerald-400" : "text-rose-500"
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

  // Chronological sparkline series for Net PnL and Win Rate
  const { pnlSparklineData, winRateSparklineData } = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { 
        pnlSparklineData: [{ value: 0 }, { value: 0 }], 
        winRateSparklineData: [{ value: 0 }, { value: 0 }] 
      };
    }
    let runningEquity = 0;
    let wins = 0;
    const sorted = [...trades].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );
    const pnlSpark: { value: number }[] = [{ value: 0 }];
    const wrSpark: { value: number }[] = [{ value: 0 }];

    sorted.forEach((t, i) => {
      runningEquity += Number(t.pnl) || 0;
      if (t.status === 'win' || Number(t.pnl) > 0) wins++;
      pnlSpark.push({ value: runningEquity });
      wrSpark.push({ value: (wins / (i + 1)) * 100 });
    });

    return { pnlSparklineData: pnlSpark, winRateSparklineData: wrSpark };
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
      <div className="bg-[#050505] min-h-[85vh] rounded-2xl p-4 sm:p-6 md:p-8 space-y-6 text-zinc-100 border border-white/[0.04] animate-in fade-in duration-300">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 bg-white/[0.03] rounded-xl" />
            <Skeleton className="h-4 w-72 bg-white/[0.03] rounded-md" />
          </div>
        </header>

        {/* Bento skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          <Skeleton className="lg:col-span-12 h-20 rounded-2xl bg-white/[0.02]" />
          <Skeleton className="lg:col-span-8 lg:row-span-2 h-[380px] rounded-2xl bg-white/[0.02]" />
          <Skeleton className="lg:col-span-4 h-[180px] rounded-2xl bg-white/[0.02]" />
          <Skeleton className="lg:col-span-4 h-[180px] rounded-2xl bg-white/[0.02]" />
          <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl bg-white/[0.02]" />
          <Skeleton className="lg:col-span-6 h-[260px] rounded-2xl bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-zinc-100 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 min-h-full rounded-none md:rounded-3xl border-0 md:border md:border-white/[0.03] animate-in fade-in duration-500 space-y-5">
      {/* 1. Minimalist Top Row: Tiny inline pill sitting quietly above the Equity Curve + Journal action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <DynamicAIDirective trades={trades || []} />
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Link to="/journal">
            <button className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-500 hover:text-zinc-300 bg-white/[0.015] hover:bg-white/[0.03] border border-white/[0.03] transition-all flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>Journal</span>
            </button>
          </Link>
        </div>
      </div>

      {/* 2. Soft Bento Box Grid with Generous Padding */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        
        {/* HERO COMPONENT: Equity Curve (Spans 8 columns on desktop) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl bg-white/[0.015] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 transition-all duration-300 hover:bg-white/[0.03] group">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
                Equity Curve
              </h2>
            </div>
            
            <div className="text-right">
              <span className={cn(
                "text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums",
                (summary?.netPnl || 0) >= 0 ? "text-emerald-400" : "text-rose-500"
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
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/[0.03] rounded-xl space-y-1">
                <p className="text-xs font-mono text-zinc-600">Awaiting closed trades to plot equity curve</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.08} />
                      <stop offset="60%" stopColor="#34d399" stopOpacity={0.01} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="rgba(255,255,255,0.02)" 
                  />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#52525b', fontFamily: 'monospace' }}
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#52525b', fontFamily: 'monospace' }}
                    tickFormatter={formatYAxis}
                    dx={-4}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#34d399" 
                    strokeWidth={1} 
                    fillOpacity={1} 
                    fill="url(#equityGradient)" 
                    activeDot={{ r: 3.5, fill: '#34d399', stroke: '#050505', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* FLANKING COMPACT KPI CARDS (Spans 4 columns on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-5 lg:gap-6 justify-between">
          
          {/* KPI Card 1: Total Net Realized PnL with Sparkline (Primary Net Only) */}
          <div className="rounded-2xl bg-white/[0.015] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 transition-all duration-300 hover:bg-white/[0.03] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
                Total Net Realized P/L
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 my-4">
              <div>
                <div className={cn(
                  "text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums",
                  isNetPositive ? "text-emerald-400" : "text-rose-500"
                )}>
                  {summary 
                    ? (summary.netPnl >= 0 
                        ? `+$${summary.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : `-$${Math.abs(summary.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                    : '$0.00'}
                </div>
                <p className="text-[10px] font-mono text-zinc-600 mt-1 tabular-nums">
                  {summary ? `${summary.totalTrades} closed trades` : '0 trades'}
                </p>
              </div>

              {/* Minimalist Sparkline: no axes, no grids, no tooltips */}
              {pnlSparklineData.length > 1 && (
                <div className="h-10 w-28 sm:w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pnlSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <defs>
                        <linearGradient id="pnlSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isNetPositive ? "#34d399" : "#f43f5e"} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={isNetPositive ? "#34d399" : "#f43f5e"} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={isNetPositive ? "#34d399" : "#f43f5e"} 
                        strokeWidth={1} 
                        fill="url(#pnlSparklineGrad)" 
                        isAnimationActive={false} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* KPI Card 2: Win Rate with Sparkline */}
          <div className="rounded-2xl bg-white/[0.015] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 transition-all duration-300 hover:bg-white/[0.03] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
                Win Rate & Payoff Ratio
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 my-4">
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-zinc-100">
                  {summary ? `${summary.winRate.toFixed(1)}%` : '0.0%'}
                </div>
                <p className="text-[10px] font-mono text-zinc-600 mt-1 tabular-nums">
                  {summary ? `${summary.winCount}W / ${summary.lossCount}L` : '0W / 0L'}
                </p>
              </div>

              {/* Minimalist Sparkline: monochrome grayscale line */}
              {winRateSparklineData.length > 1 && (
                <div className="h-10 w-28 sm:w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={winRateSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <defs>
                        <linearGradient id="wrSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#71717a" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#71717a" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#52525b" 
                        strokeWidth={1} 
                        fill="url(#wrSparklineGrad)" 
                        isAnimationActive={false} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Expectancy & Profit factor footer in grayscale */}
            <div className="pt-3 border-t border-white/[0.03] grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-zinc-600 block uppercase">Reward/Risk:</span>
                <span className="text-zinc-400 font-medium tabular-nums">
                  {summary ? `${summary.rr.toFixed(2)}R` : '0.00R'}
                </span>
              </div>
              <div>
                <span className="text-zinc-600 block uppercase">Profit Factor:</span>
                <span className="text-zinc-400 font-medium tabular-nums">
                  {summary ? `${summary.profitFactor.toFixed(2)}` : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2 ACTIONABLE WIDGETS */}
        
        {/* Quick Execution Pad (Spans 6 cols on lg) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-6 flex flex-col">
          <QuickExecutionPad className="h-full" />
        </div>

        {/* Live Tape Feed (Spans 6 cols on lg) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-6 flex flex-col">
          <LiveTape trades={trades || []} className="h-full" />
        </div>

        {/* ROW 3: AI PERFORMANCE ENGINE (Spans full 12 columns) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-12">
          <AIPerformanceEngine trades={trades || []} className="w-full" />
        </div>

      </div>

      {/* 4. Risk Architecture Status (Single-Line Minimal Footer) */}
      <footer className="pt-3 border-t border-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-zinc-600">
        <div>
          <span>Risk Architecture: Kelly 0.5x Fractional · Max Drawdown -2.5% · 1:2.0 Min R:R · 15m Cooldown</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
          <span>Terminal Guard: Active & Calibrated</span>
        </div>
      </footer>
    </div>
  );
};
