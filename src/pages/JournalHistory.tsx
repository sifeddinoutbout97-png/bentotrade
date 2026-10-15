/**
 * BentoTrade V6.0 Journal History & Replay Center
 * Blotter Table + Monthly Calendar Heatmap View + Candlestick Execution Blueprint Replay
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllTrades, deleteTrade, updateTrade, deleteAllTrades } from '@/lib/trades';
import { useAuth } from '@/lib/auth';
import { useTrades } from '@/context/TradeContext';
import { Trade } from '@/types';
import { isAIActive } from '@/lib/keys';
import { cn, formatCurrency, formatDate, getMarketTypeFromTicker } from '@/lib/utils';
import { autoTagTrade } from '@/lib/ai-agents/auto-tagger';
import { TradeExecutionChart } from '@/components/TradeExecutionChart';
import { AIDiagnosticModal } from '@/components/AIDiagnosticModal';
import { 
  Shield,
  Activity,
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  History,
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp,
  MessageSquare,
  X,
  Target,
  BarChart3,
  Filter,
  Bot,
  Loader2,
  Sparkles,
  Lock,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Grid
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export const JournalHistory = () => {
  const { isAdmin, impersonatingUserId } = useAuth();
  const { trades, loading, setTrades, refetchTrades } = useTrades();
  
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [viewMode, setViewMode] = useState<'blotter' | 'calendar'>('blotter');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Filters state
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTrade) {
        setSelectedTrade(null);
      }
    };
    if (selectedTrade) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTrade]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const previousTrades = [...trades];
    setTrades(prev => prev.filter(t => t.id !== id));
    toast.success('Trade removed from journal', {
      action: {
        label: 'Undo',
        onClick: () => setTrades(previousTrades)
      }
    });

    try {
      await deleteTrade(id);
    } catch (error) {
      console.error('Error deleting trade:', error);
      setTrades(previousTrades);
      toast.error('Failed to sync deletion with database.');
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('WARNING: Are you sure you want to delete ALL trades? This action is irreversible.')) {
      const previousTrades = [...trades];
      setTrades([]);
      toast.info('All trade entries cleared optimistically');

      try {
        await deleteAllTrades();
        toast.success('Database purge complete');
      } catch (error) {
        console.error('Error deleting all trades:', error);
        setTrades(previousTrades);
        toast.error('Failed to purge database.');
      }
    }
  };

  // Filtered Trades Logic
  const filteredTrades = useMemo(() => {
    return (trades || []).filter(trade => {
      if (outcomeFilter !== 'all' && trade.status !== outcomeFilter) return false;
      if (marketFilter !== 'all') {
        const tradeType = trade.market_type || getMarketTypeFromTicker(trade.ticker || '');
        if (tradeType !== marketFilter) return false;
      }
      if (selectedDateFilter && trade.trade_date !== selectedDateFilter) return false;
      return true;
    });
  }, [trades, outcomeFilter, marketFilter, selectedDateFilter]);

  // Aggregate Stats
  const totalPnL = useMemo(() => (trades || []).reduce((acc, t) => acc + (t.pnl || 0), 0), [trades]);
  const winRate = useMemo(() => {
    if (!trades || trades.length === 0) return 0;
    const wins = trades.filter(t => t.status === 'win' || t.pnl > 0).length;
    return (wins / trades.length) * 100;
  }, [trades]);

  const bestAsset = useMemo(() => {
    if (!trades || trades.length === 0) return 'N/A';
    const counts: Record<string, number> = {};
    trades.forEach(t => {
      const sym = (t.ticker || 'N/A').toUpperCase();
      counts[sym] = (counts[sym] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'N/A';
  }, [trades]);

  // Calendar Heatmap Computation
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Group trades by date
    const dateMap = new Map<string, Trade[]>();
    (trades || []).forEach(t => {
      if (t.trade_date) {
        const list = dateMap.get(t.trade_date) || [];
        list.push(t);
        dateMap.set(t.trade_date, list);
      }
    });

    const days = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTrades = dateMap.get(dateStr) || [];
      const pnl = dayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const wins = dayTrades.filter(t => t.pnl > 0 || t.status === 'win').length;
      const count = dayTrades.length;
      const winPct = count > 0 ? Math.round((wins / count) * 100) : 0;

      days.push({
        day,
        dateStr,
        trades: dayTrades,
        pnl,
        count,
        winPct
      });
    }

    return { firstDayIndex, days, year, month };
  }, [trades, currentMonth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-emerald-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.4em] text-zinc-300 animate-pulse">
            SYNCHRONIZING JOURNAL LEDGER
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 w-full max-w-[1600px] mx-auto pb-20 font-sans space-y-8">
      
      {/* Header & Controls */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
            <span>Terminal</span> / <span>Ledger</span> / <span className="text-emerald-400">Journal History</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight flex items-center gap-3">
            Journal Blotter & Replay <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">REVISION_6.0</span>
          </h1>
        </div>

        {/* View Segmented Switcher & Admin Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 flex items-center gap-1 font-mono text-xs shadow-lg">
            <button
              onClick={() => { setViewMode('blotter'); setSelectedDateFilter(null); }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all",
                viewMode === 'blotter' ? "bg-zinc-800 text-emerald-400 border border-zinc-700/60 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <ListFilter size={14} />
              <span>[Blotter Table View]</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all",
                viewMode === 'calendar' ? "bg-zinc-800 text-emerald-400 border border-zinc-700/60 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Grid size={14} />
              <span>[Calendar Heatmap View]</span>
            </button>
          </div>

          {isAdmin && (
            <Button 
              onClick={handleDeleteAll}
              variant="outline" 
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500 rounded-xl px-4 h-9 text-xs font-mono font-bold"
            >
              <Trash2 size={14} className="mr-1.5" />
              Purge Database
            </Button>
          )}
        </div>
      </header>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between font-mono shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">TOTAL NET P&L</span>
            <div className={cn("text-2xl font-black tracking-tight", totalPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {formatCurrency(totalPnL, true)}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <DollarSign size={22} className={totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between font-mono shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">HISTORICAL WIN RATE</span>
            <div className="text-2xl font-black text-white tracking-tight">
              {winRate.toFixed(1)}%
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <Target size={22} className="text-indigo-400" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between font-mono shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">PRIMARY TICKER</span>
            <div className="text-2xl font-black text-white tracking-tight">
              {bestAsset}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <TrendingUp size={22} className="text-amber-400" />
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: CALENDAR HEATMAP */}
      {viewMode === 'calendar' && (
        <section className="space-y-4 font-mono">
          {/* Month Switcher Header */}
          <div className="flex items-center justify-between bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3">
              <CalendarIcon size={18} className="text-emerald-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 font-bold transition-colors"
              >
                TODAY
              </button>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-3">
            {/* Empty slots before day 1 */}
            {Array.from({ length: calendarData.firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-28 rounded-2xl bg-zinc-950/20 border border-zinc-900/40" />
            ))}

            {/* Month Days */}
            {calendarData.days.map((item) => {
              const hasTrades = item.count > 0;
              const isProfit = item.pnl > 0;
              const isLoss = item.pnl < 0;

              return (
                <div
                  key={item.dateStr}
                  onClick={() => {
                    if (hasTrades) {
                      setSelectedDateFilter(item.dateStr);
                      setViewMode('blotter');
                      toast.info(`Filtered blotter for ${item.dateStr}`);
                    }
                  }}
                  className={cn(
                    "h-28 rounded-2xl p-3 border transition-all duration-200 flex flex-col justify-between select-none relative overflow-hidden",
                    hasTrades ? "cursor-pointer hover:scale-[1.02] active:scale-95 shadow-xl" : "cursor-default opacity-60",
                    isProfit ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-emerald-950/20" :
                    isLoss ? "bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-rose-950/20" :
                    hasTrades ? "bg-zinc-900 border-zinc-700 text-zinc-300" :
                    "bg-zinc-950/60 border-zinc-800/60 text-zinc-600"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-white">{item.day}</span>
                    {hasTrades && (
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.2 rounded border uppercase",
                        isProfit ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                        isLoss ? "bg-rose-500/20 border-rose-500/40 text-rose-400" :
                        "bg-zinc-800 border-zinc-700 text-zinc-400"
                      )}>
                        {item.count} T
                      </span>
                    )}
                  </div>

                  {hasTrades ? (
                    <div className="space-y-1">
                      <div className={cn("text-xs font-black tracking-tight", isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-zinc-300")}>
                        {formatCurrency(item.pnl, true)}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-bold">
                        {item.winPct}% Win Rate
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-700 font-bold uppercase">NO TRADES</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW MODE 2: BLOTTER TABLE */}
      {viewMode === 'blotter' && (
        <section className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl font-mono">
            <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto">
              {/* Outcome */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trade Result</label>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="w-[160px] h-10 bg-zinc-950 border-zinc-800 text-xs font-bold text-zinc-200 rounded-xl">
                    <SelectValue placeholder="Outcome" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="win" className="text-emerald-400">Wins</SelectItem>
                    <SelectItem value="loss" className="text-rose-400">Losses</SelectItem>
                    <SelectItem value="open" className="text-amber-400">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Market */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Market Sector</label>
                <Select value={marketFilter} onValueChange={setMarketFilter}>
                  <SelectTrigger className="w-[160px] h-10 bg-zinc-950 border-zinc-800 text-xs font-bold text-zinc-200 rounded-xl">
                    <SelectValue placeholder="Market" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                    <SelectItem value="all">All Markets</SelectItem>
                    <SelectItem value="futures">Futures</SelectItem>
                    <SelectItem value="cfds">CFDs / Forex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter Badge if Active */}
              {selectedDateFilter && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date Focus</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <span>{selectedDateFilter}</span>
                    <button onClick={() => setSelectedDateFilter(null)} className="p-0.5 hover:bg-emerald-500/20 rounded">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-zinc-400 font-bold">
              Showing <span className="text-white font-black">{filteredTrades.length}</span> of <span className="text-zinc-500">{trades.length}</span> Records
            </div>
          </div>

          {/* Blotter Table */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-2xl font-mono">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Symbol / Tags</th>
                    <th className="px-6 py-4">Direction</th>
                    <th className="px-6 py-4 text-right">Entry</th>
                    <th className="px-6 py-4 text-right">Exit</th>
                    <th className="px-6 py-4 text-right">Net P&L ($)</th>
                    <th className="px-6 py-4 text-right">R:R</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-3">
                          <History size={32} className="text-zinc-600" />
                          <p className="font-bold uppercase tracking-wider text-zinc-400">NO TRADE RECORDS FOUND</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map((trade) => {
                      const tags = trade.tags && trade.tags.length > 0 ? trade.tags : autoTagTrade(trade);
                      const isWin = trade.status === 'win' || trade.pnl > 0;
                      const isLoss = trade.status === 'loss' || trade.pnl < 0;

                      return (
                        <tr
                          key={trade.id}
                          onClick={() => setSelectedTrade(trade)}
                          className="hover:bg-zinc-800/40 transition-colors duration-150 cursor-pointer group"
                        >
                          {/* Date */}
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-300 font-bold">
                            {formatDate(trade.trade_date)}
                          </td>

                          {/* Symbol & Tags */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="font-black text-sm text-white tracking-tight">{trade.ticker}</span>
                              <div className="flex flex-wrap gap-1">
                                {tags.map((tg, idx) => (
                                  <span key={idx} className="px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 text-[9px]">
                                    {tg}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* Direction */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                              trade.direction === 'long' 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            )}>
                              {trade.direction}
                            </span>
                          </td>

                          {/* Entry */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-zinc-300 font-bold">
                            ${Number(trade.entry_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Exit */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-zinc-300 font-bold">
                            {trade.exit_price ? `$${Number(trade.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </td>

                          {/* Net PnL */}
                          <td className="px-6 py-4 whitespace-nowrap text-right font-black text-sm">
                            <span className={isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-zinc-400"}>
                              {formatCurrency(trade.pnl, true)}
                            </span>
                          </td>

                          {/* R:R or Warning Pill */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {!trade.stop_loss || trade.stop_loss === 0 || !trade.risk_reward_ratio || trade.risk_reward_ratio === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                                NO SL / UNHEDGED
                              </span>
                            ) : (
                              <div className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold text-xs">
                                1:{trade.risk_reward_ratio.toFixed(2)}
                              </div>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => handleDelete(e, trade.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 text-zinc-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Trade"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Trade Details & Replay Modal */}
      {selectedTrade && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono transform-gpu"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTrade(null); }}
        >
          <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <span className="text-base font-black text-white">{selectedTrade.ticker} Trade Execution Blueprint</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border",
                  selectedTrade.pnl >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                )}>
                  {selectedTrade.pnl >= 0 ? 'PROFIT' : 'LOSS'} ({formatCurrency(selectedTrade.pnl, true)})
                </span>
              </div>

              <button 
                onClick={() => setSelectedTrade(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Scroll */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Candlestick Execution Blueprint Chart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 uppercase font-bold">
                  <span>EXECUTION BLUEPRINT (CANDLESTICK OVERLAY)</span>
                  <span>ENTRY (CYAN) • EXIT (EMERALD) • STOP LOSS (ROSE)</span>
                </div>
                <div className="h-[360px] rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
                  <TradeExecutionChart 
                    entryPrice={selectedTrade.entry_price}
                    exitPrice={selectedTrade.exit_price}
                    stopLoss={selectedTrade.stop_loss}
                    ticker={selectedTrade.ticker}
                    direction={selectedTrade.direction}
                    pnl={selectedTrade.pnl}
                    height={360}
                  />
                </div>
              </div>

              {/* AI Diagnostic REVISION_6.0 */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-400 uppercase">AI DIAGNOSTIC REVISION_6.0</div>
                <AIDiagnosticModal trade={selectedTrade} asModal={false} />
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
