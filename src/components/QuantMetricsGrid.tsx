import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Activity, 
  Target, 
  Flame, 
  BarChart2, 
  Zap, 
  Scale,
  Award
} from 'lucide-react';
import { TradeData, QuantMetricsData } from '@/types';
import { computeQuantMetrics } from '@/utils/quantMetrics';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  // Generate chart data for Cumulative Equity & Drawdown
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
        drawdown: -drawdown,
        pnl: t.pnl,
        ticker: t.ticker
      };
    });

    points.unshift({
      tradeIndex: 0,
      date: 'Start',
      equity: 0,
      drawdown: 0,
      pnl: 0,
      ticker: ''
    });

    return points;
  }, [trades]);

  const isNetPositive = metrics.totalPnL >= 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Top Telemetry KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {/* Profit Factor */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm p-6 space-y-2 group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Profit Factor</span>
            <Scale size={16} className="text-primary" />
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-zinc-950 dark:text-white">
            {metrics.profitFactor === 99.99 ? 'MAX' : metrics.profitFactor.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium">
            {metrics.profitFactor >= 2.0 ? 'Exceptional institutional edge' : metrics.profitFactor >= 1.2 ? 'Statistically profitable' : 'Under evaluation'}
          </p>
        </Card>

        {/* Expectancy */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm p-6 space-y-2 group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Trade Expectancy</span>
            <Target size={16} className="text-emerald-500" />
          </div>
          <div className={cn(
            "text-3xl font-black font-mono tracking-tight",
            metrics.expectancy >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
          )}>
            {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium">
            Mathematical value per ticket logged
          </p>
        </Card>

        {/* Sharpe Ratio */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm p-6 space-y-2 group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Sharpe Ratio</span>
            <Award size={16} className="text-indigo-400" />
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-zinc-950 dark:text-white">
            {metrics.sharpeRatio.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium">
            Risk-adjusted excess return index
          </p>
        </Card>

        {/* Max Drawdown */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm p-6 space-y-2 group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Max Drawdown</span>
            <TrendingDown size={16} className="text-rose-500" />
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-rose-500">
            -${metrics.maxDrawdown.maxDrawdown.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium">
            Peak-to-trough equity contraction
          </p>
        </Card>
      </div>

      {/* Main Cumulative Equity & Drawdown Curve */}
      <Card className="rounded-[2.5rem] border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <h3 className="text-lg md:text-xl font-black text-zinc-950 dark:text-white tracking-tight">
                Cumulative Equity & Drawdown Trajectory
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Real-time portfolio path showing capital accumulation and historical drawdown corridors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs px-3 py-1 rounded-full border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 font-bold">
              Total PnL: {isNetPositive ? '+' : ''}${metrics.totalPnL.toFixed(2)}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs px-3 py-1 rounded-full border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 font-bold">
              Win Rate: {metrics.winRate}%
            </Badge>
          </div>
        </div>

        {/* Chart Container with explicit height */}
        <div className="h-[320px] w-full min-h-[320px]">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.0} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis 
                  dataKey="tradeIndex" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#334155', opacity: 0.2 }}
                  tickFormatter={(val) => val === 0 ? 'Start' : `#${val}`}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#334155', opacity: 0.2 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-2xl text-xs font-mono space-y-1 text-white backdrop-blur-md">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">
                            Trade #{data.tradeIndex} {data.ticker ? `(${data.ticker})` : ''}
                          </p>
                          <div className="text-emerald-400 font-black text-sm">
                            Equity: ${data.equity.toFixed(2)}
                          </div>
                          {data.drawdown < 0 && (
                            <div className="text-rose-400 font-bold text-[11px]">
                              Drawdown: -${Math.abs(data.drawdown).toFixed(2)}
                            </div>
                          )}
                          {data.pnl !== 0 && (
                            <div className="text-[10px] text-zinc-400">
                              Trade Realized: {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#equityGrad)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="drawdown" 
                  stroke="#f43f5e" 
                  strokeWidth={1.5} 
                  strokeDasharray="4 4" 
                  fillOpacity={1} 
                  fill="url(#ddGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm font-medium">
              Log trades to generate the cumulative equity curve.
            </div>
          )}
        </div>
      </Card>

      {/* Streaks & Risk-of-Ruin Telemetry Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Win/Loss Streaks */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Flame size={20} />
              </div>
              <div>
                <h4 className="font-black text-base text-zinc-950 dark:text-white tracking-tight">
                  Streak Velocity
                </h4>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Momentum Distribution
                </p>
              </div>
            </div>

            <Badge variant="outline" className={cn(
              "font-mono text-xs px-3 py-1 rounded-full uppercase tracking-wider font-bold",
              metrics.winLossStreaks.currentStreak > 0 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : metrics.winLossStreaks.currentStreak < 0
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
            )}>
              Current: {metrics.winLossStreaks.currentStreak > 0 ? `+${metrics.winLossStreaks.currentStreak} Wins` : metrics.winLossStreaks.currentStreak < 0 ? `${metrics.winLossStreaks.currentStreak} Losses` : 'Neutral'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Longest Win Run</span>
              <div className="text-2xl font-black font-mono text-emerald-500 dark:text-emerald-400">
                {metrics.winLossStreaks.longestWinStreak} Trades
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-1">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Longest Draw Run</span>
              <div className="text-2xl font-black font-mono text-rose-500 dark:text-rose-400">
                {metrics.winLossStreaks.longestLossStreak} Trades
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            Streak monitoring prevents emotional sizing adjustments during consecutive winning or losing runs.
          </p>
        </Card>

        {/* Risk of Ruin */}
        <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 className="font-black text-base text-zinc-950 dark:text-white tracking-tight">
                  Risk-of-Ruin Telemetry
                </h4>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Statistical Insolvency Probability
                </p>
              </div>
            </div>

            <Badge variant="outline" className={cn(
              "font-mono text-xs px-3 py-1 rounded-full uppercase tracking-wider font-bold",
              metrics.riskOfRuin < 1.0 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : metrics.riskOfRuin < 5.0
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}>
              {metrics.riskOfRuin < 1.0 ? 'PRISTINE SAFEGUARD' : metrics.riskOfRuin < 5.0 ? 'MODERATE RISK' : 'CRITICAL EXPOSURE'}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-black font-mono text-zinc-950 dark:text-white">
                {metrics.riskOfRuin.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Confidence threshold: 20 risk units
              </span>
            </div>

            {/* Probability bar */}
            <div className="h-3 w-full bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden p-0.5">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  metrics.riskOfRuin < 2 ? "bg-emerald-500" : metrics.riskOfRuin < 10 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(1, metrics.riskOfRuin))}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            {metrics.riskOfRuin < 1.0 
              ? 'Zero-ruin profile: Current win rate and risk-reward profile statistically eliminate long-term capital exhaustion.'
              : 'Attention: Review session drawdown limits to ensure safety buffer against volatility clusters.'}
          </p>
        </Card>
      </div>
    </div>
  );
};
