/**
 * BentoTrade V6.0 Prop Firm Copilot
 * Real-time trailing drawdown simulator supporting Topstep (End-Of-Day Trailing) and Apex (Intraday Unrealized Trailing) algorithms.
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  Gauge, 
  Sliders, 
  Activity, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useTrades } from '@/context/TradeContext';

export const PropFirmCopilot: React.FC = () => {
  const { trades } = useTrades();

  const [firmPreset, setFirmPreset] = useState<'topstep' | 'apex'>('topstep');
  const [accountSize, setAccountSize] = useState<number>(50000);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(2000);

  // Load from localStorage if user configured in /settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bt_v6_risk_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.preset?.includes('Apex')) setFirmPreset('apex');
        else setFirmPreset('topstep');
        if (parsed.maxLoss) setMaxDrawdown(parsed.maxLoss);
      }
    } catch (e) {
      console.warn('Error reading risk settings in PropFirmCopilot:', e);
    }
  }, []);

  // Calculate balances and drawdown threshold
  const startingBalance = accountSize;
  const netPnLTotal = (trades || []).reduce((acc, t) => acc + (t.pnl || 0), 0);
  const currentBalance = startingBalance + netPnLTotal;

  // Track Peak Balance
  // Topstep (EOD): Trails based on closed balance at EOD. Locks at starting balance.
  // Apex (Intraday): Trails peak unrealized balance. Stops trailing at Starting Balance + $100.
  const peakBalance = Math.max(startingBalance, currentBalance);

  let liquidationThreshold = startingBalance - maxDrawdown;
  if (firmPreset === 'topstep') {
    // EOD trailing locked at starting balance
    const trailed = peakBalance - maxDrawdown;
    liquidationThreshold = Math.min(startingBalance, trailed);
  } else {
    // Apex intraday trailing stops at startingBalance + 100
    const trailed = peakBalance - maxDrawdown;
    liquidationThreshold = Math.min(startingBalance + 100, trailed);
  }

  const currentBuffer = currentBalance - liquidationThreshold;
  const bufferRatio = Math.min(100, Math.max(0, Math.round((currentBuffer / maxDrawdown) * 100)));

  // Calculate average losing trade size
  const losingTrades = (trades || []).filter(t => t.pnl < 0);
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) 
    : 250;

  const tradesUntilLiquidation = currentBuffer > 0 ? Math.floor(currentBuffer / Math.max(50, avgLoss)) : 0;

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 shadow-2xl space-y-6 font-mono relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
            <Gauge size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Prop Firm Copilot <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 uppercase">V6.0 ENGINE</span>
            </h2>
            <p className="text-xs text-zinc-400">Real-time trailing drawdown & liquidation buffer simulator</p>
          </div>
        </div>

        {/* Firm Model Switcher */}
        <div className="p-1 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-1 text-xs">
          <button
            onClick={() => setFirmPreset('topstep')}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all",
              firmPreset === 'topstep' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Topstep (EOD)
          </button>
          <button
            onClick={() => setFirmPreset('apex')}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition-all",
              firmPreset === 'apex' ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Apex (Intraday)
          </button>
        </div>
      </div>

      {/* Liquidation Buffer Gauge */}
      <div className="p-5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">LIQUIDATION BUFFER GAUGE</span>
          <span className={cn(
            "text-xs font-black px-2.5 py-0.5 rounded border uppercase",
            currentBuffer > 1000 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
            currentBuffer > 400 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
            "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse"
          )}>
            {currentBuffer > 1000 ? 'SAFE ZONE' : currentBuffer > 400 ? 'WARNING ZONE' : 'CRITICAL ZONE'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800">
          <div 
            style={{ width: `${bufferRatio}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-500",
              bufferRatio > 50 ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" :
              bufferRatio > 20 ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" :
              "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
            )}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
          <span>AVAILABLE BUFFER: <strong className="text-white">${currentBuffer.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
          <span>MAX THRESHOLD: <strong className="text-zinc-300">${maxDrawdown.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Font-mono Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">PEAK BALANCE</span>
          <span className="font-extrabold text-sm text-white">${peakBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">CURRENT BALANCE</span>
          <span className={cn("font-extrabold text-sm", currentBalance >= startingBalance ? "text-emerald-400" : "text-rose-400")}>
            ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">LIQUIDATION THRESHOLD</span>
          <span className="font-extrabold text-sm text-rose-400">${liquidationThreshold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">TRADES TO LIQUIDATION</span>
          <span className="font-extrabold text-sm text-amber-400">~{tradesUntilLiquidation} Executions</span>
        </div>
      </div>

    </div>
  );
};
