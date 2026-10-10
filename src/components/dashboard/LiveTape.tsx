/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Trade } from '@/types';
import { Link } from 'react-router-dom';
import { Radio, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveTapeProps {
  trades: Trade[];
  className?: string;
}

export const LiveTape: React.FC<LiveTapeProps> = ({ trades, className }) => {
  // Sort trades descending by trade_date and grab latest 5
  const recentTrades = React.useMemo(() => {
    if (!trades) return [];
    return [...trades]
      .sort((a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime())
      .slice(0, 5);
  }, [trades]);

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
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            </span>
            <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-white">
              Live Tape
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.2 rounded bg-white/5">
              Closed
            </span>
          </div>

          <Link
            to="/journal-history"
            className="text-[10px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>History</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Trade Feed */}
        <div className="divide-y divide-white/5 mt-2">
          {recentTrades.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-xs font-mono text-zinc-400">No recent closed trades</p>
              <p className="text-[11px] font-mono text-zinc-500">Executions will populate here live</p>
            </div>
          ) : (
            recentTrades.map((t) => {
              const pnl = Number(t.pnl) || 0;
              const isProfit = t.status === 'win' || pnl > 0;
              const isShort = t.direction === 'short';

              return (
                <div
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3 group/item hover:bg-white/[0.02] px-1 rounded-lg transition-colors"
                >
                  {/* Left: Outcome dot + Ticker & Direction */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-transform group-hover/item:scale-125",
                        isProfit
                          ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                          : "bg-rose-400 shadow-[0_0_6px_#fb7185]"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-white tracking-wider">
                          ${t.ticker?.toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-mono font-black uppercase px-1 py-0.2 rounded",
                            isShort
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          )}
                        >
                          {isShort ? 'SHORT' : 'LONG'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                        <span>{t.trade_date ? new Date(t.trade_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}</span>
                        {t.entry_price && (
                          <>
                            <span>·</span>
                            <span>{t.entry_price}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Realized PnL */}
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        "text-xs font-mono font-bold tracking-tight block",
                        isProfit
                          ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                          : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                      )}
                    >
                      {isProfit ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">
                      {isProfit ? 'PROFIT' : 'LOSS'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Tape Telemetry */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>Realtime Stream</span>
        </span>
        <span>{recentTrades.length} buffered</span>
      </div>
    </div>
  );
};
