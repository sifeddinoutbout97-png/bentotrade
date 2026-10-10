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
        "rounded-2xl bg-white/[0.015] backdrop-blur-2xl border border-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 sm:p-7 md:p-8 flex flex-col justify-between",
        "transition-all duration-300 hover:bg-white/[0.03] group",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            <h3 className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">
              Live Tape
            </h3>
            <span className="text-[10px] font-mono text-zinc-600 px-1.5 py-0.2 rounded bg-white/[0.02] border border-white/[0.03]">
              Closed
            </span>
          </div>

          <Link
            to="/journal-history"
            className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
          >
            <span>History</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Trade Feed */}
        <div className="divide-y divide-white/[0.03] mt-2">
          {recentTrades.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-xs font-mono text-zinc-600">No recent closed trades</p>
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
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isProfit ? "bg-emerald-400" : "bg-rose-400"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-medium text-zinc-200 tracking-wider">
                          ${t.ticker?.toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-mono font-medium uppercase px-1 py-0.2 rounded",
                            isShort
                              ? "bg-white/[0.02] text-zinc-500 border border-white/[0.03]"
                              : "bg-white/[0.02] text-zinc-400 border border-white/[0.03]"
                          )}
                        >
                          {isShort ? 'SHORT' : 'LONG'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600 flex items-center gap-1 tabular-nums">
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
                        "text-xs font-mono font-bold tracking-tight tabular-nums block",
                        isProfit ? "text-emerald-400" : "text-rose-500"
                      )}
                    >
                      {isProfit ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600 uppercase">
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
      <div className="pt-3 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-mono text-zinc-600">
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-zinc-600" />
          <span>Stream</span>
        </span>
        <span className="tabular-nums">{recentTrades.length} buffered</span>
      </div>
    </div>
  );
};
