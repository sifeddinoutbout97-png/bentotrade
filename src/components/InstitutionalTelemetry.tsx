import React, { useMemo, useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
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

  const sqnGradeColor = {
    'Holy Grail': 'text-emerald-400',
    'Excellent': 'text-emerald-400',
    'Good': 'text-zinc-200',
    'Poor': 'text-amber-400',
    'Un-tradeable': 'text-rose-500'
  };

  return (
    <>
      <div className={cn(
        "relative rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 overflow-hidden transition-all duration-300 hover:bg-white/[0.03]",
        className
      )}>
        {/* Workstation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/[0.03] pb-4">
          <div>
            <h3 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              Institutional Telemetry Desk
            </h3>
            <p className="text-xs font-mono text-zinc-500 mt-1">
              MFE/MAE Excursion • Fractional Kelly • 10,000-Path Monte Carlo
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                workerRunning ? "bg-amber-400 animate-spin" : "bg-emerald-400"
              )} />
              <span>{workerRunning ? 'Worker Simulating...' : '10k Bootstrap Worker'}</span>
            </div>
          </div>
        </div>

        {/* 2x2 Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 relative z-10 min-w-0">
          
          {/* Card 1: Trade Efficiency (MFE / MAE) */}
          <div className="min-w-0 overflow-hidden p-5 sm:p-6 rounded-xl bg-white/[0.015] border border-white/[0.03] flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                Trade Efficiency (MFE / MAE)
              </span>
              <span className="text-xs font-mono text-zinc-400 shrink-0">
                {quantStats.mfeMae.efficiencyScore}% Capture
              </span>
            </div>

            {/* Gauge Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 truncate mr-2">Unrealized Edge Given Back:</span>
                <span className="font-bold text-zinc-300 tabular-nums shrink-0">
                  {(100 - quantStats.mfeMae.efficiencyScore).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    quantStats.mfeMae.efficiencyScore >= 60 ? "bg-emerald-400" : "bg-amber-400"
                  )}
                  style={{ width: `${quantStats.mfeMae.efficiencyScore}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-xs">
              <div className="min-w-0">
                <span className="text-zinc-600 uppercase block text-[10px] tracking-wider truncate">Avg Favorable (MFE)</span>
                <div className="text-base font-bold text-emerald-400 truncate">
                  +${quantStats.mfeMae.avgMFE.toFixed(0)}
                </div>
              </div>

              <div className="min-w-0">
                <span className="text-zinc-600 uppercase block text-[10px] tracking-wider truncate">Avg Adverse (MAE)</span>
                <div className="text-base font-bold text-rose-500 truncate">
                  -${quantStats.mfeMae.avgMAE.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Optimal Sizing (Half-Kelly Criterion) */}
          <div className="min-w-0 overflow-hidden p-5 sm:p-6 rounded-xl bg-white/[0.015] border border-white/[0.03] flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                Fractional Kelly Optimal Sizing
              </span>
              <span className="text-xs font-mono text-zinc-500 shrink-0">
                Half-Kelly
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
              <div className={cn(
                "text-2xl sm:text-3xl font-bold font-mono tracking-tight",
                quantStats.kelly.halfKellyPct > 0 ? "text-emerald-400" : "text-rose-500"
              )}>
                {quantStats.kelly.halfKellyPct}%
              </div>
              <span className="text-xs font-mono text-zinc-500 truncate">
                Recommended Risk (Full: {quantStats.kelly.fullKellyPct}%)
              </span>
            </div>

            <div className="text-xs font-mono text-zinc-400 pt-1">
              <span className="text-zinc-600 uppercase block text-[10px] tracking-wider mb-0.5 truncate">Sizing Directive</span>
              <span className="break-words">{quantStats.kelly.recommendation}</span>
            </div>
          </div>

          {/* Card 3: System Quality Number (SQN) */}
          <div className="min-w-0 overflow-hidden p-5 sm:p-6 rounded-xl bg-white/[0.015] border border-white/[0.03] flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                System Quality Number (SQN)
              </span>
              <span className={cn("text-xs font-mono font-medium shrink-0", sqnGradeColor[quantStats.sqn.grade])}>
                {quantStats.sqn.grade}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
              <div className={cn(
                "text-2xl sm:text-3xl font-bold font-mono tracking-tight",
                quantStats.sqn.sqn >= 2.0 ? "text-emerald-400" : quantStats.sqn.sqn >= 1.0 ? "text-zinc-200" : "text-rose-500"
              )}>
                {quantStats.sqn.sqn.toFixed(2)}
              </div>
              <span className="text-xs font-mono text-zinc-500 truncate">
                Van Tharp Benchmark
              </span>
            </div>

            {/* SQN Rating Scale */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px] text-center pt-1">
              <div className={cn("p-1.5 rounded border border-white/[0.04]", quantStats.sqn.sqn < 1.6 ? "text-rose-400 bg-rose-500/10" : "text-zinc-600")}>
                &lt; 1.6
              </div>
              <div className={cn("p-1.5 rounded border border-white/[0.04]", quantStats.sqn.sqn >= 1.6 && quantStats.sqn.sqn < 2.5 ? "text-zinc-200 bg-white/[0.05]" : "text-zinc-600")}>
                1.6-2.5
              </div>
              <div className={cn("p-1.5 rounded border border-white/[0.04]", quantStats.sqn.sqn >= 2.5 && quantStats.sqn.sqn <= 3.0 ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-600")}>
                2.5-3.0
              </div>
              <div className={cn("p-1.5 rounded border border-white/[0.04]", quantStats.sqn.sqn > 3.0 ? "text-emerald-300 bg-emerald-500/20" : "text-zinc-600")}>
                &gt; 3.0
              </div>
            </div>
          </div>

          {/* Card 4: Monte Carlo Risk of Ruin */}
          <div className="min-w-0 overflow-hidden p-5 sm:p-6 rounded-xl bg-white/[0.015] border border-white/[0.03] flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono truncate">
                Monte Carlo Risk of Ruin
              </span>
              <span className="text-xs font-mono text-zinc-500 shrink-0">
                -20% DD Barrier
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
              <div className={cn(
                "text-2xl sm:text-3xl font-bold font-mono tracking-tight",
                activeRuinProb <= 1.0 
                  ? "text-emerald-400" 
                  : activeRuinProb <= 5.0 
                    ? "text-amber-400" 
                    : "text-rose-500"
              )}>
                {activeRuinProb.toFixed(1)}%
              </div>
              <span className="text-xs font-mono text-zinc-500 truncate">
                Probability {workerResult && `(Median DD: ${workerResult.medianDrawdown}%)`}
              </span>
            </div>

            {/* Risk of Ruin Gauge */}
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    activeRuinProb <= 1.0 
                      ? "bg-emerald-400" 
                      : activeRuinProb <= 5.0 
                        ? "bg-amber-400" 
                        : "bg-rose-500"
                  )}
                  style={{ width: `${Math.min(100, Math.max(2, activeRuinProb))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
                <span>0% Safe</span>
                <span>Threshold: &lt; 2.0%</span>
                <span>100% Critical</span>
              </div>
            </div>
          </div>

        </div>

        {/* PAYWALL OVERLAY FOR NON-PREMIUM USERS */}
        {!isPremium && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-2xl text-center transition-all animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 mb-4">
              <Lock size={20} />
            </div>

            <div className="max-w-md space-y-2 mb-6">
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-xs font-mono uppercase tracking-widest inline-block">
                Ultra Quant
              </span>
              <h4 className="text-lg font-bold font-mono text-zinc-100 tracking-tight">
                Unlock Institutional Telemetry
              </h4>
              <p className="text-xs text-zinc-500 font-mono leading-relaxed">
                MFE/MAE capture curves, Fractional Half-Kelly position sizing, Van Tharp SQN metrics, and 10,000-path Monte Carlo risk-of-ruin diagnostics.
              </p>
            </div>

            <Button
              onClick={openPricingModal}
              size="lg"
              className="bg-transparent border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-white/[0.03] rounded-xl text-xs font-mono font-medium tracking-wider px-6 py-3 transition-all"
            >
              Upgrade to Ultra
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

