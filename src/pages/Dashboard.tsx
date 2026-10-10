/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Target, 
  Activity, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  PlusCircle,
  Lock
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
import { getTradeSummary } from '@/lib/trades';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useTrades } from '@/context/TradeContext';
import { AIPerformanceEngine } from '@/components/AIPerformanceEngine';
import { motion } from 'motion/react';

const StatCard = ({ title, value, icon: Icon, loading }: any) => (
  <Card className="border-zinc-950/5 dark:border-border shadow-sm dark:shadow-none bg-white/70 dark:bg-card hover:bg-zinc-50/50 dark:hover:bg-accent/50 transition-all backdrop-blur-[20px]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-zinc-400 dark:text-muted-foreground/60" />
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24 bg-muted" />
      ) : (
        <div className="text-2xl font-black text-zinc-950 dark:text-white tracking-tight">{value}</div>
      )}
    </CardContent>
  </Card>
);

export const Dashboard = () => {
  const { theme } = useTheme();
  const { trades, loading, isConnected } = useTrades();

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const summary = React.useMemo(() => {
    if (!trades || trades.length === 0) return null;
    const netPnl = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const winCount = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0).length;
    const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
    const winners = trades.filter(t => (t.status === 'win' || Number(t.pnl) > 0) && Number(t.pnl) > 0);
    const losers = trades.filter(t => (t.status === 'loss' || Number(t.pnl) < 0) && Number(t.pnl) < 0);
    const avgWin = winners.length > 0 ? (winners.reduce((sum, t) => sum + Number(t.pnl), 0) / winners.length) : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + Number(t.pnl), 0) / losers.length) : 0;
    const rr = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 2.5 : 0);
    return { netPnl, winRate, rr, totalTrades: trades.length, trades };
  }, [trades]);

  const chartData = React.useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return [...trades]
      .sort((a: any, b: any) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime())
      .map((t: any) => ({
        name: new Date(t.trade_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        pnl: Number(t.pnl) || 0
      }));
  }, [trades]);

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48 bg-muted rounded-xl" />
            <Skeleton className="h-4 w-72 bg-muted rounded-md" />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Skeleton className="h-28 rounded-2xl bg-muted" />
          <Skeleton className="h-28 rounded-2xl bg-muted" />
          <Skeleton className="h-28 rounded-2xl bg-muted" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="md:col-span-2 h-[300px] min-h-[300px] rounded-2xl bg-muted" />
          <Skeleton className="h-[300px] min-h-[300px] rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-muted border border-border rounded-2xl flex items-center justify-center text-3xl">
          🌱
        </div>
        <div className="max-w-[400px] space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Your journey starts here</h1>
          <p className="text-muted-foreground text-[15px]">
            You haven't logged any trades yet. The Dashboard will come alive once you record your first activity.
          </p>
        </div>
        <Link to="/journal">
          <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2">
            <PlusCircle size={16} />
            Log your first trade
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-[32px] font-bold text-foreground tracking-tight">
              Dashboard
            </h1>
            <Badge 
              variant="outline" 
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                isConnected 
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" 
                  : "border-zinc-300 dark:border-white/10 text-zinc-400"
              )}
            >
              <span className="relative flex h-2 w-2">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isConnected ? "bg-emerald-500" : "bg-zinc-400")}></span>
              </span>
              {isConnected ? "Realtime Active" : "Telemetry Synced"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm md:text-[15px]">
            Real-time performance metrics and intelligent growth insights.
          </p>
        </div>
      </header>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: [0.98, 1.015, 1],
          transition: {
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
            staggerChildren: 0.08
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
          transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
          className="transition-transform duration-300 hover:scale-[1.015]"
        >
          <StatCard 
            title="Total Net P/L" 
            value={
              summary 
                ? (summary.netPnl >= 0 
                    ? `$${summary.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                    : `-$${Math.abs(summary.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                : '$0.00'
            } 
            icon={TrendingUp} 
            loading={loading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
          transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
          className="transition-transform duration-300 hover:scale-[1.015]"
        >
          <StatCard 
            title="Win Rate" 
            value={summary ? `${summary.winRate.toFixed(1)}%` : '0%'} 
            icon={Target} 
            loading={loading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
          transition={{ duration: 0.5, delay: 0.19, ease: 'easeOut' }}
          className="transition-transform duration-300 hover:scale-[1.015]"
        >
          <StatCard 
            title="Avg. Reward/Risk" 
            value={summary ? summary.rr.toFixed(2) : '0.00'} 
            icon={Activity} 
            loading={loading}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="md:col-span-2 border-zinc-950/5 dark:border-border shadow-sm dark:shadow-none bg-white/70 dark:bg-card p-4 md:p-6 backdrop-blur-[20px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[13px] font-black text-zinc-950 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
              Equity Performance
            </h2>
          </div>
          <div className="h-[250px] md:h-[300px] min-h-[250px] md:min-h-[300px] w-full">
            {loading ? (
              <Skeleton className="w-full h-full bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#71717a' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#71717a' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px'
                    }} 
                  />
                  <Area 
                    type="stepAfter" 
                    dataKey="pnl" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPnL)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <AIPerformanceEngine trades={trades || []} />
      </div>

      {/* Removed Floating AI Button for V1 */}
    </div>
  );
};
