/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTrades } from '@/context/TradeContext';
import { getMarketTypeFromTicker } from '@/lib/utils';
import { Zap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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

  // Quick ticker presets
  const presets = ['MNQ', 'NQ', 'ES', 'MES', 'GC', 'BTC'];

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
        "rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 flex flex-col justify-between",
        "transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20 hover:shadow-2xl group",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-3 h-3" />
            </div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-white">
              Quick Execution Pad
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Instant Log</span>
        </div>

        {/* Quick Ticker Chips */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
          {presets.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setTicker(sym)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-all shrink-0",
                ticker.toUpperCase() === sym
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 ring-1 ring-white/5"
              )}
            >
              ${sym}
            </button>
          ))}
        </div>

        {/* Trade Form */}
        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3">
          {/* Ticker & Direction */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Ticker
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="MNQ"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Bias
              </label>
              <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setDirection('long')}
                  className={cn(
                    "py-1 text-[10px] font-mono font-bold rounded-lg transition-all",
                    direction === 'long'
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-zinc-400 hover:text-white"
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
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "text-zinc-400 hover:text-white"
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
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Entry
              </label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="20500"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Exit
              </label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="20540"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Size
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>
          </div>

          {/* Realtime PnL Preview */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
            <span className="text-[10px] text-zinc-400 uppercase">Estimated PnL:</span>
            {estimatedPnl !== null ? (
              <span
                className={cn(
                  "font-bold",
                  estimatedPnl >= 0
                    ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                    : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                )}
              >
                {estimatedPnl >= 0 ? `+$${estimatedPnl.toFixed(2)}` : `-$${Math.abs(estimatedPnl).toFixed(2)}`}
              </span>
            ) : (
              <span className="text-zinc-500 font-mono text-[11px]">—</span>
            )}
          </div>

          {/* Feedback Messages */}
          {successMsg && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
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
              "w-full py-2 px-3 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2",
              "bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] shadow-lg disabled:opacity-50"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Broadcasting to Ledger...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Execute Log</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="pt-2 text-[9px] font-mono text-zinc-400 text-center">
        Writes directly to Supabase ledger
      </div>
    </div>
  );
};
