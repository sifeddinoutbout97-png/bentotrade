import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  Cpu, 
  Compass, 
  RefreshCw, 
  Flame, 
  Scale, 
  Zap, 
  Bot, 
  Binary, 
  Layers,
  ArrowRight,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trade } from '@/types';
import { useNavigate } from 'react-router-dom';
import { calculateKellyCriterion } from '@/utils/institutionalQuant';
import { MonteCarloWorkerResult } from '@/workers/monteCarloWorker';
import { useSubscription } from '@/hooks/useSubscription';
import { PricingModal } from '@/components/PricingModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { calculatePerformanceAnalytics, evaluateGuardrails, GuardrailAlert } from '@/lib/quant-engine';

export interface AIPerformanceEngineProps {
  trades: Trade[];
  className?: string;
}

type TabType = 'statistical_edge' | 'guardrails' | 'blind_spots';

export const AIPerformanceEngine: React.FC<AIPerformanceEngineProps> = ({
  trades = [],
  className
}) => {
  const navigate = useNavigate();
  const { subState, isPricingModalOpen, openPricingModal, closePricingModal, upgradePlan, loading: subLoading } = useSubscription();

  const [activeTab, setActiveTab] = useState<TabType>('statistical_edge');
  
  // Dialog state for quick action triggers
  const [isMonteCarloModalOpen, setIsMonteCarloModalOpen] = useState(false);
  const [isKellyModalOpen, setIsKellyModalOpen] = useState(false);

  // Web Worker Monte Carlo result state
  const [mcResult, setMcResult] = useState<MonteCarloWorkerResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  // Compute Institutional Edge & Behavioral Metrics using lib/quant-engine Modules 1 & 4
  const analytics = useMemo(() => {
    return calculatePerformanceAnalytics(trades);
  }, [trades]);

  const guardrailAlerts = useMemo(() => {
    return evaluateGuardrails(trades, 50000);
  }, [trades]);

  const analysis = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        expectancyDollars: 0,
        expectancyR: 0,
        realizedRR: 0,
        netProfitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        avgWin: 0,
        avgLoss: 0,
        winStreak: 0,
        lossStreak: 0,
        currentStreak: 0,
        currentStreakType: 'none' as 'win' | 'loss' | 'none',
        blindSpots: ['No execution logs recorded yet. Log trades to activate heuristic intelligence.'] as string[],
        edgeRating: 'ZERO BASELINE'
      };
    }

    // Sort chronologically (oldest to newest)
    const sorted = [...trades].sort(
      (a, b) => new Date(a.trade_date || a.created_at).getTime() - new Date(b.trade_date || b.created_at).getTime()
    );

    // Calculate Win Streak / Loss Streak telemetry
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    for (const t of sorted) {
      const isWin = t.status === 'win' || Number(t.pnl) > 0;
      if (isWin) {
        tempWinStreak++;
        tempLossStreak = 0;
        if (tempWinStreak > maxWinStreak) maxWinStreak = tempWinStreak;
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        if (tempLossStreak > maxLossStreak) maxLossStreak = tempLossStreak;
      }
    }

    // Determine current streak
    const reversed = [...sorted].reverse();
    let currentStreak = 0;
    let currentStreakType: 'win' | 'loss' | 'none' = 'none';

    if (reversed.length > 0) {
      const firstIsWin = reversed[0].status === 'win' || Number(reversed[0].pnl) > 0;
      currentStreakType = firstIsWin ? 'win' : 'loss';
      for (const t of reversed) {
        const isWin = t.status === 'win' || Number(t.pnl) > 0;
        if ((firstIsWin && isWin) || (!firstIsWin && !isWin)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Heuristic Blind Spots
    const blindSpots: string[] = [];
    const tradesWithoutStop = sorted.filter(t => !t.stop_loss || Number(t.stop_loss) === 0).length;
    if (tradesWithoutStop > 0) {
      blindSpots.push(
        `Naked Downside Exposure: ${tradesWithoutStop} trade${tradesWithoutStop > 1 ? 's' : ''} executed without recorded hard stops. One tail event can compromise expectancy.`
      );
    }

    if (maxLossStreak >= 3) {
      blindSpots.push(
        `Drawdown Resilience: Max consecutive loss streak reached ${maxLossStreak} trades. Verify contract size compression formula during regime shifts.`
      );
    }

    if (analytics.netProfitFactor < 1.0 && analytics.totalTrades > 2) {
      blindSpots.push(
        `Friction Friction Drag: Net Profit Factor (${analytics.netProfitFactor}) is below 1.0 due to commissions or slippage drag.`
      );
    }

    if (blindSpots.length === 0) {
      blindSpots.push(
        `Optimal Heuristic Calibration: Execution variance remains within standard Gaussian parameters. Maintain predetermined risk thresholds.`
      );
    }

    let edgeRating = 'NEUTRAL';
    if (analytics.expectancyR > 0.4 && analytics.profitFactor > 1.6) edgeRating = 'INSTITUTIONAL';
    else if (analytics.expectancyR > 0.15 && analytics.profitFactor > 1.15) edgeRating = 'POSITIVE EDGE';
    else if (analytics.expectancyR < 0) edgeRating = 'NEGATIVE DRIFT';

    return {
      totalTrades: sorted.length,
      winRate: analytics.winRate,
      profitFactor: analytics.profitFactor,
      expectancyDollars: analytics.expectancyDollars,
      expectancyR: analytics.expectancyR,
      realizedRR: analytics.realizedRR,
      netProfitFactor: analytics.netProfitFactor,
      sharpeRatio: analytics.sharpeRatio,
      sortinoRatio: analytics.sortinoRatio,
      avgWin: analytics.avgWinDollars,
      avgLoss: analytics.avgLossDollars,
      winStreak: maxWinStreak,
      lossStreak: maxLossStreak,
      currentStreak,
      currentStreakType,
      blindSpots,
      edgeRating
    };
  }, [trades, analytics]);

  // Execute Web Worker Monte Carlo simulation on demand
  const handleTriggerMonteCarlo = () => {
    setIsMonteCarloModalOpen(true);
    if (!trades || trades.length < 3) {
      toast.info('Monte Carlo requires at least 3 historical trades for bootstrapping.');
      return;
    }

    const pnls = trades.map(t => Number(t.pnl) || 0).filter(p => !isNaN(p));
    setMcRunning(true);

    try {
      const worker = new Worker(
        new URL('../workers/monteCarloWorker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<MonteCarloWorkerResult>) => {
        setMcResult(event.data);
        setMcRunning(false);
        worker.terminate();
        toast.success('10,000-Path Monte Carlo simulation completed off-thread!');
      };

      worker.onerror = () => {
        setMcRunning(false);
        worker.terminate();
        toast.error('Monte Carlo worker encountered an error.');
      };

      worker.postMessage({
        pnls,
        iterations: 10000,
        riskThreshold: 0.2
      });
    } catch (e) {
      setMcRunning(false);
      toast.error('Failed to initialize Monte Carlo Web Worker.');
    }
  };

  // Kelly Criterion dynamic calculation
  const kellyMetrics = useMemo(() => {
    return calculateKellyCriterion(analysis.winRate, analysis.avgWin, analysis.avgLoss);
  }, [analysis.winRate, analysis.avgWin, analysis.avgLoss]);

  return (
    <>
      <Card className={cn(
        "rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl text-zinc-100 p-6 sm:p-7 md:p-8 flex flex-col group overflow-hidden relative transition-colors duration-150 hover:bg-zinc-900/60",
        className
      )}>
        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.02] border border-white/[0.03] flex items-center justify-center text-zinc-500 shrink-0">
              <BrainCircuit size={15} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono flex items-center gap-2">
                <span>AI Performance Engine</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  v5.0 Quant Core
                </span>
              </h3>
            </div>
          </div>

          {/* Top Action Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.015] border border-white/[0.03] text-[10px] font-mono font-medium uppercase tracking-wider overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('statistical_edge')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === 'statistical_edge'
                  ? "bg-white/[0.04] text-zinc-200 border border-white/[0.04]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <TrendingUp size={11} className={activeTab === 'statistical_edge' ? "text-zinc-300" : "text-zinc-600"} />
              <span>Statistical Edge</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guardrails')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 relative shrink-0",
                activeTab === 'guardrails'
                  ? "bg-white/[0.04] text-zinc-200 border border-white/[0.04]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <ShieldAlert size={11} className={activeTab === 'guardrails' ? "text-zinc-300" : "text-zinc-600"} />
              <span>Guardrails ({guardrailAlerts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blind_spots')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === 'blind_spots'
                  ? "bg-white/[0.04] text-zinc-200 border border-white/[0.04]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <Compass size={11} className={activeTab === 'blind_spots' ? "text-zinc-300" : "text-zinc-600"} />
              <span>Blind Spots</span>
            </button>
          </div>
        </div>

        {/* 2. Enhanced High-Density Metric Cards Grid (Module 1 Analytics) */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5 z-10"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: [0.98, 1.015, 1],
            transition: {
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
              staggerChildren: 0.06
            }
          }}
        >
          {/* EXPECTANCY ($ & R) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.04, ease: 'easeOut' }}
            className="p-4 sm:p-5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-2 flex flex-col justify-between hover:bg-white/[0.02] transition-all duration-300"
          >
            <div className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono flex items-center justify-between">
              <span>Expectancy ($ / R)</span>
            </div>
            <div>
              <div className={cn(
                "text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums text-zinc-100"
              )}>
                {analysis.totalTrades === 0 
                  ? '0.00R' 
                  : analysis.expectancyR >= 0 
                    ? `+${analysis.expectancyR.toFixed(2)}R` 
                    : `${analysis.expectancyR.toFixed(2)}R`}
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                ${analysis.expectancyDollars.toFixed(2)} / trade
              </span>
            </div>
          </motion.div>

          {/* PROFIT FACTOR */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
            className="p-4 sm:p-5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-2 flex flex-col justify-between hover:bg-white/[0.02] transition-all duration-300"
          >
            <div className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              <span>Profit Factor</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums text-zinc-100">
                {analysis.profitFactor.toFixed(2)}
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                Net PF: {analysis.netProfitFactor.toFixed(2)}
              </span>
            </div>
          </motion.div>

          {/* REAL R:R */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' }}
            className="p-4 sm:p-5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-2 flex flex-col justify-between hover:bg-white/[0.02] transition-all duration-300"
          >
            <div className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              <span>Realized R:R</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums text-zinc-100">
                1:{analysis.realizedRR.toFixed(2)}
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                Avg Win: ${analysis.avgWin.toFixed(0)}
              </span>
            </div>
          </motion.div>

          {/* SHARPE / SORTINO */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
            className="p-4 sm:p-5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-2 flex flex-col justify-between hover:bg-white/[0.02] transition-all duration-300"
          >
            <div className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              <span>Sharpe / Sortino</span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums text-zinc-100 flex items-center gap-1.5">
                <span>{analysis.sharpeRatio.toFixed(2)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-emerald-400">{analysis.sortinoRatio.toFixed(2)}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                Annualized Telemetry
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Tab Detail View */}
        <div className="flex-1 space-y-3 z-10 mb-4">
          {activeTab === 'statistical_edge' && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] flex items-start gap-3 animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs font-mono min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-400 uppercase tracking-wide">Edge Classification:</span>
                  <span className="px-2 py-0.5 rounded bg-white/[0.02] text-zinc-300 text-[10px] font-bold border border-white/[0.03] font-mono shrink-0">
                    {analysis.edgeRating}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                  {analysis.expectancyR > 0 
                    ? `Mathematical edge confirmed (+${analysis.expectancyR.toFixed(2)}R per execution). System compounds positive expectancy under disciplined risk limits.` 
                    : analysis.totalTrades === 0
                      ? `Awaiting trade entries to calibrate quantitative distribution.`
                      : `Expectancy is currently negative (${analysis.expectancyR.toFixed(2)}R). Review stop loss discipline and avoid position size escalation.`}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'guardrails' && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800">
                {guardrailAlerts.length > 0 ? (
                  guardrailAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs leading-relaxed space-y-0.5 font-mono",
                        alert.severity === 'CRITICAL' && "bg-rose-950/20 border-rose-500/40 text-rose-200",
                        alert.severity === 'WARNING' && "bg-amber-950/20 border-amber-500/40 text-amber-200"
                      )}
                    >
                      <div className="flex items-center justify-between font-bold text-[10px] uppercase tracking-wide">
                        <div className="flex items-center gap-1.5">
                          {alert.severity === 'CRITICAL' ? (
                            <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                          ) : (
                            <Flame size={12} className="text-amber-500 shrink-0" />
                          )}
                          <span>{alert.title}</span>
                        </div>
                        <span className="text-[9px] text-zinc-400 font-mono">{alert.metricBreached}</span>
                      </div>
                      <p className="text-[11px] opacity-90 font-sans pt-0.5">
                        {alert.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl border bg-zinc-900/60 border-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Guardrails Clean: Zero revenge entries, size spikes, or drawdown limits breached.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'blind_spots' && (
            <div className="space-y-2 animate-in fade-in duration-200">
              {analysis.blindSpots.map((spot, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] text-xs font-mono text-zinc-300 flex items-start gap-2">
                  <Compass size={14} className="text-zinc-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{spot}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-white/[0.03] z-10 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerMonteCarlo}
              className="px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] text-zinc-300 font-medium tracking-wider uppercase flex items-center gap-1.5 transition-all text-[11px]"
            >
              <Cpu size={12} className="text-primary" />
              <span>10k-Path Monte Carlo</span>
            </button>

            <button
              type="button"
              onClick={() => setIsKellyModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] text-zinc-300 font-medium tracking-wider uppercase flex items-center gap-1.5 transition-all text-[11px]"
            >
              <Target size={12} className="text-emerald-400" />
              <span>Kelly Sizing: {kellyMetrics.halfKellyPct}%</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/ai-insights')}
            className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 text-[11px] uppercase font-bold"
          >
            <span>Full Analysis</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </Card>

      {/* Dialog: Monte Carlo Results Modal */}
      <Dialog open={isMonteCarloModalOpen} onOpenChange={setIsMonteCarloModalOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl max-w-xl text-zinc-100 font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-zinc-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span>10,000-Path Monte Carlo Simulation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Off-thread bootstrap simulation modeling 10,000 future equity curve trajectories based on historical PnL distribution.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {mcRunning ? (
              <div className="p-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-xs text-zinc-400">Simulating 10,000 execution paths in Web Worker...</p>
              </div>
            ) : mcResult ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Probability of Ruin (&gt;20% DD)</span>
                  <div className="text-base font-bold text-amber-400">{(mcResult.ruinProbability * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Median Projected Drawdown</span>
                  <div className="text-base font-bold text-rose-400">${mcResult.medianDrawdown.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Max Simulated Drawdown</span>
                  <div className="text-base font-bold text-rose-500">${mcResult.maxDrawdown.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Sampled Trajectories</span>
                  <div className="text-base font-bold text-emerald-400">{mcResult.pathsSampled.toLocaleString()} Paths</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-4">Click below to initiate off-thread simulation.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Kelly Criterion Modal */}
      <Dialog open={isKellyModalOpen} onOpenChange={setIsKellyModalOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl max-w-md text-zinc-100 font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-zinc-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Kelly Criterion Capital Allocation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Optimal mathematical fraction of capital to risk per trade to maximize logarithmic growth rate.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex justify-between items-center">
              <span className="text-zinc-400">Full Kelly Strategy:</span>
              <span className="font-bold text-zinc-200">{kellyMetrics.fullKellyPct}% of equity</span>
            </div>
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex justify-between items-center">
              <span className="text-emerald-300 font-bold">Institutional Half-Kelly (Recommended):</span>
              <span className="font-black text-emerald-400">{kellyMetrics.halfKellyPct}% of equity</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
              Half-Kelly allocation cuts volatility by 50% while retaining ~75% of maximum theoretical growth speed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
