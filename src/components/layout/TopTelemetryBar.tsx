/**
 * BentoTrade v6.0 Persistent Top Telemetry HUD Ribbon
 * Displays live market session clocks, prop firm daily buffer telemetry, guardrail status, ⌘K trigger, and + Quick Log.
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Command, 
  Plus 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTrades } from '@/context/TradeContext';
import { checkLiveTiltState } from '@/lib/quant-engine/guardrails';

export interface TopTelemetryBarProps {
  onOpenCommandPalette?: () => void;
  onOpenQuickLog?: () => void;
}

/**
 * Isolated Live Session Clocks leaf component (Requirement 3)
 * Isolates 10-second setInterval to avoid re-rendering the layout shell
 */
const LiveSessionClocks = React.memo(() => {
  const [utcTime, setUtcTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setUtcTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const utcHour = utcTime.getUTCHours();
  const utcMinute = utcTime.getUTCMinutes();
  const utcTimeVal = utcHour + utcMinute / 60;

  const isNYOpen = utcTimeVal >= 13.5 && utcTimeVal <= 20; // 13:30 - 20:00 UTC
  const isLDNOpen = utcTimeVal >= 8 && utcTimeVal <= 16.5;   // 08:00 - 16:30 UTC
  const isTYOOpen = utcTimeVal >= 0 && utcTimeVal <= 6;     // 00:00 - 06:00 UTC

  return (
    <div className="flex items-center gap-3 text-zinc-400">
      <div className="hidden lg:flex items-center gap-1.5 text-[10px] uppercase text-zinc-500 font-bold tracking-wider mr-1">
        <Clock size={13} className="text-emerald-400 animate-pulse" />
        <span>SESSIONS:</span>
      </div>

      {/* NY Clock */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800/80">
        <span className={cn(
          "w-2 h-2 rounded-full",
          isNYOpen ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-500/50"
        )} />
        <span className="font-bold text-zinc-200 text-[11px]">NY</span>
        <span className={cn("text-[10px] font-semibold", isNYOpen ? "text-emerald-400" : "text-zinc-500")}>
          [{isNYOpen ? 'OPEN' : 'CLOSED'}]
        </span>
      </div>

      {/* LDN Clock */}
      <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800/80">
        <span className={cn(
          "w-2 h-2 rounded-full",
          isLDNOpen ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-500/50"
        )} />
        <span className="font-bold text-zinc-200 text-[11px]">LDN</span>
        <span className={cn("text-[10px] font-semibold", isLDNOpen ? "text-emerald-400" : "text-zinc-500")}>
          [{isLDNOpen ? 'OPEN' : 'CLOSED'}]
        </span>
      </div>

      {/* TYO Clock */}
      <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800/80">
        <span className={cn(
          "w-2 h-2 rounded-full",
          isTYOOpen ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-500/50"
        )} />
        <span className="font-bold text-zinc-200 text-[11px]">TYO</span>
        <span className={cn("text-[10px] font-semibold", isTYOOpen ? "text-emerald-400" : "text-zinc-500")}>
          [{isTYOOpen ? 'OPEN' : 'CLOSED'}]
        </span>
      </div>
    </div>
  );
});

LiveSessionClocks.displayName = 'LiveSessionClocks';

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  onOpenCommandPalette,
  onOpenQuickLog,
}) => {
  const navigate = useNavigate();
  const { trades } = useTrades();

  const [propSettings, setPropSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bt_v6_risk_settings');
      return saved ? JSON.parse(saved) : { maxLoss: 2000, preset: '$50,000 Topstep EOD' };
    } catch {
      return { maxLoss: 2000, preset: '$50,000 Topstep EOD' };
    }
  });

  // Listen for risk settings changes
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('bt_v6_risk_settings');
        if (saved) setPropSettings(JSON.parse(saved));
      } catch (e) {
        console.warn('Error reading risk settings', e);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bt_risk_settings_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bt_risk_settings_updated', handleStorage);
    };
  }, []);

  // Live Tilt State
  const tiltState = checkLiveTiltState(trades || []);

  // Calculate today's loss / buffer
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = (trades || []).filter((t) => t.trade_date === todayStr);
  const todayNetPnL = todayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const maxLossLimit = propSettings.maxLoss || 2000;
  
  // Buffer remaining
  const currentLoss = todayNetPnL < 0 ? Math.abs(todayNetPnL) : 0;
  const bufferRemaining = Math.max(0, maxLossLimit - currentLoss);
  const bufferPct = Math.min(100, Math.max(0, Math.round((bufferRemaining / maxLossLimit) * 100)));

  return (
    <div className="h-12 shrink-0 border-b border-zinc-800/80 bg-zinc-950 px-4 sm:px-6 flex items-center justify-between z-30 select-none font-mono text-xs">
      
      {/* LEFT: Live Session Clocks (Isolated Leaf Component) */}
      <LiveSessionClocks />

      {/* CENTER: Compact Daily Buffer Gauge & Guardrail Badge */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Daily Buffer Progress */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">DAILY BUFFER:</span>
          <span className={cn(
            "font-extrabold text-xs tracking-tight",
            bufferPct > 40 ? "text-emerald-400" : bufferPct > 20 ? "text-amber-400" : "text-rose-400"
          )}>
            ${bufferRemaining.toLocaleString()} / ${maxLossLimit.toLocaleString()}
          </span>
          <span className={cn(
            "text-[10px] font-black px-1.5 py-0.2 rounded border",
            bufferPct > 40 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
            bufferPct > 20 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
            "bg-rose-500/10 text-rose-400 border-rose-500/30"
          )}>
            [{bufferPct}%]
          </span>
        </div>

        {/* Tilt Status Badge */}
        {tiltState.isLocked ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/40 text-rose-400 text-[10px] font-bold uppercase animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.3)]">
            <ShieldAlert size={13} className="text-rose-400" />
            <span>TILT LOCKOUT ACTIVE</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>ZERO-TILT: ARMED</span>
          </div>
        )}
      </div>

      {/* RIGHT: Command Menu Trigger & Quick Log Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors text-xs shadow-sm"
          title="Open Command Palette (⌘K)"
        >
          <Command size={13} className="text-emerald-400" />
          <span className="hidden md:inline text-[11px] font-medium">Press ⌘K to execute...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-950 text-[10px] font-bold text-zinc-400 border border-zinc-800">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onOpenQuickLog || (() => navigate('/journal'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20"
          title="Log a new trade"
        >
          <Plus size={14} className="stroke-[3]" />
          <span>Quick Log</span>
        </button>
      </div>

    </div>
  );
};
