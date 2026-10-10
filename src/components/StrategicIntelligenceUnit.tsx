import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCcw,
  Compass
} from 'lucide-react';
import { CalendarEvent, MarketPulseSummary } from '@/types';
import { generateMarketIntelligence } from '@/services/geminiService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StrategicIntelligenceUnitProps {
  events: CalendarEvent[];
  currencyFilter?: string[];
  className?: string;
}

export const StrategicIntelligenceUnit: React.FC<StrategicIntelligenceUnitProps> = ({
  events,
  currencyFilter = [],
  className
}) => {
  const [summary, setSummary] = useState<MarketPulseSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchIntelligence = async () => {
    setLoading(true);
    try {
      const data = await generateMarketIntelligence(events);
      setSummary(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to generate market intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [events.length, currencyFilter.join(',')]);

  const riskBadgeStyles = {
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ELEVATED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const sentimentStyles = {
    BULLISH: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    BEARISH: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    VOLATILE: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    NEUTRAL: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
  };

  return (
    <Card className={cn(
      "rounded-[2.5rem] border-primary/20 bg-primary/5 dark:bg-primary/5 shadow-2xl shadow-primary/5 overflow-hidden relative group",
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Header bar */}
      <CardHeader className="border-b border-primary/10 p-6 md:p-8 pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] md:text-xs font-black flex items-center gap-3 uppercase tracking-[0.3em] text-primary">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.6)]" />
          Strategic_Intelligence_Unit <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-primary/20">v5.0</span>
        </CardTitle>

        <div className="flex items-center gap-3">
          {summary && (
            <Badge 
              variant="outline" 
              className={cn(
                "px-3 py-1 rounded-full font-black text-[10px] tracking-widest uppercase border",
                riskBadgeStyles[summary.riskLevel]
              )}
            >
              Risk_Level: {summary.riskLevel}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchIntelligence}
            disabled={loading}
            className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 text-primary transition-all"
            title="Refresh Intelligence Uplink"
          >
            <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 md:p-8 space-y-8">
        {loading && !summary ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-6 w-3/4 bg-primary/10 rounded-lg" />
            <div className="h-4 w-full bg-primary/5 rounded" />
            <div className="h-4 w-5/6 bg-primary/5 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-2xl bg-primary/5 border border-primary/10 p-4" />
              ))}
            </div>
          </div>
        ) : summary ? (
          <div className="space-y-8">
            {/* Top Insight Headline & Briefing */}
            <div className="space-y-3">
              <h3 className="text-xl md:text-2xl font-black text-zinc-950 dark:text-white tracking-tight leading-snug">
                {summary.headline}
              </h3>
              <p className="text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed font-mono">
                {summary.briefing}
              </p>
            </div>

            {/* Volatility Corridors Grid */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <Compass size={14} className="text-primary" />
                <span>Live Volatility Corridors</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summary.volatilityCorridors.map((corridor, idx) => (
                  <div 
                    key={idx} 
                    className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm backdrop-blur-md space-y-3 group/item hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-zinc-950 dark:text-white tracking-tight">
                        {corridor.asset}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        sentimentStyles[corridor.sentiment]
                      )}>
                        {corridor.sentiment}
                      </span>
                    </div>

                    <div className="text-xs font-mono font-bold text-primary">
                      Range: {corridor.expectedMove}
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      {corridor.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actionable Windows & Key Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Tactical Windows */}
              <div className="p-5 rounded-2xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <Clock size={14} className="text-indigo-400" />
                  <span>Actionable Execution Windows</span>
                </div>

                <div className="space-y-2.5">
                  {summary.actionableWindows.map((win, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-zinc-100/50 dark:bg-white/5 flex flex-col gap-1 border border-zinc-950/5 dark:border-white/5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black font-mono text-zinc-950 dark:text-white">{win.timeframe}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-primary">{win.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        {win.guidance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guardrails / Risks */}
              <div className="p-5 rounded-2xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span>Quantitative Risk Guardrails</span>
                </div>

                <ul className="space-y-2.5">
                  {summary.keyRisks.map((risk, idx) => (
                    <li key={idx} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer sync info */}
            <div className="flex items-center justify-between pt-2 border-t border-primary/10 text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Activity size={12} className="text-emerald-500" />
                <span>Neural Telemetry Uplink Active</span>
              </span>
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-zinc-500 font-medium text-sm">
            Awaiting calendar stream telemetry...
          </div>
        )}
      </CardContent>
    </Card>
  );
};
