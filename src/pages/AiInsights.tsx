/**
 * BentoTrade V6.0 AI Quant Lab & Session Debrief Terminal
 * Full-width multi-column bento grid containing:
 * - Module A: ZScorePlaybookOptimizer (Monte Carlo simulation)
 * - Module B: PropFirmCopilot (Topstep / Apex trailing drawdown simulator)
 * - Module C: AiSessionCoach (Executive Debrief & "Ask Your Ledger" terminal)
 */

import React from 'react';
import { Cpu, Bot, Gauge, Sliders, ShieldCheck, Activity } from 'lucide-react';
import { ZScorePlaybookOptimizer } from '@/components/ZScorePlaybookOptimizer';
import { PropFirmCopilot } from '@/components/PropFirmCopilot';
import { AiSessionCoach } from '@/components/AiSessionCoach';
import { useTrades } from '@/context/TradeContext';
import { formatCurrency } from '@/lib/utils';

export const AiInsights: React.FC = () => {
  const { trades } = useTrades();

  const totalTrades = trades?.length || 0;
  const wins = (trades || []).filter(t => t.pnl > 0 || t.status === 'win').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnL = (trades || []).reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <div className="animate-in fade-in duration-500 w-full max-w-[1600px] mx-auto pb-20 font-sans space-y-8">
      
      {/* Header & KPI Strip */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
            <span>Terminal</span> / <span>Intelligence</span> / <span className="text-emerald-400">V6 AI Quant Lab</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight flex items-center gap-3">
            AI Quant Lab & Risk Manager <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">REVISION_6.0</span>
          </h1>
        </div>

        {/* Top KPI Telemetry Strip */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <span className="text-zinc-500 uppercase font-bold">LEDGER:</span>
            <span className="font-extrabold text-white">{totalTrades} Executions</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <span className="text-zinc-500 uppercase font-bold">WIN RATE:</span>
            <span className="font-extrabold text-emerald-400">{winRate}%</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <span className="text-zinc-500 uppercase font-bold">NET P&L:</span>
            <span className={totalPnL >= 0 ? "font-extrabold text-emerald-400" : "font-extrabold text-rose-400"}>
              {formatCurrency(totalPnL, true)}
            </span>
          </div>
        </div>
      </header>

      {/* 3-Pillar V6 Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Column 1: Module A (Z-Score Optimizer) & Module B (Prop Firm Copilot) */}
        <div className="space-y-8">
          {/* Module A: ZScorePlaybookOptimizer */}
          <section className="space-y-3">
            <ZScorePlaybookOptimizer />
          </section>

          {/* Module B: PropFirmCopilot */}
          <section className="space-y-3">
            <PropFirmCopilot />
          </section>
        </div>

        {/* Column 2: Module C (AiSessionCoach) */}
        <div className="space-y-8">
          <section className="space-y-3">
            <AiSessionCoach />
          </section>
        </div>

      </div>

    </div>
  );
};
