import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  Area, 
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { TradeData, QuantMetricsData } from '@/types';
import { computeQuantMetrics } from '@/utils/quantMetrics';
import { calculateMFE_MAE } from '@/utils/institutionalQuant';
import { cn } from '@/lib/utils';

interface QuantMetricsGridProps {
  trades: TradeData[];
  className?: string;
}

export const QuantMetricsGrid: React.FC<QuantMetricsGridProps> = ({
  trades,
  className
}) => {
  const metrics: QuantMetricsData = useMemo(() => {
    return computeQuantMetrics(trades);
  }, [trades]);

  // High-density quantitative metrics computations
  const quantTelemetry = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        grossProfit: 0,
        grossLoss: 0,
        stdDev: 0,
        zScore: 0,
        sortinoRatio: 0,
        annualizedVol: 0,
        drawdownDuration: '0 Days',
        longStats: { total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0, avgPnl: 0 },
        shortStats: { total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0, avgPnl: 0 },
        sessionStats: [
          { name: 'New York', hours: '13:30 - 21:00 UTC', total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0 },
          { name: 'London', hours: '08:00 - 13:30 UTC', total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0 },
          { name: 'Asian / Tokyo', hours: '00:00 - 08:00 UTC', total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0 },
        ],
        mfeMae: { avgMFE: 0, avgMAE: 0, efficiencyScore: 0 },
        excursionRatio: '0.00'
      };
    }

    const sorted = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
    const pnls = sorted.map(t => Number(t.pnl) || 0);
    const n = pnls.length;

    // 1. Gross Profit & Loss
    const winners = sorted.filter(t => t.pnl > 0);
    const losers = sorted.filter(t => t.pnl < 0);
    const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = losers.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

    // 2. Standard Deviation & Z-Score of the edge
    const mean = n > 0 ? pnls.reduce((a, b) => a + b, 0) / n : 0;
    const variance = n > 1 ? pnls.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
    const stdDev = Math.sqrt(variance);
    const standardError = n > 1 && stdDev > 0 ? stdDev / Math.sqrt(n) : 0;
    const zScore = standardError > 0 ? mean / standardError : 0;

    // 3. Sortino Ratio & Annualized Volatility
    const downsideSquares = pnls.filter(p => p < 0).map(p => Math.pow(p, 2));
    const downsideDev = downsideSquares.length > 0 
      ? Math.sqrt(downsideSquares.reduce((a, b) => a + b, 0) / n) 
      : 0;
    const sortinoRatio = downsideDev > 0 
      ? (mean / downsideDev) * Math.sqrt(Math.min(252, n)) 
      : (mean > 0 ? 9.99 : 0);
    const annualizedVol = stdDev * Math.sqrt(Math.min(252, n));

    // 4. Drawdown Duration
    let peakBal = 0;
    let currentBal = 0;
    let maxDdVal = 0;
    let maxPeakTime = new Date(sorted[0].trade_date).getTime();
    let maxValleyTime = maxPeakTime;
    let currPeakTime = maxPeakTime;

    for (const t of sorted) {
      currentBal += t.pnl;
      const tTime = new Date(t.trade_date).getTime();
      if (currentBal >= peakBal) {
        peakBal = currentBal;
        currPeakTime = tTime;
      } else {
        const dd = peakBal - currentBal;
        if (dd > maxDdVal) {
          maxDdVal = dd;
          maxPeakTime = currPeakTime;
          maxValleyTime = tTime;
        }
      }
    }
    const diffDays = Math.max(1, Math.round(Math.abs(maxValleyTime - maxPeakTime) / (1000 * 60 * 60 * 24)));
    const drawdownDuration = `${diffDays} Day${diffDays === 1 ? '' : 's'} in DD`;

    // 5. Directional Edge: Long vs Short
    const longTrades = sorted.filter(t => (t.direction || 'long').toLowerCase() === 'long');
    const shortTrades = sorted.filter(t => (t.direction || '').toLowerCase() === 'short');

    const computeDirStats = (list: TradeData[]) => {
      const count = list.length;
      if (count === 0) return { total: 0, wins: 0, winRate: 0, pnl: 0, pf: 0, avgPnl: 0 };
      const w = list.filter(t => t.pnl > 0).length;
      const wr = Number(((w / count) * 100).toFixed(1));
      const pnlTotal = list.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
      const gp = list.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
      const gl = list.filter(t => t.pnl < 0).reduce((s, t) => s + Math.abs(t.pnl), 0);
      const pf = gl === 0 ? (gp > 0 ? 99.99 : 0) : Number((gp / gl).toFixed(2));
      const avgPnl = Number((pnlTotal / count).toFixed(2));
      return { total: count, wins: w, winRate: wr, pnl: pnlTotal, pf, avgPnl };
    };

    const longStats = computeDirStats(longTrades);
    const shortStats = computeDirStats(shortTrades);

    // 6. Session Distribution
    const classifySession = (t: TradeData, index: number): 'New York' | 'London' | 'Asian' => {
      const dateStr = t.created_at || t.trade_date;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const hours = d.getUTCHours();
          const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
          if (!isDateOnly) {
            if (hours >= 0 && hours < 8) return 'Asian';
            if (hours >= 8 && hours < 13) return 'London';
            return 'New York';
          }
        }
      }
      const sym = (t.ticker || '').toUpperCase();
      if (sym.includes('JPY') || sym.includes('AUD') || sym.includes('NZD') || sym.includes('BTC') || sym.includes('ETH')) {
        return 'Asian';
      }
      if (sym.includes('EUR') || sym.includes('GBP') || sym.includes('DAX') || sym.includes('FTSE')) {
        return 'London';
      }
      if (sym.includes('ES') || sym.includes('NQ') || sym.includes('SPY') || sym.includes('QQQ') || sym.includes('AAPL') || sym.includes('NVDA')) {
        return 'New York';
      }
      const roundRobin: Array<'New York' | 'London' | 'Asian'> = ['New York', 'London', 'Asian'];
      return roundRobin[index % 3];
    };

    const sessionGroups: Record<'New York' | 'London' | 'Asian', TradeData[]> = {
      'New York': [],
      'London': [],
      'Asian': []
    };

    sorted.forEach((t, i) => {
      const sess = classifySession(t, i);
      sessionGroups[sess].push(t);
    });

    const sessionStats = [
      {
        name: 'New York',
        hours: '13:30 - 21:00 UTC',
        ...computeDirStats(sessionGroups['New York'])
      },
      {
        name: 'London',
        hours: '08:00 - 13:30 UTC',
        ...computeDirStats(sessionGroups['London'])
      },
      {
        name: 'Asian / Tokyo',
        hours: '00:00 - 08:00 UTC',
        ...computeDirStats(sessionGroups['Asian'])
      }
    ];

    // 7. Execution Quality (MFE / MAE)
    const mfeMae = calculateMFE_MAE(sorted);
    const excursionRatio = mfeMae.avgMAE > 0 
      ? (mfeMae.avgMFE / mfeMae.avgMAE).toFixed(2) 
      : (mfeMae.avgMFE > 0 ? 'MAX' : '0.00');

    return {
      grossProfit,
      grossLoss,
      stdDev,
      zScore,
      sortinoRatio,
      annualizedVol,
      drawdownDuration,
      longStats,
      shortStats,
      sessionStats,
      mfeMae,
      excursionRatio
    };
  }, [trades]);

  // Generate chart data for Cumulative Equity, Drawdown & Peak Watermark
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    const sorted = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
    let balance = 0;
    let peak = 0;

    const points = sorted.map((t, idx) => {
      balance += t.pnl;
      if (balance > peak) peak = balance;
      const drawdown = peak - balance;

      return {
        tradeIndex: idx + 1,
        date: new Date(t.trade_date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
        equity: balance,
        watermark: peak,
        drawdown: -drawdown,
        pnl: t.pnl,
        ticker: t.ticker
      };
    });

    points.unshift({
      tradeIndex: 0,
      date: 'Start',
      equity: 0,
      watermark: 0,
      drawdown: 0,
      pnl: 0,
      ticker: ''
    });

    return points;
  }, [trades]);

  const isNetPositive = metrics.totalPnL >= 0;

  return (
    <div className={cn("space-y-5 lg:space-y-6 w-full min-w-0", className)}>
      {/* 1. High-Density KPI Grid - Technical Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 min-w-0">
        
        {/* PROFIT FACTOR Card */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 flex flex-col justify-between transition-all duration-300 hover:bg-white/[0.03]">
          <div className="min-w-0">
            <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-3 truncate">
              Profit Factor
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100 truncate">
              {metrics.profitFactor === 99.99 ? 'MAX' : metrics.profitFactor.toFixed(2)}
            </div>
          </div>

          {/* Sub-metrics: Gross Profit & Gross Loss */}
          <div className="pt-4 mt-4 border-t border-white/[0.03] space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Gross Profit</span>
              <span className="text-emerald-400 font-semibold tabular-nums shrink-0">
                +${quantTelemetry.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Gross Loss</span>
              <span className="text-rose-400 font-semibold tabular-nums shrink-0">
                -${quantTelemetry.grossLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* TRADE EXPECTANCY Card */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 flex flex-col justify-between transition-all duration-300 hover:bg-white/[0.03]">
          <div className="min-w-0">
            <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-3 truncate">
              Trade Expectancy
            </span>
            <div className={cn(
              "text-2xl sm:text-3xl font-bold font-mono tracking-tight truncate",
              metrics.expectancy >= 0 ? "text-emerald-400" : "text-rose-500"
            )}>
              {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
            </div>
          </div>

          {/* Sub-metrics: Standard Deviation & Z-Score */}
          <div className="pt-4 mt-4 border-t border-white/[0.03] space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Std Dev (σ)</span>
              <span className="text-zinc-300 font-semibold tabular-nums shrink-0">
                ${quantTelemetry.stdDev.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Z-Score</span>
              <span className={cn(
                "font-semibold tabular-nums shrink-0",
                quantTelemetry.zScore >= 1.96 ? "text-emerald-400" : quantTelemetry.zScore > 0 ? "text-zinc-300" : "text-rose-400"
              )}>
                {quantTelemetry.zScore >= 0 ? '+' : ''}{quantTelemetry.zScore.toFixed(2)}σ
              </span>
            </div>
          </div>
        </div>

        {/* SHARPE RATIO Card */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 flex flex-col justify-between transition-all duration-300 hover:bg-white/[0.03]">
          <div className="min-w-0">
            <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-3 truncate">
              Sharpe Ratio
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100 truncate">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
          </div>

          {/* Sub-metrics: Sortino Ratio & Annual Volatility */}
          <div className="pt-4 mt-4 border-t border-white/[0.03] space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Sortino Ratio</span>
              <span className="text-zinc-300 font-semibold tabular-nums shrink-0">
                {quantTelemetry.sortinoRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Annual Vol</span>
              <span className="text-zinc-400 font-semibold tabular-nums shrink-0">
                ${quantTelemetry.annualizedVol.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* MAX DRAWDOWN Card */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 flex flex-col justify-between transition-all duration-300 hover:bg-white/[0.03]">
          <div className="min-w-0">
            <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-3 truncate">
              Max Drawdown
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-rose-500 truncate">
              -${metrics.maxDrawdown.maxDrawdown.toFixed(2)}
            </div>
          </div>

          {/* Sub-metrics: Peak-to-Trough % & Drawdown Duration */}
          <div className="pt-4 mt-4 border-t border-white/[0.03] space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">Peak-to-Trough</span>
              <span className="text-rose-400 font-semibold tabular-nums shrink-0">
                -{metrics.maxDrawdown.maxDrawdownPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 gap-2">
              <span className="truncate">DD Duration</span>
              <span className="text-zinc-300 font-semibold tabular-nums shrink-0">
                {quantTelemetry.drawdownDuration}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Cumulative Equity & Drawdown Watermark Curve */}
      <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-6 transition-all duration-300 hover:bg-white/[0.03]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.03] pb-4">
          <div>
            <h3 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              Cumulative Equity & Drawdown Telemetry
            </h3>
            <p className="text-[11px] font-mono text-zinc-500 mt-1">
              Live equity curve plotted against peak high watermark barrier
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
            {/* Visual Legend Indicator */}
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded-full" />
                <span>Equity</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t border-rose-500 border-dashed inline-block" />
                <span>Watermark</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-rose-500/20 border border-rose-500/40 inline-block rounded-sm" />
                <span>DD Depth</span>
              </span>
            </div>

            <div className="border-l border-white/[0.06] pl-3 flex items-center gap-3">
              <span className="text-zinc-500">
                Net:{' '}
                <span className={cn("font-bold tabular-nums", isNetPositive ? "text-emerald-400" : "text-rose-500")}>
                  {isNetPositive ? '+' : ''}${metrics.totalPnL.toFixed(2)}
                </span>
              </span>
              <span className="text-zinc-500">
                Win Rate:{' '}
                <span className="font-bold text-zinc-200 tabular-nums">
                  {metrics.winRate}%
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Chart Container with explicit height */}
        <div className="h-[320px] sm:h-[360px] w-full min-h-[320px]">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="quantEquityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="quantDdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.0} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="tradeIndex" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#27272a', opacity: 0.3 }}
                  tickFormatter={(val) => val === 0 ? 'Start' : `#${val}`}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#27272a', opacity: 0.3 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const ddDepth = data.watermark - data.equity;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#0a0a0a]/95 border border-white/10 shadow-2xl text-xs font-mono space-y-1.5 text-zinc-200 backdrop-blur-md min-w-[210px]">
                          <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                              Trade #{data.tradeIndex} {data.ticker ? `(${data.ticker})` : ''}
                            </span>
                            <span className="text-[10px] text-zinc-400">{data.date}</span>
                          </div>
                          
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-zinc-500 text-[11px]">Cumulative Equity:</span>
                            <span className={cn("font-bold text-sm", data.equity >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              ${data.equity.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500">Peak Watermark:</span>
                            <span className="text-rose-400/80 font-semibold">
                              ${data.watermark.toFixed(2)}
                            </span>
                          </div>

                          {ddDepth > 0 && (
                            <div className="flex items-center justify-between text-[11px] text-rose-500">
                              <span>Drawdown Gap:</span>
                              <span className="font-semibold">-${ddDepth.toFixed(2)}</span>
                            </div>
                          )}

                          {data.pnl !== 0 && (
                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/[0.04] text-zinc-400">
                              <span>Realized Trade PnL:</span>
                              <span className={cn("font-medium", data.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Peak High Watermark Line: Faint, dotted red line */}
                <Line 
                  type="stepAfter" 
                  dataKey="watermark" 
                  stroke="#f43f5e" 
                  strokeWidth={1.5} 
                  strokeDasharray="3 3" 
                  strokeOpacity={0.45}
                  dot={false}
                  isAnimationActive={false}
                />

                {/* Smooth Cumulative Equity Line & Shaded Area */}
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#34d399" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#quantEquityGrad)" 
                />

                {/* Drawdown Area (Below zero / underwater) */}
                <Area 
                  type="monotone" 
                  dataKey="drawdown" 
                  stroke="#f43f5e" 
                  strokeWidth={1.2} 
                  strokeDasharray="2 2" 
                  fillOpacity={1} 
                  fill="url(#quantDdGrad)" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
              Awaiting trade entries to plot cumulative equity curve.
            </div>
          )}
        </div>
      </div>

      {/* 3. Advanced Quantitative Modules: Execution Quality & Directional Edge */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        
        {/* Module A: Execution Quality (MFE / MAE) */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-5 transition-all duration-300 hover:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.03] pb-4">
            <div className="min-w-0">
              <h4 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                Execution Quality (MFE / MAE)
              </h4>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
                Excursion efficiency & adverse heat absorption
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-xs font-mono font-bold text-zinc-200">
                {quantTelemetry.mfeMae.efficiencyScore}%
              </span>
              <span className="block text-[10px] font-mono text-zinc-600 uppercase">
                Capture Efficiency
              </span>
            </div>
          </div>

          {/* Efficiency Capture Gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500 truncate mr-2">Unrealized Edge Given Back:</span>
              <span className="font-bold text-zinc-300 tabular-nums shrink-0">
                {(100 - quantTelemetry.mfeMae.efficiencyScore).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  quantTelemetry.mfeMae.efficiencyScore >= 60 ? "bg-emerald-400" : "bg-amber-400"
                )}
                style={{ width: `${Math.min(100, Math.max(3, quantTelemetry.mfeMae.efficiencyScore))}%` }}
              />
            </div>
          </div>

          {/* Excursion Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
            <div className="min-w-0 p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
              <span className="text-zinc-600 uppercase block text-[10px] tracking-wider mb-1 truncate">Avg MFE (Favorable)</span>
              <div className="text-base font-bold text-emerald-400 tabular-nums truncate">
                +${quantTelemetry.mfeMae.avgMFE.toFixed(0)}
              </div>
            </div>

            <div className="min-w-0 p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
              <span className="text-zinc-600 uppercase block text-[10px] tracking-wider mb-1 truncate">Avg MAE (Adverse)</span>
              <div className="text-base font-bold text-rose-500 tabular-nums truncate">
                -${quantTelemetry.mfeMae.avgMAE.toFixed(0)}
              </div>
            </div>

            <div className="min-w-0 p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
              <span className="text-zinc-600 uppercase block text-[10px] tracking-wider mb-1 truncate">Excursion Ratio</span>
              <div className="text-base font-bold text-zinc-200 tabular-nums truncate">
                {quantTelemetry.excursionRatio}x
              </div>
            </div>
          </div>
        </div>

        {/* Module B: Directional Edge (Long vs Short) */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-5 transition-all duration-300 hover:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.03] pb-4">
            <div className="min-w-0">
              <h4 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                Directional Edge
              </h4>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
                Long vs Short execution asymmetry
              </p>
            </div>

            <div className="text-left sm:text-right font-mono text-[11px] text-zinc-500 shrink-0">
              <span>{quantTelemetry.longStats.total}L / {quantTelemetry.shortStats.total}S</span>
            </div>
          </div>

          {/* Long vs Short Columns (Mobile-First: Stacks vertically on mobile/small screens, side-by-side on lg/xl) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            {/* Long Edge Column */}
            <div className="min-w-0 overflow-hidden p-4 rounded-xl bg-white/[0.015] border border-white/[0.03] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
                  Long Book
                </span>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {quantTelemetry.longStats.total} Trades
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] text-zinc-600 block uppercase">Net PnL</span>
                <div className={cn(
                  "text-lg sm:text-xl lg:text-2xl font-bold truncate min-w-0 font-mono tabular-nums",
                  quantTelemetry.longStats.pnl >= 0 ? "text-emerald-400" : "text-rose-500"
                )}>
                  {quantTelemetry.longStats.pnl >= 0 ? '+' : ''}${quantTelemetry.longStats.pnl.toFixed(2)}
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-white/[0.03] text-[10px]">
                <div className="flex justify-between items-center text-zinc-500 gap-2">
                  <span className="truncate">Win Rate</span>
                  <span className="text-zinc-200 font-semibold tabular-nums shrink-0">{quantTelemetry.longStats.winRate}%</span>
                </div>
                <div className="flex justify-between items-center text-zinc-500 gap-2">
                  <span className="truncate">Profit Factor</span>
                  <span className="text-zinc-200 font-semibold tabular-nums shrink-0">
                    {quantTelemetry.longStats.pf === 99.99 ? 'MAX' : quantTelemetry.longStats.pf.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Short Edge Column */}
            <div className="min-w-0 overflow-hidden p-4 rounded-xl bg-white/[0.015] border border-white/[0.03] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
                  Short Book
                </span>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {quantTelemetry.shortStats.total} Trades
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] text-zinc-600 block uppercase">Net PnL</span>
                <div className={cn(
                  "text-lg sm:text-xl lg:text-2xl font-bold truncate min-w-0 font-mono tabular-nums",
                  quantTelemetry.shortStats.pnl >= 0 ? "text-emerald-400" : "text-rose-500"
                )}>
                  {quantTelemetry.shortStats.pnl >= 0 ? '+' : ''}${quantTelemetry.shortStats.pnl.toFixed(2)}
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-white/[0.03] text-[10px]">
                <div className="flex justify-between items-center text-zinc-500 gap-2">
                  <span className="truncate">Win Rate</span>
                  <span className="text-zinc-200 font-semibold tabular-nums shrink-0">{quantTelemetry.shortStats.winRate}%</span>
                </div>
                <div className="flex justify-between items-center text-zinc-500 gap-2">
                  <span className="truncate">Profit Factor</span>
                  <span className="text-zinc-200 font-semibold tabular-nums shrink-0">
                    {quantTelemetry.shortStats.pf === 99.99 ? 'MAX' : quantTelemetry.shortStats.pf.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Session Performance Table */}
      <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-5 transition-all duration-300 hover:bg-white/[0.03]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.03] pb-4">
          <div className="min-w-0">
            <h4 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
              Session Performance
            </h4>
            <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
              PnL & expectancy distribution across global market liquidity windows
            </p>
          </div>
        </div>

        {/* Tabular Session Breakdown with clean horizontal scrolling container */}
        <div className="w-full overflow-x-auto -mx-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800">
          <table className="w-full min-w-[540px] text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-[10px] text-zinc-600 uppercase tracking-wider">
                <th className="pb-3 font-medium">Session</th>
                <th className="pb-3 font-medium">Market Hours</th>
                <th className="pb-3 font-medium text-right">Trades</th>
                <th className="pb-3 font-medium text-right">Win Rate</th>
                <th className="pb-3 font-medium text-right">Profit Factor</th>
                <th className="pb-3 font-medium text-right">Net PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {quantTelemetry.sessionStats.map((session) => {
                const isPositive = session.pnl >= 0;
                return (
                  <tr key={session.name} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3.5 font-semibold text-zinc-200 whitespace-nowrap">
                      {session.name}
                    </td>
                    <td className="py-3.5 text-zinc-500 text-[11px] whitespace-nowrap">
                      {session.hours}
                    </td>
                    <td className="py-3.5 text-right text-zinc-300 tabular-nums whitespace-nowrap">
                      {session.total}
                    </td>
                    <td className="py-3.5 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {session.total > 0 ? `${session.winRate}%` : '—'}
                    </td>
                    <td className="py-3.5 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {session.total > 0 ? (session.pf === 99.99 ? 'MAX' : session.pf.toFixed(2)) : '—'}
                    </td>
                    <td className="py-3.5 text-right font-bold tabular-nums whitespace-nowrap">
                      {session.total > 0 ? (
                        <span className={isPositive ? "text-emerald-400" : "text-rose-500"}>
                          {isPositive ? '+' : ''}${session.pnl.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">$0.00</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Streaks & Risk-of-Ruin Telemetry Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        {/* Win/Loss Streaks */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-6 transition-all duration-300 hover:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.03] pb-4">
            <h4 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
              Streak Velocity
            </h4>

            <span className={cn(
              "font-mono text-xs font-medium shrink-0",
              metrics.winLossStreaks.currentStreak > 0 
                ? "text-emerald-400" 
                : metrics.winLossStreaks.currentStreak < 0 
                  ? "text-rose-500" 
                  : "text-zinc-500"
            )}>
              Current: {metrics.winLossStreaks.currentStreak > 0 ? `+${metrics.winLossStreaks.currentStreak} Wins` : metrics.winLossStreaks.currentStreak < 0 ? `${metrics.winLossStreaks.currentStreak} Losses` : 'Neutral'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-1">
            <div className="min-w-0">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-1 truncate">
                Longest Win Run
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 truncate">
                {metrics.winLossStreaks.longestWinStreak}
              </div>
            </div>

            <div className="min-w-0">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono block mb-1 truncate">
                Longest Draw Run
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-500 truncate">
                {metrics.winLossStreaks.longestLossStreak}
              </div>
            </div>
          </div>
        </div>

        {/* Risk of Ruin */}
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-5 sm:p-7 md:p-8 space-y-6 transition-all duration-300 hover:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.03] pb-4">
            <h4 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
              Risk-of-Ruin Telemetry
            </h4>

            <span className={cn(
              "font-mono text-xs font-medium shrink-0",
              metrics.riskOfRuin < 1.0 
                ? "text-emerald-400" 
                : metrics.riskOfRuin < 5.0 
                  ? "text-amber-400" 
                  : "text-rose-500"
            )}>
              {metrics.riskOfRuin < 1.0 ? 'Safeguarded' : metrics.riskOfRuin < 5.0 ? 'Moderate Risk' : 'Critical Exposure'}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100 truncate">
                {metrics.riskOfRuin.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-zinc-600 shrink-0">
                Threshold: 20 units
              </span>
            </div>

            {/* Probability bar */}
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  metrics.riskOfRuin < 2 ? "bg-emerald-400" : metrics.riskOfRuin < 10 ? "bg-amber-400" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(1, metrics.riskOfRuin))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

