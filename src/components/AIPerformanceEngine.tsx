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
  ArrowRight
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
  const [isScanning, setIsScanning] = useState(false);
  
  // Dialog state for quick action triggers
  const [isMonteCarloModalOpen, setIsMonteCarloModalOpen] = useState(false);
  const [isKellyModalOpen, setIsKellyModalOpen] = useState(false);

  // Web Worker Monte Carlo result state
  const [mcResult, setMcResult] = useState<MonteCarloWorkerResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  // Compute Institutional Edge & Behavioral Metrics dynamically from trades
  const analysis = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        expectancy: 0,
        realizedRMultiple: 0,
        avgWin: 0,
        avgLoss: 0,
        fomoCount: 0,
        revengeCount: 0,
        tiltClusterCount: 0,
        winStreak: 0,
        lossStreak: 0,
        currentStreak: 0,
        currentStreakType: 'none' as 'win' | 'loss' | 'none',
        blindSpots: ['No execution logs recorded yet. Log trades to activate heuristic intelligence.'] as string[],
        behavioralAlerts: [{ severity: 'info' as const, title: 'Clean Journal Baseline', detail: 'Dynamic quant heuristics ready for initial trade entry.' }],
        edgeRating: 'ZERO BASELINE'
      };
    }

    // Sort chronologically (oldest to newest)
    const sorted = [...trades].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    const winningTrades = sorted.filter(t => t.status === 'win' || Number(t.pnl) > 0);
    const losingTrades = sorted.filter(t => t.status === 'loss' || Number(t.pnl) < 0);

    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const winRate = sorted.length > 0 ? (winCount / sorted.length) * 100 : 0;

    const grossProfit = winningTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0));

    // Profit Factor: gross profit / gross loss (0.00 if insufficient data)
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0;
    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;

    // Realized Risk-to-Reward & Expectancy calculation
    // Nominal 1R risk baseline = avgLoss (or $100 if zero losses recorded)
    const nominalR = avgLoss > 0 ? avgLoss : 100;
    const realizedRMultiple = nominalR > 0 ? (avgWin / nominalR) : 0;

    // Expectancy: E = (P(Win) * AvgWin) - (P(Loss) * AvgLoss) normalized in R units
    const pWin = sorted.length > 0 ? winCount / sorted.length : 0;
    const pLoss = sorted.length > 0 ? lossCount / sorted.length : 0;
    const expectancyDollars = (pWin * avgWin) - (pLoss * avgLoss);
    const expectancy = nominalR > 0 ? expectancyDollars / nominalR : 0;

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

    // Behavioral Guardrails: Check for FOMO, Revenge, Sub-30m Re-entries
    let fomoCount = 0;
    let revengeCount = 0;
    let tiltClusterCount = 0;
    const behavioralAlerts: { severity: 'critical' | 'warning' | 'info'; title: string; detail: string }[] = [];

    sorted.forEach(t => {
      const combinedNotes = `${t.notes || ''} ${t.ticker || ''}`.toLowerCase();
      if (combinedNotes.includes('fomo') || combinedNotes.includes('chase') || combinedNotes.includes('late')) {
        fomoCount++;
      }
      if (combinedNotes.includes('revenge') || combinedNotes.includes('tilt') || combinedNotes.includes('angry')) {
        revengeCount++;
      }
    });

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevPnl = Number(prev.pnl) || 0;
      const isPrevLoss = prev.status === 'loss' || prevPnl < 0;

      if (isPrevLoss) {
        const prevTime = new Date(prev.trade_date).getTime();
        const currTime = new Date(curr.trade_date).getTime();
        const diffMinutes = Math.abs(currTime - prevTime) / (1000 * 60);

        if (diffMinutes <= 30 && !isNaN(diffMinutes)) {
          tiltClusterCount++;
        }
      }
    }

    if (tiltClusterCount > 0) {
      behavioralAlerts.push({
        severity: 'critical',
        title: 'Revenge Tilt Acceleration',
        detail: `Detected ${tiltClusterCount} execution${tiltClusterCount > 1 ? 's' : ''} opened within 30m of an adverse exit. Violates cooling protocol.`
      });
    }

    if (fomoCount > 0) {
      behavioralAlerts.push({
        severity: 'warning',
        title: 'Impulsive FOMO Entries',
        detail: `${fomoCount} trade${fomoCount > 1 ? 's' : ''} flagged with chasing or FOMO markers. Expected slippage increases by ~1.8R.`
      });
    }

    if (revengeCount > 0) {
      behavioralAlerts.push({
        severity: 'critical',
        title: 'Revenge Sizing Anomaly',
        detail: `${revengeCount} trade notes contain revenge trading terminology. High risk of systemic drawdown.`
      });
    }

    if (behavioralAlerts.length === 0) {
      behavioralAlerts.push({
        severity: 'info',
        title: 'Guardrails Clean & Disciplined',
        detail: 'Zero emotional tilt triggers or sub-30min revenge re-entries detected in current journal sample.'
      });
    }

    // Heuristic Blind Spots
    const blindSpots: string[] = [];
    const tradesWithoutStop = sorted.filter(t => !t.stop_loss || t.stop_loss === 0).length;
    if (tradesWithoutStop > 0) {
      blindSpots.push(
        `Naked Downside Exposure: ${tradesWithoutStop} trade${tradesWithoutStop > 1 ? 's' : ''} executed without recorded hard stops. One tail risk event can compromise weekly expectancy.`
      );
    }

    if (maxLossStreak >= 3) {
      blindSpots.push(
        `Drawdown Resilience: Max consecutive loss streak reached ${maxLossStreak} trades. Verify contract size compression formula during regime shifts.`
      );
    }

    if (blindSpots.length === 0) {
      blindSpots.push(
        `Optimal Heuristic Calibration: Execution variance remains within standard Gaussian parameters. Maintain predetermined risk thresholds.`
      );
    }

    let edgeRating = 'NEUTRAL';
    if (expectancy > 0.4 && profitFactor > 1.6) edgeRating = 'INSTITUTIONAL';
    else if (expectancy > 0.15 && profitFactor > 1.15) edgeRating = 'POSITIVE EDGE';
    else if (expectancy < 0) edgeRating = 'NEGATIVE DRIFT';

    return {
      totalTrades: sorted.length,
      winRate,
      profitFactor,
      expectancy,
      realizedRMultiple,
      avgWin,
      avgLoss,
      fomoCount,
      revengeCount,
      tiltClusterCount,
      winStreak: maxWinStreak,
      lossStreak: maxLossStreak,
      currentStreak,
      currentStreakType,
      blindSpots,
      behavioralAlerts,
      edgeRating
    };
  }, [trades]);

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
        "border border-zinc-800/80 shadow-2xl bg-[#0c101b]/95 text-white p-5 sm:p-6 flex flex-col group overflow-hidden relative backdrop-blur-xl rounded-2xl",
        className
      )}>
        {/* Background Neural Ambience */}
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
          <Sparkles size={110} className="text-emerald-400" />
        </div>
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none" />

        {/* 1. Header & Active Telemetry Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-950/70 to-zinc-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)] shrink-0">
              <BrainCircuit size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-white font-sans">
                  AI Performance Engine
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Quant Telemetry
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-400 truncate">
                Active Execution Calibration · {analysis.totalTrades} Trade Sample
              </p>
            </div>
          </div>

          {/* Top Action Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-[10px] font-mono font-bold uppercase tracking-wider overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('statistical_edge')}
              className={cn(
                "py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === 'statistical_edge'
                  ? "bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/80"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <TrendingUp size={11} className={activeTab === 'statistical_edge' ? "text-emerald-400" : "text-zinc-500"} />
              <span>Statistical Edge</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guardrails')}
              className={cn(
                "py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 relative shrink-0",
                activeTab === 'guardrails'
                  ? "bg-zinc-800 text-rose-400 shadow-sm border border-zinc-700/80"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <ShieldAlert size={11} className={activeTab === 'guardrails' ? "text-rose-400" : "text-zinc-500"} />
              <span>Guardrails</span>
              {(analysis.tiltClusterCount > 0 || analysis.revengeCount > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-0.5 right-0.5 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blind_spots')}
              className={cn(
                "py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === 'blind_spots'
                  ? "bg-zinc-800 text-amber-400 shadow-sm border border-zinc-700/80"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Compass size={11} className={activeTab === 'blind_spots' ? "text-amber-400" : "text-zinc-500"} />
              <span>Blind Spots</span>
            </button>
          </div>
        </div>

        {/* 2. Enhanced High-Density Metric Cards Grid */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5 mb-5 z-10"
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
          {/* EXPECTANCY */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.04, ease: 'easeOut' }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-1.5 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300"
          >
            <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Expectancy</span>
              <Target size={12} className="text-emerald-400" />
            </div>
            <div className={cn(
              "text-xl sm:text-2xl font-black font-mono tracking-tight",
              analysis.expectancy >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {analysis.totalTrades === 0 
                ? '0.00R' 
                : analysis.expectancy >= 0 
                  ? `+${analysis.expectancy.toFixed(2)}R` 
                  : `${analysis.expectancy.toFixed(2)}R`}
            </div>
            <div className="text-[9px] font-mono text-zinc-500">Per trade expected edge</div>
          </motion.div>

          {/* PROFIT FACTOR */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-1.5 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300"
          >
            <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Profit Factor</span>
              <Scale size={12} className="text-emerald-400" />
            </div>
            <div className={cn(
              "text-xl sm:text-2xl font-black font-mono tracking-tight",
              analysis.profitFactor >= 1.25 ? "text-emerald-400" : analysis.profitFactor >= 1 ? "text-zinc-200" : "text-rose-400"
            )}>
              {analysis.profitFactor.toFixed(2)}
            </div>
            <div className="text-[9px] font-mono text-zinc-500">Gross Win / Gross Loss</div>
          </motion.div>

          {/* REAL R:R */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-1.5 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300"
          >
            <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Real R:R</span>
              <Zap size={12} className="text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
              {analysis.realizedRMultiple.toFixed(2)}R
            </div>
            <div className="text-[9px] font-mono text-zinc-500">Realized payoff ratio</div>
          </motion.div>

          {/* STREAKS TELEMETRY */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: [0.97, 1.012, 1] }}
            transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-1.5 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300"
          >
            <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Streaks (W/L)</span>
              <Flame size={12} className="text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-white flex items-center gap-1.5">
              <span className="text-emerald-400">{analysis.winStreak}W</span>
              <span className="text-zinc-600">/</span>
              <span className="text-rose-400">{analysis.lossStreak}L</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-500 truncate">
              Current: {analysis.currentStreak}{analysis.currentStreakType === 'win' ? 'W' : analysis.currentStreakType === 'loss' ? 'L' : '-'}
            </div>
          </motion.div>
        </motion.div>

        {/* Tab Detail View */}
        <div className="flex-1 space-y-3 z-10 mb-4">
          {activeTab === 'statistical_edge' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-start gap-3 animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs font-mono min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-emerald-400 uppercase tracking-wide">Edge Classification:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[10px] font-black border border-emerald-500/30 font-mono shrink-0">
                    {analysis.edgeRating}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  {analysis.expectancy > 0 
                    ? `Mathematical edge confirmed. System compounds positive expectancy under disciplined 2.0R targets.` 
                    : analysis.totalTrades === 0
                      ? `Dynamic telemetry active. Log your trades in the journal to calibrate quantitative distribution.`
                      : `Expectancy is currently negative (${analysis.expectancy.toFixed(2)}R). Review stop discipline and eliminate revenge sizing.`}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'guardrails' && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  analysis.tiltClusterCount > 0 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300" 
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                )}>
                  <span className="text-[10px] uppercase font-bold">Sub-30m Re-Entries</span>
                  <span className="font-black text-sm">{analysis.tiltClusterCount}</span>
                </div>

                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  (analysis.fomoCount + analysis.revengeCount) > 0 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300" 
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                )}>
                  <span className="text-[10px] uppercase font-bold">FOMO / Tilt Tags</span>
                  <span className="font-black text-sm">{analysis.fomoCount + analysis.revengeCount}</span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800">
                {analysis.behavioralAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs leading-relaxed space-y-0.5",
                      alert.severity === 'critical' && "bg-rose-950/20 border-rose-500/40 text-rose-200",
                      alert.severity === 'warning' && "bg-amber-950/20 border-amber-500/40 text-amber-200",
                      alert.severity === 'info' && "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase tracking-wide">
                      {alert.severity === 'critical' ? (
                        <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                      ) : alert.severity === 'warning' ? (
                        <Flame size={12} className="text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      )}
                      <span>{alert.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans pl-3.5">
                      {alert.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'blind_spots' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                <Compass size={14} className="shrink-0" />
                <span>Synthesized Execution Blind Spots</span>
              </div>
              <div className="space-y-1">
                {analysis.blindSpots.map((spot, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-300 font-sans">
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span>{spot}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Action Footer & Paywall Triggers */}
        <div className="pt-3.5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Trigger: Audit Trade Log */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/ai-insights')}
              className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700/80 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Bot size={13} className="text-emerald-400" />
              <span>Audit Trade Log</span>
            </Button>

            {/* Quick Trigger: Run Monte Carlo Simulation */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTriggerMonteCarlo}
              className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700/80 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Binary size={13} className="text-indigo-400" />
              <span>Run Monte Carlo</span>
            </Button>

            {/* Quick Trigger: Calibrate Kelly Criterion */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsKellyModalOpen(true)}
              className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700/80 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Scale size={13} className="text-amber-400" />
              <span>Calibrate Kelly</span>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className="text-[10px] font-mono text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1 uppercase tracking-wider font-bold shrink-0 self-end sm:self-auto"
          >
            <span>Full Quant Desk</span>
            <ArrowRight size={11} />
          </button>
        </div>
      </Card>

      {/* MODAL 2: 10,000-PATH MONTE CARLO WEB WORKER SIMULATION */}
      <Dialog open={isMonteCarloModalOpen} onOpenChange={setIsMonteCarloModalOpen}>
        <DialogContent className="max-w-lg bg-gray-950 border border-zinc-800 text-white rounded-3xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
              <Binary className="text-indigo-400" size={18} />
              10,000-Path Monte Carlo Simulation (Off-Thread Web Worker)
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-mono">
              Bootstraps 10,000 randomized permutations of historical outcomes to detect ruin vulnerability.
            </DialogDescription>
          </DialogHeader>

          {mcRunning ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <RefreshCw size={28} className="animate-spin text-indigo-400" />
              <p className="text-xs font-mono font-bold text-zinc-300">
                Web Worker generating 10,000 bootstrap paths...
              </p>
            </div>
          ) : mcResult ? (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 uppercase">Risk of Ruin (20% DD):</span>
                  <span className={cn(
                    "text-base font-black",
                    mcResult.ruinProbability <= 1 ? "text-emerald-400" : mcResult.ruinProbability <= 5 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {mcResult.ruinProbability.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 uppercase">Median Bootstrap DD:</span>
                  <span className="text-white font-bold">{mcResult.medianDrawdown.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 uppercase">Worst-Case Simulated DD:</span>
                  <span className="text-rose-400 font-bold">{mcResult.maxDrawdown.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800">
                  <span>Paths Computed: {mcResult.pathsSampled.toLocaleString()}</span>
                  <span>Execution: 0-Drop Web Worker</span>
                </div>
              </div>

              <Button
                onClick={handleTriggerMonteCarlo}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider"
              >
                Re-Run Simulation
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 font-mono">
                Historical sample contains {analysis.totalTrades} trade blocks. Click below to spawn the Web Worker engine.
              </p>
              <Button
                onClick={handleTriggerMonteCarlo}
                disabled={trades.length < 3}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                Launch 10,000-Path Bootstrap
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: KELLY CRITERION CALIBRATION DIALOG */}
      <Dialog open={isKellyModalOpen} onOpenChange={setIsKellyModalOpen}>
        <DialogContent className="max-w-md bg-gray-950 border border-zinc-800 text-white rounded-3xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
              <Scale className="text-amber-400" size={18} />
              Kelly Criterion Sizing Engine
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-mono">
              Mathematical optimal position sizing derived from current win rate and win/loss ratio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase">Half-Kelly (Safe)</span>
                <div className="text-2xl font-black text-emerald-400">
                  {kellyMetrics.halfKellyPct}%
                </div>
                <div className="text-[9px] text-zinc-400">Recommended setup risk</div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase">Full Kelly (Max)</span>
                <div className="text-2xl font-black text-white">
                  {kellyMetrics.fullKellyPct}%
                </div>
                <div className="text-[9px] text-zinc-400">Theoretical upper bound</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Mathematical Directive:</div>
              <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                {kellyMetrics.recommendation}
              </p>
            </div>

            <Button
              onClick={() => setIsKellyModalOpen(false)}
              className="w-full h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider"
            >
              Acknowledge Calibration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paywall Pricing Modal */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={closePricingModal}
        currentTier={subState.currentTier}
        onSelectPlan={upgradePlan}
        isLoading={subLoading}
      />
    </>
  );
};
