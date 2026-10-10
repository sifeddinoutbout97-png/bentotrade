/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTrades } from '@/context/TradeContext';
import { getMarketTypeFromTicker } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard multipliers for futures & CFDs
const MULTIPLIERS: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  ES: 50,
  MES: 5,
  GC: 100,
  CL: 1000,
  RTY: 50,
  M2K: 5,
  YM: 5,
  MYM: 0.5,
  XAUUSD: 100,
  EURUSD: 100000,
  BTC: 1,
  ETH: 1,
};

interface QuickExecutionPadProps {
  className?: string;
  onTradeLogged?: () => void;
}

export const QuickExecutionPad: React.FC<QuickExecutionPadProps> = ({ className, onTradeLogged }) => {
  const { createTrade } = useTrades();

  const [ticker, setTicker] = useState('MNQ');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate live preview PnL
  const entryNum = parseFloat(entryPrice) || 0;
  const exitNum = parseFloat(exitPrice) || 0;
  const qtyNum = parseFloat(quantity) || 1;
  const multiplier = MULTIPLIERS[ticker.toUpperCase()] || 1;

  let estimatedPnl: number | null = null;
  if (entryNum > 0 && exitNum > 0) {
    const diff = direction === 'long' ? exitNum - entryNum : entryNum - exitNum;
    estimatedPnl = diff * multiplier * qtyNum;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) {
      setErrorMsg('Ticker symbol is required');
      return;
    }

    if (!entryNum || entryNum <= 0) {
      setErrorMsg('Valid entry price required');
      return;
    }

    if (!exitNum || exitNum <= 0) {
      setErrorMsg('Valid exit price required');
      return;
    }

    setIsSubmitting(true);

    const diff = direction === 'long' ? exitNum - entryNum : entryNum - exitNum;
    const finalPnl = Number((diff * multiplier * qtyNum).toFixed(2));
    const status: 'win' | 'loss' | 'breakeven' = finalPnl > 0 ? 'win' : finalPnl < 0 ? 'loss' : 'breakeven';

    const tradePayload = {
      ticker: cleanTicker,
      market_type: getMarketTypeFromTicker(cleanTicker),
      entry_price: entryNum,
      exit_price: exitNum,
      position_size: qtyNum,
      direction,
      status,
      pnl: finalPnl,
      trade_date: new Date().toISOString(),
      notes: `Quick executed via v5 Pro Terminal pad (${cleanTicker} ${direction.toUpperCase()})`,
    };

    try {
      await createTrade(tradePayload);
      setSuccessMsg(`✓ $${cleanTicker} logged: ${finalPnl >= 0 ? `+$${finalPnl}` : `-$${Math.abs(finalPnl)}`}`);
      setEntryPrice('');
      setExitPrice('');
      if (onTradeLogged) onTradeLogged();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Quick execution log failed:', err);
      setErrorMsg(err.message || 'Execution logging failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.015] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 flex flex-col justify-between",
        "transition-all duration-300 hover:bg-white/[0.03] group",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
          <h3 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
            Quick Execution Pad
          </h3>
          <span className="text-[10px] font-mono text-zinc-600">Manual Log</span>
        </div>

        {/* Trade Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Single Ticker Input & Bias */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">
                Ticker
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="MNQ"
                className="w-full bg-black/40 border border-white/[0.03] rounded-xl px-2.5 py-1.5 text-xs font-mono font-medium text-zinc-200 uppercase focus:outline-none focus:border-white/10"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">
                Bias
              </label>
              <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setDirection('long')}
                  className={cn(
                    "py-1 text-[10px] font-mono font-bold rounded-lg transition-all",
                    direction === 'long'
                      ? "bg-white/[0.08] text-zinc-100 border border-white/[0.1]"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('short')}
                  className={cn(
                    "py-1 text-[10px] font-mono font-bold rounded-lg transition-all",
                    direction === 'short'
                      ? "bg-white/[0.08] text-zinc-100 border border-white/[0.1]"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Entry, Exit & Quantity */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">
                Entry
              </label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="20500"
                className="w-full bg-black/40 border border-white/[0.03] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-white/10"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">
                Exit
              </label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="20540"
                className="w-full bg-black/40 border border-white/[0.03] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-white/10"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">
                Size
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="w-full bg-black/40 border border-white/[0.03] rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-200 tabular-nums focus:outline-none focus:border-white/10"
              />
            </div>
          </div>

          {/* Realtime PnL Preview */}
          <div className="bg-black/30 border border-white/[0.03] rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
            <span className="text-[10px] text-zinc-600 uppercase">Estimated PnL:</span>
            {estimatedPnl !== null ? (
              <span
                className={cn(
                  "font-bold tabular-nums tracking-tight",
                  estimatedPnl >= 0 ? "text-emerald-400" : "text-rose-500"
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
            <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-mono bg-white/[0.02] border border-white/[0.05] px-2.5 py-1.5 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-mono bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-2 px-3 rounded-xl font-mono text-xs font-medium tracking-wider uppercase transition-all flex items-center justify-center gap-2",
              "bg-transparent border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 active:scale-[0.99] disabled:opacity-50"
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
      </div>

      <div className="pt-3 border-t border-white/[0.03] text-[9px] font-mono text-zinc-600 text-center mt-3">
        Direct ledger execution
      </div>
    </div>
  );
};
