import React, { useRef, useEffect, useState, useMemo } from 'react';
import { CandlestickData } from '@/types';
import { cn } from '@/lib/utils';
import { Maximize2, RefreshCw } from 'lucide-react';

interface TradeExecutionChartProps {
  candles?: CandlestickData[];
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  ticker?: string;
  direction?: 'long' | 'short';
  pnl?: number;
  height?: number;
  className?: string;
}

/**
 * Generates synthetic contextual candlestick data around execution levels
 * when raw tick/minute bar data is not stored in the database.
 */
function generateContextualCandles(
  entryPrice: number,
  exitPrice?: number,
  stopLoss?: number,
  direction: 'long' | 'short' = 'long'
): CandlestickData[] {
  const count = 32;
  const targetExit = exitPrice ?? (direction === 'long' ? entryPrice * 1.015 : entryPrice * 0.985);
  const targetStop = stopLoss ?? (direction === 'long' ? entryPrice * 0.99 : entryPrice * 1.01);
  
  const span = Math.max(0.5, Math.abs(targetExit - entryPrice), Math.abs(entryPrice - targetStop));
  const volatility = span * 0.25;

  const result: CandlestickData[] = [];
  const baseTime = Date.now() - count * 60 * 1000 * 5; // 5-minute bars

  // Start slightly before entry
  let cur = entryPrice + (direction === 'long' ? -volatility * 1.2 : volatility * 1.2);

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    let target = entryPrice;

    if (i < 8) {
      // Approach phase
      target = entryPrice - (direction === 'long' ? volatility * (1 - i / 8) : -volatility * (1 - i / 8));
    } else if (i === 8) {
      // Exact Entry touchpoint
      target = entryPrice;
    } else if (i < 24) {
      // Mid-trade progression towards exit or testing stop
      const midProgress = (i - 8) / 16;
      target = entryPrice + (targetExit - entryPrice) * midProgress;
    } else {
      // Climax around exit
      target = targetExit;
    }

    const noise = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * volatility * 0.4;
    const open = cur;
    const close = target + noise;
    const high = Math.max(open, close) + Math.abs(noise * 0.8) + volatility * 0.15;
    const low = Math.min(open, close) - Math.abs(noise * 0.8) - volatility * 0.15;

    cur = close;

    const timeObj = new Date(baseTime + i * 5 * 60 * 1000);
    const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    result.push({
      timestamp: timeObj.getTime(),
      time: timeStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(120 + Math.random() * 850)
    });
  }

  return result;
}

export const TradeExecutionChart: React.FC<TradeExecutionChartProps> = ({
  candles: providedCandles,
  entryPrice,
  exitPrice,
  stopLoss,
  ticker = 'NQ',
  direction = 'long',
  pnl,
  height = 360,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Generate or use provided candles
  const candles = useMemo(() => {
    if (providedCandles && providedCandles.length > 5) {
      return providedCandles;
    }
    return generateContextualCandles(entryPrice, exitPrice, stopLoss, direction);
  }, [providedCandles, entryPrice, exitPrice, stopLoss, direction]);

  // Track responsive container resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: observedHeight } = entry.contentRect;
        if (width > 0) {
          setDimensions({ width, height: observedHeight || height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height]);

  // Draw chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width <= 0 || dimensions.height <= 0 || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const w = dimensions.width;
    const h = dimensions.height;

    // Padding margins
    const padTop = 30;
    const padBottom = 40;
    const padLeft = 20;
    const padRight = 75; // for price axis

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Clear background
    ctx.fillStyle = '#0b0f19'; // Deep slate dark panel
    ctx.fillRect(0, 0, w, h);

    // Compute min and max price across candles & execution reference lines
    let minPrice = Math.min(...candles.map(c => c.low));
    let maxPrice = Math.max(...candles.map(c => c.high));

    if (entryPrice) {
      minPrice = Math.min(minPrice, entryPrice);
      maxPrice = Math.max(maxPrice, entryPrice);
    }
    if (exitPrice) {
      minPrice = Math.min(minPrice, exitPrice);
      maxPrice = Math.max(maxPrice, exitPrice);
    }
    if (stopLoss) {
      minPrice = Math.min(minPrice, stopLoss);
      maxPrice = Math.max(maxPrice, stopLoss);
    }

    const priceRange = Math.max(0.1, maxPrice - minPrice);
    const paddedMin = minPrice - priceRange * 0.08;
    const paddedMax = maxPrice + priceRange * 0.08;
    const totalPaddedRange = paddedMax - paddedMin;

    const getY = (val: number) => {
      return padTop + plotH - ((val - paddedMin) / totalPaddedRange) * plotH;
    };

    // Horizontal Price Grid Lines
    const gridSteps = 5;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#64748b';

    for (let i = 0; i <= gridSteps; i++) {
      const p = paddedMin + (totalPaddedRange / gridSteps) * i;
      const y = getY(p);

      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      // Price labels
      ctx.setLineDash([]);
      ctx.fillText(p.toFixed(2), w - padRight + 8, y + 3);
    }

    // Candle layout
    const numCandles = candles.length;
    const candleSlotW = plotW / numCandles;
    const candleBodyW = Math.max(2, candleSlotW * 0.7);

    // Render Candlesticks
    candles.forEach((c, i) => {
      const cx = padLeft + i * candleSlotW + candleSlotW / 2;
      const isUp = c.close >= c.open;
      const candleColor = isUp ? '#10b981' : '#f43f5e';

      const highY = getY(c.high);
      const lowY = getY(c.low);
      const openY = getY(c.open);
      const closeY = getY(c.close);

      // Wick
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(cx, highY);
      ctx.lineTo(cx, lowY);
      ctx.stroke();

      // Body
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(1.5, Math.abs(closeY - openY));

      ctx.fillStyle = candleColor;
      ctx.fillRect(cx - candleBodyW / 2, topY, candleBodyW, bodyH);

      // Time axis ticks
      if (i % 6 === 0 || i === numCandles - 1) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.time, cx, h - padBottom + 18);
      }
    });

    // Helper for reference lines with labels
    const drawReferenceLine = (price: number, label: string, color: string, badgeBg: string) => {
      const y = getY(price);
      if (y < padTop - 5 || y > h - padBottom + 5) return;

      // Dashed line
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label pill on price axis
      const pillText = `${label} $${price.toFixed(2)}`;
      ctx.font = 'bold 9px monospace';
      const textW = ctx.measureText(pillText).width;
      const pillW = textW + 12;
      const pillH = 18;
      const pillX = w - padRight + 2;
      const pillY = y - pillH / 2;

      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(pillText, pillX + 6, y + 3.5);
    };

    // Draw Reference Lines: Stop Loss, Entry, Exit
    if (stopLoss) {
      drawReferenceLine(stopLoss, 'SL', '#f43f5e', '#881337');
    }
    if (entryPrice) {
      drawReferenceLine(entryPrice, 'ENTRY', '#f59e0b', '#78350f');
    }
    if (exitPrice) {
      const isExitProfit = direction === 'long' ? exitPrice > entryPrice : exitPrice < entryPrice;
      const exitCol = isExitProfit ? '#10b981' : '#f43f5e';
      const exitBg = isExitProfit ? '#064e3b' : '#881337';
      drawReferenceLine(exitPrice, 'EXIT', exitCol, exitBg);
    }

    // Crosshair & Tooltip Overlay
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < candles.length && mousePos) {
      const candle = candles[hoverIndex];
      const cx = padLeft + hoverIndex * candleSlotW + candleSlotW / 2;
      const cy = getY(candle.close);

      // Vertical crosshair
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, padTop);
      ctx.lineTo(cx, h - padBottom);
      ctx.stroke();

      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(padLeft, cy);
      ctx.lineTo(w - padRight, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Marker circle on candle close
      ctx.fillStyle = candle.close >= candle.open ? '#10b981' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [dimensions, candles, entryPrice, exitPrice, stopLoss, hoverIndex, mousePos, direction]);

  // Handle Mouse Hover Interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 20;
    const padRight = 75;
    const plotW = dimensions.width - padLeft - padRight;

    if (x >= padLeft && x <= padLeft + plotW) {
      const candleSlotW = plotW / candles.length;
      const index = Math.floor((x - padLeft) / candleSlotW);
      if (index >= 0 && index < candles.length) {
        setHoverIndex(index);
        setMousePos({ x, y });
        return;
      }
    }
    setHoverIndex(null);
    setMousePos(null);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  const hoveredCandle = hoverIndex !== null ? candles[hoverIndex] : null;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative rounded-3xl bg-[#0b0f19] border border-slate-800 shadow-xl overflow-hidden flex flex-col select-none",
        className
      )}
      style={{ height: `${height}px` }}
    >
      {/* Top Telemetry Header Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <span className="font-black text-sm text-white tracking-tight">{ticker}</span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
            direction === 'long' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          )}>
            {direction.toUpperCase()}
          </span>

          {hoveredCandle ? (
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-400">O: <strong className="text-white">${hoveredCandle.open}</strong></span>
              <span className="text-slate-400">H: <strong className="text-emerald-400">${hoveredCandle.high}</strong></span>
              <span className="text-slate-400">L: <strong className="text-rose-400">${hoveredCandle.low}</strong></span>
              <span className="text-slate-400">C: <strong className={hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"}>${hoveredCandle.close}</strong></span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-slate-400">
              <span>Interactive Execution Map</span>
              <span>•</span>
              <span>Entry: ${entryPrice.toFixed(2)}</span>
              {stopLoss && <span>• SL: ${stopLoss.toFixed(2)}</span>}
              {exitPrice && <span>• Exit: ${exitPrice.toFixed(2)}</span>}
            </div>
          )}
        </div>

        {pnl !== undefined && (
          <div className={cn(
            "text-xs font-mono font-black px-2.5 py-1 rounded-xl border",
            pnl >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          )}>
            PnL: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative w-full h-full">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block cursor-crosshair"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height - 49}px` }}
        />

        {/* Hover Tooltip Overlay */}
        {hoveredCandle && mousePos && (
          <div 
            className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md text-[10px] font-mono text-slate-200 space-y-1"
            style={{
              left: Math.min(dimensions.width - 150, Math.max(10, mousePos.x - 70)),
              top: Math.max(10, Math.min(dimensions.height - 110, mousePos.y - 75))
            }}
          >
            <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 flex justify-between">
              <span>{hoveredCandle.time}</span>
              <span>{ticker}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-[9px]">
              <span>Open: ${hoveredCandle.open}</span>
              <span>High: ${hoveredCandle.high}</span>
              <span>Low: ${hoveredCandle.low}</span>
              <span className={hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"}>
                Close: ${hoveredCandle.close}
              </span>
            </div>
            {entryPrice && (
              <div className="text-[8px] text-amber-400/90 pt-0.5">
                Δ from Entry: {((hoveredCandle.close - entryPrice) >= 0 ? '+' : '')}${(hoveredCandle.close - entryPrice).toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
