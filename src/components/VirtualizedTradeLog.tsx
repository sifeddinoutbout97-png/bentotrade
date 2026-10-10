import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TradeData } from '../types';
import { cn } from '../lib/utils';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Calendar, 
  Clock, 
  Layers, 
  TrendingUp, 
  TrendingDown 
} from 'lucide-react';

interface VirtualizedTradeLogProps {
  trades: TradeData[];
  onSelectTrade?: (trade: TradeData) => void;
  selectedTradeId?: string | null;
  height?: number | string;
  className?: string;
}

export const VirtualizedTradeLog: React.FC<VirtualizedTradeLogProps> = ({
  trades,
  onSelectTrade,
  selectedTradeId,
  height = 600,
  className
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up high performance virtualizer
  const rowVirtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 12
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  if (!trades || trades.length === 0) {
    return (
      <div 
        className={cn(
          "w-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center",
          className
        )}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400 mb-3">
          <Layers size={22} />
        </div>
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">No Executions Found</h4>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          Virtual execution buffer is empty. Log a trade to view high-frequency telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* Telemetry Header */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-zinc-100/80 dark:bg-white/5 border border-zinc-200/60 dark:border-white/5 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Virtualizer Pipeline: Active ({trades.length.toLocaleString()} Total Records)</span>
        </div>
        <span>Render Window: 60 FPS Target</span>
      </div>

      {/* Fixed-Height Virtual Scroll Container */}
      <div
        ref={parentRef}
        className="w-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl overflow-auto select-none shadow-sm"
        style={{ 
          height: typeof height === 'number' ? `${height}px` : height,
          contain: 'strict'
        }}
      >
        <div
          className="w-full relative"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const trade = trades[virtualRow.index];
            const isSelected = selectedTradeId === trade.id;
            const isWin = trade.status === 'win' || trade.pnl > 0;
            const isLoss = trade.status === 'loss' || trade.pnl < 0;
            const isLong = trade.direction === 'long';

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                onClick={() => onSelectTrade?.(trade)}
                className={cn(
                  "absolute top-0 left-0 w-full px-5 py-3.5 flex items-center justify-between cursor-pointer border-b border-zinc-100 dark:border-white/5 transition-colors duration-150 group",
                  isSelected 
                    ? "bg-primary/10 border-primary/30" 
                    : "hover:bg-zinc-100/50 dark:hover:bg-white/[0.04]"
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {/* Left: Ticker & Direction Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-xs font-black transition-transform group-hover:scale-105",
                      isLong
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                    )}
                  >
                    {isLong ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-zinc-950 dark:text-white tracking-tight">
                        {trade.ticker}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider font-mono",
                          isLong
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {trade.direction}
                      </span>
                      {trade.market_type && (
                        <span className="text-[9px] uppercase font-bold text-zinc-400 font-mono hidden sm:inline">
                          {trade.market_type}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                      <span>Fill: ${Number(trade.entry_price).toFixed(2)}</span>
                      {trade.exit_price && (
                        <>
                          <span>→</span>
                          <span>${Number(trade.exit_price).toFixed(2)}</span>
                        </>
                      )}
                      <span className="hidden md:inline">• {new Date(trade.trade_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Realized PnL & Status */}
                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      "text-sm sm:text-base font-black font-mono tracking-tight",
                      isWin
                        ? "text-emerald-500 dark:text-emerald-400"
                        : isLoss
                        ? "text-rose-500 dark:text-rose-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {trade.pnl > 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 text-[10px] font-mono text-zinc-400 mt-0.5">
                    {trade.risk_reward_ratio ? (
                      <span className="text-primary font-bold">
                        1:{Number(trade.risk_reward_ratio).toFixed(1)} R:R
                      </span>
                    ) : (
                      <span>Size: {trade.position_size}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
