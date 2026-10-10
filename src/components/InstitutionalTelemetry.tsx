import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  AlertTriangle, 
  Scale, 
  Target, 
  Cpu, 
  BarChart3, 
  Layers, 
  Flame, 
  ChevronRight,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { TradeData } from '@/types';
import { 
  calculateMFE_MAE, 
  calculateKellyCriterion, 
  calculateSQN, 
  runMonteCarloRiskOfRuin 
} from '@/utils/institutionalQuant';
import { useSubscription } from '@/hooks/useSubscription';
import { PricingModal } from '@/components/PricingModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MonteCarloWorkerResult } from '@/workers/monteCarloWorker';

export interface InstitutionalTelemetryProps {
  trades: TradeData[];
  isPremium: boolean;
  className?: string;
}

export const InstitutionalTelemetry: React.FC<InstitutionalTelemetryProps> = ({
  trades,
  isPremium,
  className
}) => {
  const { 
    subState, 
    isPricingModalOpen, 
    openPricingModal, 
    closePricingModal, 
    upgradePlan, 
    loading: subLoading 
  } = useSubscription();

  const [workerResult, setWorkerResult] = useState<MonteCarloWorkerResult | null>(null);
  const [workerRunning, setWorkerRunning] = useState(false);

  // Compute deterministic quant metrics
  const quantStats = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        mfeMae: { avgMFE: 0, avgMAE: 0, efficiencyScore: 0 },
        kelly: { fullKellyPct: 0, halfKellyPct: 0, recommendation: 'Awaiting execution records.' },
        sqn: { sqn: 0, grade: 'Poor' as const },
        ruinProbability: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0
      };
    }

    const winningTrades = trades.filter(t => t.status === 'win' || Number(t.pnl) > 0);
    const losingTrades = trades.filter(t => t.status === 'loss' || Number(t.pnl) < 0);

    const winRate = (winningTrades.length / trades.length) * 100;
    const grossProfit = winningTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0));

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    // 1. MFE / MAE
    const mfeMae = calculateMFE_MAE(trades);

    // 2. Kelly Criterion
    const kelly = calculateKellyCriterion(winRate, avgWin, avgLoss);

    // 3. R-multiples & SQN
    const rMultiples = trades.map(t => {
      const pnl = Number(t.pnl) || 0;
      if (t.risk_reward_ratio && t.risk_reward_ratio > 0) {
        return pnl >= 0 ? t.risk_reward_ratio : -1;
      }
      const baselineRisk = avgLoss > 0 ? avgLoss : 100;
      return pnl / baselineRisk;
    });
    const sqn = calculateSQN(rMultiples);

    // 4. Default synchronous fallback Monte Carlo
    const defaultRuin = runMonteCarloRiskOfRuin(trades, 10000, 0.2);

    return {
      mfeMae,
      kelly,
      sqn,
      ruinProbability: defaultRuin,
      winRate,
      avgWin,
      avgLoss
    };
  }, [trades.length]);

  // Execute heavy 10,000-path Monte Carlo in a non-blocking Web Worker
  useEffect(() => {
    if (!trades || trades.length < 3) return;

    const pnls = trades.map(t => Number(t.pnl) || 0).filter(p => !isNaN(p));
    setWorkerRunning(true);

    try {
      const worker = new Worker(
        new URL('../workers/monteCarloWorker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<MonteCarloWorkerResult>) => {
        setWorkerResult(event.data);
        setWorkerRunning(false);
        worker.terminate();
      };

      worker.onerror = () => {
        setWorkerRunning(false);
        worker.terminate();
      };

      worker.postMessage({
        pnls,
        iterations: 10000,
        riskThreshold: 0.2
      });

      return () => {
        worker.terminate();
      };
    } catch (e) {
      // Fallback already calculated via quantStats
      setWorkerRunning(false);
    }
  }, [trades.length]);

  const activeRuinProb = workerResult ? workerResult.ruinProbability : quantStats.ruinProbability;

  const sqnGradeBadge = {
    'Holy Grail': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Excellent': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    'Good': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    'Poor': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Un-tradeable': 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  return (
    <>
      <div className={cn(
        "relative rounded-[2.5rem] bg-gray-950 border border-zinc-800/80 p-6 md:p-8 overflow-hidden shadow-2xl transition-all",
        className
      )}>
        {/* Glowing Neural Ambient Accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

        {/* Workstation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-950/70 to-zinc-900 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
              <Cpu size={22} className="animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-black text-white uppercase tracking-tight font-sans">
                  Institutional Telemetry Desk
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  Ultra Quant v5.5
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                MFE/MAE Excursion Curves • Fractional Kelly • 10,000-Path Monte Carlo Web Worker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span className={cn(
                "w-2 h-2 rounded-full",
                workerRunning ? "bg-amber-400 animate-spin" : "bg-emerald-500 animate-ping"
              )} />
              <span>{workerRunning ? 'Worker Simulating...' : '10,000 Bootstrap Paths (Worker)'}</span>
            </div>
            
            {!isPremium && (
              <Button
                onClick={openPricingModal}
                size="sm"
                className="h-8 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-black text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:opacity-90"
              >
                <Sparkles size={13} className="mr-1" />
                Unlock Ultra
              </Button>
            )}
          </div>
        </div>

        {/* 2x2 Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
          
          {/* Card 1: Trade Efficiency (MFE / MAE) */}
          <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Target size={14} className="text-emerald-400" />
                Trade Efficiency & Excursion (MFE / MAE)
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border",
                quantStats.mfeMae.efficiencyScore >= 60 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}>
                {quantStats.mfeMae.efficiencyScore}% Capture
              </span>
            </div>

            {/* Gauge Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Peak MFE Left On Table:</span>
                <span className="font-bold text-white">
                  {(100 - quantStats.mfeMae.efficiencyScore).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    quantStats.mfeMae.efficiencyScore >= 60 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  )}
                  style={{ width: `${quantStats.mfeMae.efficiencyScore}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80 font-mono text-xs">
              <div className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/60 space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase">Avg Favorable (MFE)</span>
                <div className="text-base font-black text-emerald-400">
                  +${quantStats.mfeMae.avgMFE.toFixed(0)}
                </div>
              </div>

              <div className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/60 space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase">Avg Adverse (MAE)</span>
                <div className="text-base font-black text-rose-400">
                  -${quantStats.mfeMae.avgMAE.toFixed(0)}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Measures how close exits were to optimal peaks. High efficiency confirms disciplined target taking without premature stops.
            </p>
          </div>

          {/* Card 2: Optimal Sizing (Half-Kelly Criterion) */}
          <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Scale size={14} className="text-emerald-400" />
                Fractional Kelly Optimal Sizing
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                Half-Kelly Standard
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className={cn(
                "text-3xl font-black font-mono tracking-tight",
                quantStats.kelly.halfKellyPct > 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {quantStats.kelly.halfKellyPct}%
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Recommended Risk / Setup (Full: {quantStats.kelly.fullKellyPct}%)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
              <div className="text-[10px] font-mono uppercase text-zinc-500">Institutional Sizing Rule</div>
              <p className="text-xs font-mono text-zinc-200">
                {quantStats.kelly.recommendation}
              </p>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Half-Kelly applies a 50% safety discount to prevent bankruptcy during non-Gaussian volatility clusters and liquidity gaps.
            </p>
          </div>

          {/* Card 3: System Quality Number (SQN) */}
          <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" />
                Edge Robustness (SQN Score)
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border",
                sqnGradeBadge[quantStats.sqn.grade]
              )}>
                {quantStats.sqn.grade}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className={cn(
                "text-3xl font-black font-mono tracking-tight",
                quantStats.sqn.sqn >= 2.0 ? "text-emerald-400" : quantStats.sqn.sqn >= 1.0 ? "text-zinc-200" : "text-rose-400"
              )}>
                {quantStats.sqn.sqn.toFixed(2)}
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Van Tharp System Quality Benchmark
              </span>
            </div>

            {/* SQN Rating Scale */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-[9px] text-center">
              <div className={cn("p-1.5 rounded-lg border", quantStats.sqn.sqn < 1.6 ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold" : "bg-zinc-900 text-zinc-600 border-zinc-800")}>
                &lt; 1.6 Poor
              </div>
              <div className={cn("p-1.5 rounded-lg border", quantStats.sqn.sqn >= 1.6 && quantStats.sqn.sqn < 2.5 ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold" : "bg-zinc-900 text-zinc-600 border-zinc-800")}>
                1.6-2.5 Good
              </div>
              <div className={cn("p-1.5 rounded-lg border", quantStats.sqn.sqn >= 2.5 && quantStats.sqn.sqn <= 3.0 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "bg-zinc-900 text-zinc-600 border-zinc-800")}>
                2.5-3.0 Exc.
              </div>
              <div className={cn("p-1.5 rounded-lg border", quantStats.sqn.sqn > 3.0 ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/50 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-zinc-900 text-zinc-600 border-zinc-800")}>
                &gt; 3.0 Grail
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Evaluates trade count vs standard deviation of R-multiples. SQN &gt; 2.5 indicates high ease of capital compounding.
            </p>
          </div>

          {/* Card 4: Monte Carlo Risk of Ruin */}
          <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Flame size={14} className="text-rose-400" />
                Monte Carlo Risk of Ruin
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                -20% DD Barrier
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className={cn(
                "text-3xl font-black font-mono tracking-tight",
                activeRuinProb <= 1.0 
                  ? "text-emerald-400" 
                  : activeRuinProb <= 5.0 
                    ? "text-amber-400" 
                    : "text-rose-400"
              )}>
                {activeRuinProb.toFixed(1)}%
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Probability of severe 20% drawdown {workerResult && `(Median DD: ${workerResult.medianDrawdown}%)`}
              </span>
            </div>

            {/* Risk of Ruin Gauge */}
            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    activeRuinProb <= 1.0 
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                      : activeRuinProb <= 5.0 
                        ? "bg-amber-500" 
                        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                  )}
                  style={{ width: `${Math.min(100, Math.max(2, activeRuinProb))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>0% Safe</span>
                <span>Institutional Threshold: &lt; 2.0%</span>
                <span>100% Critical</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Bootstraps 10,000 distinct randomized sequence permutations off-thread via dedicated Web Workers without frame drops.
            </p>
          </div>

        </div>

        {/* PAYWALL OVERLAY FOR NON-PREMIUM USERS */}
        {!isPremium && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-gray-950/75 backdrop-blur-md text-center transition-all animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.25)] mb-4">
              <Lock size={28} className="animate-pulse" />
            </div>

            <div className="max-w-md space-y-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest inline-block">
                Ultra Institutional License
              </span>
              <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Unlock Institutional Telemetry
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                Access deep MFE/MAE capture curves, Fractional Half-Kelly position sizing, Van Tharp SQN metrics, and 10,000-path Monte Carlo risk-of-ruin diagnostics.
              </p>
            </div>

            <Button
              onClick={openPricingModal}
              size="lg"
              className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-black text-xs uppercase tracking-wider px-6 py-5 shadow-xl shadow-emerald-500/20 hover:opacity-95 transition-all"
            >
              <Sparkles size={16} className="mr-2" />
              Upgrade to Ultra to Unlock Institutional Telemetry
            </Button>
          </div>
        )}
      </div>

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
