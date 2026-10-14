/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllTrades, deleteTrade, updateTrade, deleteAllTrades } from '@/lib/trades';
import { useAuth } from '@/lib/auth';
import { useTrades } from '@/context/TradeContext';
import { Trade } from '@/types';
import { analyzeTrade } from '@/lib/universal-ai';
import { isAIActive } from '@/lib/keys';
import { cn, getMarketTypeFromTicker } from '@/lib/utils';
import { TradeExecutionChart } from '@/components/TradeExecutionChart';
import { AIDiagnosticModal } from '@/components/AIDiagnosticModal';
import { 
  Shield,
  Activity,
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  History,
  Calendar,
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
  Image as ImageIcon
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
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

export const JournalHistory = () => {
  const { isAdmin, impersonatingUserId } = useAuth();
  const { trades, loading, setTrades, refetchTrades } = useTrades();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [hasAIKey, setHasAIKey] = useState(false);

  // Filters state
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');

  useEffect(() => {
    setHasAIKey(isAIActive());
  }, []);

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
    // Optimistic UI Update: immediately remove from state for 0-latency feel
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
      // Rollback on network/DB failure
      setTrades(previousTrades);
      toast.error('Failed to sync deletion with database. Restoring entry.');
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
        toast.error('Failed to purge database. Restoring records.');
      }
    }
  };

  const handleAskAI = async (trade: Trade) => {
    setAnalyzing(true);
    setAiReport(null);
    try {
      const report = await analyzeTrade(trade);
      setAiReport(report);
    } catch (error: any) {
      console.error('AI Error:', error);
      setAiReport(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredTrades = trades.filter(trade => {
    const matchesOutcome = outcomeFilter === 'all' || trade.status === outcomeFilter;
    const matchesMarket = marketFilter === 'all' || trade.market_type === marketFilter;
    return matchesOutcome && matchesMarket;
  });

  // TanStack Virtualizer for high-frequency journal log scaling
  const parentScrollRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredTrades.length,
    getScrollElement: () => parentScrollRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  // Stats calculation
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winCount = trades.filter(t => t.status === 'win').length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
  
  const assetPnL: Record<string, number> = {};
  trades.forEach(t => {
    assetPnL[t.ticker] = (assetPnL[t.ticker] || 0) + t.pnl;
  });
  const bestAsset = Object.keys(assetPnL).length > 0 
    ? Object.keys(assetPnL).reduce((a, b) => assetPnL[a] > assetPnL[b] ? a : b) 
    : 'None';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const calculateRR = (trade: Trade) => {
    if (trade.risk_reward_ratio && trade.risk_reward_ratio !== 0) return trade.risk_reward_ratio.toFixed(2);
    if (!trade.stop_loss || trade.stop_loss === 0 || !trade.exit_price || trade.exit_price === 0) return '0.00';
    
    const entry = trade.entry_price;
    const exit = trade.exit_price;
    const stop = trade.stop_loss;
    const direction = trade.direction;

    const riskPoints = direction === 'long' ? entry - stop : stop - entry;
    const rewardPoints = direction === 'long' ? exit - entry : entry - exit;

    if (riskPoints === 0) return '0.00';
    return (rewardPoints / riskPoints).toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-primary/20 rounded-full animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div className="absolute -inset-4 border border-primary/10 rounded-full animate-ping opacity-20" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-foreground animate-pulse">System Scanning</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Synchronizing neural trade clusters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-20">
      <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
            <span>Journal</span> / <span className="font-bold text-foreground">History</span>
          </div>
          <h1 className="text-3xl md:text-[40px] font-bold text-foreground leading-tight tracking-tight">
            Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Professional insight into your trading history and execution.</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={handleDeleteAll}
            variant="outline" 
            className="w-full md:w-auto border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive rounded-xl justify-center h-10 px-6 font-bold"
          >
            <Trash2 size={16} className="mr-2" />
            Database Cleanup
          </Button>
        )}
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all font-sans"
        >
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Total PnL</span>
            <div className={cn(
              "text-2xl font-extrabold tracking-tighter",
              totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {formatCurrency(totalPnL)}
            </div>
          </div>
          <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center border border-border group-hover:scale-110 transition-transform">
            <DollarSign size={20} className={totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all font-sans"
        >
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Win Rate</span>
            <div className="text-2xl font-extrabold tracking-tighter text-foreground">
              {winRate.toFixed(1)}%
            </div>
          </div>
          <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center border border-border group-hover:scale-110 transition-transform">
            <Target size={20} className="text-indigo-400" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all font-sans"
        >
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Top Asset</span>
            <div className="text-2xl font-extrabold tracking-tighter text-foreground">
              {bestAsset}
            </div>
          </div>
          <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center border border-border group-hover:scale-110 transition-transform">
            <TrendingUp size={20} className="text-amber-400" />
          </div>
        </motion.div>
      </div>

      {/* Filter Bar */}
      <div className="bg-muted/20 border border-border rounded-3xl p-6 mb-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="flex flex-wrap items-center gap-10 w-full lg:w-auto">
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-1">
              <Filter size={12} className="text-primary" />
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Trade Result</label>
            </div>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-12 bg-card border-border text-xs font-bold focus:ring-0 shadow-lg shadow-black/5 rounded-xl cursor-pointer hover:bg-muted/50 data-[state=open]:bg-muted/50 transition-all">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-xl shadow-2xl">
                <SelectItem value="all" className="font-bold cursor-pointer">All Outcomes</SelectItem>
                <SelectItem value="win" className="text-emerald-500 font-bold cursor-pointer">Wins</SelectItem>
                <SelectItem value="loss" className="text-rose-500 font-bold cursor-pointer">Losses</SelectItem>
                <SelectItem value="breakeven" className="cursor-pointer">Breakeven</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={12} className="text-indigo-400" />
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Market Sector</label>
            </div>
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-12 bg-card border-border text-xs font-bold focus:ring-0 shadow-lg shadow-black/5 rounded-xl cursor-pointer hover:bg-muted/50 data-[state=open]:bg-muted/50 transition-all">
                <SelectValue placeholder="Market" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-xl shadow-2xl">
                <SelectItem value="all" className="font-bold cursor-pointer">All Markets</SelectItem>
                <SelectItem value="futures" className="cursor-pointer">Futures</SelectItem>
                <SelectItem value="cfds" className="cursor-pointer">CFDs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full lg:w-auto bg-muted px-6 py-3 rounded-2xl border border-border/50 flex items-center justify-between lg:justify-start gap-4">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-80">
            Records found:
          </span>
          <span className="text-sm font-black text-foreground">{filteredTrades.length} / {trades.length}</span>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        <div ref={parentScrollRef} className="overflow-x-auto max-h-[680px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700/40">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-muted border-b border-border shadow-sm">
              <tr>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Symbol</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Side</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Entry</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Exit</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">PnL ($)</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">R:R</th>
                <th className="px-6 py-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(!filteredTrades || filteredTrades.length === 0) ? (
                <tr>
                  <td colSpan={8} className="px-6 py-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center text-muted-foreground/20 text-indigo-500/30">
                        <History size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-widest opacity-40">No records found</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-20">Initialize a trade entry to begin tracking</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const trade = filteredTrades[virtualRow.index];
                  if (!trade) return null;

                  return (
                    <tr 
                      key={`${trade.id}-${virtualRow.index}`} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedTrade(trade);
                        setAiReport(trade.ai_analysis || null);
                      }}
                    >
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-foreground font-bold">
                        {formatDate(trade.trade_date)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col font-sans">
                          <span className="font-extrabold text-foreground tracking-tight text-lg">{trade.ticker}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
                            {trade.market_type || getMarketTypeFromTicker(trade.ticker)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider rounded-lg border px-3 py-1 font-sans",
                            trade.direction === 'long' 
                              ? "bg-green-500/10 text-green-500 border-green-500/20" 
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          )}
                        >
                          {trade.direction}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-mono text-muted-foreground font-bold">
                        {trade.entry_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-mono text-muted-foreground font-bold">
                        {trade.exit_price && trade.exit_price > 0 ? trade.exit_price.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-mono">
                        <span className={cn(
                          "font-extrabold text-base",
                          trade.pnl > 0 ? "text-emerald-500" : trade.pnl < 0 ? "text-rose-500" : "text-muted-foreground"
                        )}>
                          {trade.pnl > 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-lg border border-border text-[11px] font-bold text-foreground">
                          {trade.risk_reward_ratio ? trade.risk_reward_ratio.toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <button 
                          onClick={(e) => handleDelete(e, trade.id)}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-destructive/10 transition-all text-muted-foreground hover:text-destructive group/btn"
                          title="Delete Trade"
                        >
                          <Trash2 size={16} className="opacity-0 group-hover:opacity-100 transition-all" />
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

      {/* Trade Details Modal */}
      {selectedTrade && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTrade(null);
          }}
        >
          <div className="relative flex w-full max-w-6xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
            {/* Absolute Close Button */}
            <button 
              onClick={() => setSelectedTrade(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>

            {/* Left Pane */}
            <div className="w-[350px] shrink-0 border-r border-zinc-800 bg-zinc-950/50 p-6 flex flex-col overflow-y-auto">
              <header className="pb-6 border-b border-zinc-800 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <Badge className={cn(
                    "uppercase tracking-wider text-[10px] py-1 px-3 rounded-sm font-mono font-bold border",
                    selectedTrade.pnl > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : 
                    selectedTrade.pnl < 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : 
                    "bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}>
                    {selectedTrade.pnl > 0 ? 'WIN' : selectedTrade.pnl < 0 ? 'LOSS' : 'BREAKEVEN'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h2 className="text-4xl font-mono font-bold text-white tracking-tight leading-none uppercase">
                    {selectedTrade.ticker}
                  </h2>
                  <div className="flex items-center gap-2 text-zinc-500 mt-2 font-mono text-xs">
                    <Calendar size={13} className="text-zinc-500" />
                    <span className="uppercase tracking-wider">
                      {formatDate(selectedTrade.trade_date)}
                    </span>
                  </div>
                </div>
              </header>

              <div className="py-6 space-y-3 flex-1">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Net Realized P/L</span>
                  <span className={cn(
                    "text-2xl font-mono font-bold tracking-tight",
                    selectedTrade.pnl > 0 ? "text-emerald-400" : selectedTrade.pnl < 0 ? "text-rose-400" : "text-zinc-300"
                  )}>
                    {formatCurrency(selectedTrade.pnl)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Efficiency</span>
                    <span className="text-base font-mono font-bold text-zinc-200">{calculateRR(selectedTrade)}R</span>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Side</span>
                    <span className={cn(
                      "text-base font-mono font-bold uppercase",
                      selectedTrade.direction === 'long' ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {selectedTrade.direction}
                    </span>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Volume</span>
                    <span className="text-base font-mono font-bold text-zinc-200">
                      {selectedTrade.position_size} <span className="text-[10px] font-mono text-zinc-500 uppercase">{selectedTrade.size_type || 'units'}</span>
                    </span>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Asset</span>
                    <span className="text-base font-mono font-bold text-zinc-300 uppercase truncate block">
                      {selectedTrade.market_type || getMarketTypeFromTicker(selectedTrade.ticker)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-md p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">System Telemetry</span>
                    </div>
                    <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                      Execution synchronized via terminal clusters. Cryptographically audited.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Pane */}
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent space-y-8">
              {/* Narrative Section */}
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                    <MessageSquare size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Execution Narrative</h3>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Internal Intelligence Transcript</p>
                  </div>
                </div>
                
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-md p-4 min-h-[120px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/60" />
                  {selectedTrade.notes ? (
                    <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap font-sans max-w-3xl">
                      {selectedTrade.notes}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-600">
                      <History size={28} className="mb-2" />
                      <p className="text-xs font-mono uppercase tracking-widest">No cognitive narrative logged</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Visual Evidence Gallery */}
              {selectedTrade.image_urls && selectedTrade.image_urls.length > 0 && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                      <ImageIcon size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Visual Evidence</h3>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">High-Resolution Chart Captures</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedTrade.image_urls.map((url, i) => (
                      <div key={i} className="aspect-video rounded-md overflow-hidden border border-zinc-800 group cursor-zoom-in transition-all hover:border-zinc-700">
                        <img 
                          src={url} 
                          alt={`Evidence ${i + 1}`} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Interactive Execution Candlestick Chart */}
              <section className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                    <BarChart3 size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Execution Blueprint</h3>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Interactive OHLC Candlestick Engine</p>
                  </div>
                </div>
                <div className="h-[360px] min-h-[360px]">
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
              </section>

              {/* AI Diagnostic v5.0 Live Behavioral & Risk Audit */}
              <section className="animate-in fade-in slide-in-from-bottom-8 duration-600 pb-4">
                <AIDiagnosticModal trade={selectedTrade} asModal={false} />
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
