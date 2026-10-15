/**
 * BentoTrade v5.0 Quick Execution Pad
 * Direct ledger execution with Predictive Risk Guardrails & Enforced System Lockout
 */

import React, { useState, useEffect } from 'react';
import { useTrades } from '@/context/TradeContext';
import { getMarketTypeFromTicker } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, Calculator, ArrowRight, Lock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getContractSpec, calculatePnL, calculatePositionSize, checkLiveTiltState, TiltState } from '@/lib/quant-engine';
import { autoTagTrade } from '@/lib/ai-agents/auto-tagger';

interface QuickExecutionPadProps {
  className?: string;
  onTradeLogged?: () => void;
}

export const QuickExecutionPad: React.FC<QuickExecutionPadProps> = ({ className, onTradeLogged }) => {
  const { trades, createTrade } = useTrades();

  const [ticker, setTicker] = useState('MNQ');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  
  // Risk & Position Sizing Calculator state
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [riskPercent, setRiskPercent] = useState<string>('1.0');
  const [accountBalance] = useState<number>(50000); // Default baseline account size

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Predictive Risk Guardrail & System Lockout Audit
  const tiltState: TiltState = checkLiveTiltState(trades || [], accountBalance);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (tiltState.isLocked) {
      setRemainingSeconds(tiltState.remainingSeconds || 900);
    } else {
      setRemainingSeconds(0);
    }
  }, [tiltState.isLocked, tiltState.remainingSeconds]);

  // Live countdown timer ticker
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Contract specification & multiplier auto-lookup via Quant Engine
  const spec = getContractSpec(ticker);

  const entryNum = parseFloat(entryPrice) || 0;
  const exitNum = parseFloat(exitPrice) || 0;
  const qtyNum = parseFloat(quantity) || 1;
  const stopLossNum = parseFloat(stopLoss) || 0;
  const riskPctNum = parseFloat(riskPercent) || 1.0;

  // Live PnL calculation via Quant Engine
  let estimatedPnl: number | null = null;
  if (entryNum > 0 && exitNum > 0) {
    const pnlRes = calculatePnL({
      direction,
      entryPrice: entryNum,
      exitPrice: exitNum,
      size: qtyNum,
      ticker
    });
    estimatedPnl = pnlRes.pnl;
  }

  // Live Risk & Position Sizing via Quant Engine
  const positionSizing = (entryNum > 0 && stopLossNum > 0) ? calculatePositionSize({
    accountBalance,
    riskPercent: riskPctNum,
    entryPrice: entryNum,
    stopLossPrice: stopLossNum,
    ticker
  }) : null;

  // Handle Bias toggle with automatic entry/exit price swap
  const handleDirectionToggle = (newDirection: 'long' | 'short') => {
    if (newDirection === direction) return;
    setDirection(newDirection);

    if (entryPrice && exitPrice) {
      const currentEntry = entryPrice;
      const currentExit = exitPrice;
      setEntryPrice(currentExit);
      setExitPrice(currentEntry);
    }
  };

  const handleApplyRecommendedSize = () => {
    if (positionSizing && positionSizing.recommendedSize > 0) {
      setQuantity(String(positionSizing.recommendedSize));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingSeconds > 0 || tiltState.isLocked) {
      setErrorMsg('Execution blocked: System Lockout is active.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) {
      setErrorMsg('Ticker symbol is required');
      return;
    }

    if (!entryNum || entryNum <= 0) {
      setErrorMsg('Valid entry price is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate risk reward ratio
      let rrRatio = 0;
      if (entryNum > 0 && stopLossNum > 0 && exitNum > 0) {
        const riskPts = Math.abs(direction === 'long' ? entryNum - stopLossNum : stopLossNum - entryNum);
        const rewardPts = Math.abs(direction === 'long' ? exitNum - entryNum : entryNum - exitNum);
        if (riskPts > 0) rrRatio = rewardPts / riskPts;
      }

      // Generate Auto-Tags via Auto-Tagger Agent
      const autoTags = autoTagTrade({
        ticker: cleanTicker,
        direction,
        entry_price: entryNum,
        exit_price: exitNum,
        stop_loss: stopLossNum,
        position_size: qtyNum,
        risk_reward_ratio: rrRatio,
        trade_date: new Date().toISOString()
      });

      const tradeData = {
        ticker: cleanTicker,
        direction,
        entry_price: entryNum,
        exit_price: exitNum > 0 ? exitNum : undefined,
        stop_loss: stopLossNum > 0 ? stopLossNum : undefined,
        position_size: qtyNum,
        pnl: estimatedPnl !== null ? estimatedPnl : 0,
        status: (estimatedPnl !== null && estimatedPnl > 0) ? ('win' as const) : (estimatedPnl !== null && estimatedPnl < 0) ? ('loss' as const) : ('breakeven' as const),
        risk_reward_ratio: rrRatio > 0 ? rrRatio : 2.0,
        trade_date: new Date().toISOString(),
        notes: `Executed via Quick Execution Pad. Auto-tags: ${autoTags.join(', ')}`,
        tags: autoTags
      };

      await createTrade(tradeData);
      setSuccessMsg(`Execution logged successfully (${cleanTicker} ${direction.toUpperCase()})`);
      
      // Reset input fields
      setEntryPrice('');
      setExitPrice('');
      setStopLoss('');
      
      if (onTradeLogged) onTradeLogged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to broadcast trade to ledger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format countdown
  const countdownMins = Math.floor(remainingSeconds / 60);
  const countdownSecs = remainingSeconds % 60;
  const formattedCountdown = `${String(countdownMins).padStart(2, '0')}:${String(countdownSecs).padStart(2, '0')}`;

  const isLockoutActive = tiltState.isLocked || remainingSeconds > 0;

  return (
    <div className={cn("p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-2xl relative overflow-hidden", className)}>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn("w-4 h-4", isLockoutActive ? "text-rose-500" : "text-emerald-400")} />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
            Quick Execution Pad
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowRiskCalc(!showRiskCalc)}
          className={cn(
            "text-[10px] font-mono uppercase px-2 py-1 rounded-lg border transition-all flex items-center gap-1",
            showRiskCalc ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-black/40 text-zinc-400 border-white/[0.05] hover:text-zinc-200"
          )}
        >
          <Calculator size={11} />
          <span>Risk Calculator</span>
        </button>
      </div>

      <div className="pt-3">
        {/* ========================================================================= */}
        {/* PREDICTIVE RISK GUARDRAIL: SYSTEM LOCKOUT OVERLAY                        */}
        {/* ========================================================================= */}
        {isLockoutActive ? (
          <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500 text-rose-300 font-mono space-y-3 shadow-2xl animate-pulse text-center">
            <div className="flex items-center justify-center gap-2 text-rose-400">
              <Lock size={20} className="animate-bounce" />
              <span className="text-sm font-black uppercase tracking-widest">
                {tiltState.title || 'CRITICAL: TILT DETECTED'}
              </span>
            </div>

            <p className="text-xs text-rose-200/90 leading-relaxed font-sans">
              {tiltState.reason || 'Multiple consecutive losses or drawdown breach detected. Live executions blocked.'}
            </p>

            <div className="bg-black/60 border border-rose-500/40 rounded-xl p-3 space-y-1">
              <div className="text-[10px] uppercase text-rose-400 font-bold tracking-widest">
                MANDATORY COOLING-OFF PERIOD
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono tracking-wider tabular-nums">
                {formattedCountdown}
              </div>
              <div className="text-[9px] text-zinc-400">
                System unlocks at {tiltState.unlockTime || 'cooling-off expiration'}
              </div>
            </div>

            <div className="text-[10px] uppercase font-bold text-rose-400/80 bg-rose-500/20 py-2 rounded-lg border border-rose-500/30">
              🚫 EXECUTION PAD LOCKED BY QUANT RISK ENGINE
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Ticker & Bias */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  Ticker
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="MNQ"
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs font-mono font-medium text-zinc-200 uppercase focus:outline-none focus:border-emerald-500/50"
                />
                <span className="text-[9px] font-mono text-zinc-500 truncate block mt-0.5">
                  {spec.name}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  Bias
                </label>
                <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => handleDirectionToggle('long')}
                    className={cn(
                      "py-1 text-[10px] font-mono font-bold rounded-lg transition-all",
                      direction === 'long'
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionToggle('short')}
                    className={cn(
                      "py-1 text-[10px] font-mono font-bold rounded-lg transition-all",
                      direction === 'short'
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    SHORT
                  </button>
                </div>
              </div>
            </div>

            {/* Entry, Exit & Size */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  Entry
                </label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="20500"
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  Exit
                </label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  placeholder="20540"
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  Size
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Risk & Position Sizing Drawer */}
            {showRiskCalc && (
              <div className="bg-zinc-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2 text-xs font-mono animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Calculator size={11} />
                    Position Sizing Guard
                  </span>
                  <span>${accountBalance.toLocaleString()} Balance</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase block mb-0.5">Stop Loss Price</label>
                    <input
                      type="number"
                      step="any"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="20450"
                      className="w-full bg-black/60 border border-white/[0.05] rounded-lg px-2 py-1 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase block mb-0.5">Max Risk (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                      placeholder="1.0"
                      className="w-full bg-black/60 border border-white/[0.05] rounded-lg px-2 py-1 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {positionSizing && (
                  <div className="pt-2 border-t border-white/[0.05] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Cash Budget:</span>
                      <span className="font-bold text-zinc-200">${positionSizing.cashRiskAmount.toFixed(2)} ({riskPercent}%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Risk / Contract:</span>
                      <span className="font-bold text-zinc-200">${positionSizing.dollarRiskPerUnit.toFixed(2)} ({positionSizing.pointsAtRisk} pts)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Recommended Size:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-400">{positionSizing.recommendedSize} Contracts</span>
                        {positionSizing.recommendedSize > 0 && (
                          <button
                            type="button"
                            onClick={handleApplyRecommendedSize}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[9px] uppercase font-bold flex items-center gap-0.5"
                          >
                            <span>Apply</span>
                            <ArrowRight size={8} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Realtime PnL Preview */}
            <div className="bg-black/30 border border-white/[0.05] rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-zinc-500 uppercase">Estimated PnL ({spec.multiplier}x):</span>
              {estimatedPnl !== null ? (
                <span
                  className={cn(
                    "font-bold tabular-nums tracking-tight",
                    estimatedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {estimatedPnl >= 0 ? `+$${estimatedPnl.toFixed(2)}` : `-$${Math.abs(estimatedPnl).toFixed(2)}`}
                </span>
              ) : (
                <span className="text-zinc-600 font-mono text-[11px]">—</span>
              )}
            </div>

            {/* Feedback Messages */}
            {successMsg && (
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-mono bg-rose-500/10 border border-rose-500/30 px-2.5 py-1.5 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full py-2.5 px-3 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2",
                "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Broadcasting to Ledger...</span>
                </>
              ) : (
                <span>Log Execution</span>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="pt-3 border-t border-white/[0.05] text-[9px] font-mono text-zinc-500 text-center mt-3">
        Direct ledger execution &bull; Auto-tagger & Tilt Guardrail Active
      </div>
    </div>
  );
};
