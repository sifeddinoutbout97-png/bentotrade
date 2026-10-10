import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  TrendingUp, 
  RefreshCw, 
  X, 
  AlertTriangle,
  Zap,
  Target,
  Scale,
  Brain
} from 'lucide-react';
import { TradeData, TradeAnalysis } from '@/types';
import { analyzeTradeRisk } from '@/services/geminiService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIDiagnosticModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  trade: TradeData | null;
  asModal?: boolean;
}

export const AIDiagnosticModal: React.FC<AIDiagnosticModalProps> = ({
  isOpen = true,
  onClose,
  trade,
  asModal = false
}) => {
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzedTradeId, setAnalyzedTradeId] = useState<string | null>(null);

  const fetchAnalysis = async (targetTrade: TradeData, force = false) => {
    if (!force && analyzedTradeId === targetTrade.id && analysis) {
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeTradeRisk(targetTrade);
      setAnalysis(result);
      setAnalyzedTradeId(targetTrade.id);
    } catch (err) {
      console.error('Diagnostic error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trade) {
      fetchAnalysis(trade);
    }
  }, [trade?.id]);

  if (!trade && asModal && !isOpen) return null;

  const content = (
    <div className="p-6 md:p-8 rounded-[2.5rem] bg-zinc-950 border border-white/10 text-white space-y-8 relative overflow-hidden shadow-2xl backdrop-blur-2xl">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Bot size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black tracking-tighter text-white uppercase">
                AI Diagnostic <span className="text-primary font-mono text-sm">v5.0</span>
              </h3>
            </div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>Cognitive Behavioral & Risk Audit</span>
              <span className="text-zinc-600">•</span>
              <span className="text-primary font-bold">{trade?.ticker || 'ASSET'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className="px-3.5 py-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-black text-[10px] tracking-widest uppercase flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-Time Synchronized
          </Badge>

          {trade && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalysis(trade, true)}
              disabled={loading}
              className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-bold tracking-tight h-8 px-3"
            >
              <RefreshCw size={12} className={cn("mr-1.5", loading && "animate-spin text-primary")} />
              Re-Audit
            </Button>
          )}

          {asModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {loading ? (
        <div className="space-y-6 py-4 animate-pulse relative z-10">
          <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-900/60 border border-white/5">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-6 w-48 bg-white/15 rounded" />
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/10" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full bg-white/10 rounded" />
            <div className="h-4 w-5/6 bg-white/10 rounded" />
            <div className="h-4 w-4/6 bg-white/5 rounded" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-zinc-900/40 border border-white/5 p-4 space-y-2">
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-5 w-24 bg-white/15 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : analysis ? (
        <div className="space-y-8 relative z-10">
          {/* Executive Rating & Efficiency Score Banner */}
          <div className="p-6 rounded-[2rem] bg-gradient-to-r from-zinc-900/90 to-zinc-900/40 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-inner">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/40 flex items-center justify-center text-2xl font-black text-primary tracking-tighter shadow-lg shadow-primary/20">
                  {analysis.executionRating}
                </div>
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-zinc-950 border border-white/10 text-[9px] font-mono font-bold text-zinc-300">
                  {analysis.ratingScore}%
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black tracking-tight text-white">Execution Grade</h4>
                <p className="text-xs text-zinc-400 font-medium">
                  {analysis.ratingScore >= 85 
                    ? 'Super-alpha execution aligned with risk management mandates.'
                    : analysis.ratingScore >= 70
                      ? 'Solid execution with minor parameter slippage.'
                      : 'High behavioral friction detected during execution.'}
                </p>
              </div>
            </div>

            {/* Efficiency Gauge */}
            <div className="w-full md:w-56 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Efficiency Index</span>
                <span className="text-primary font-bold">{analysis.efficiencyScore}/100</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, analysis.efficiencyScore))}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full"
                />
              </div>
            </div>
          </div>

          {/* Qualitative Synthesis */}
          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest">
              <Brain size={14} />
              <span>Behavioral & Quant Post-Mortem</span>
            </div>
            <p className="text-zinc-300 leading-relaxed font-medium text-sm md:text-[15px]">
              {analysis.summary}
            </p>
          </div>

          {/* Risk Metrics Breakdown Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <Scale size={14} className="text-indigo-400" />
                <span>Risk:Reward</span>
              </div>
              <div className="text-xl font-black font-mono text-white tracking-tight">
                1:{analysis.riskBreakdown.riskRewardRatio}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <Zap size={14} className="text-amber-400" />
                <span>Slippage Risk</span>
              </div>
              <div className="text-sm font-bold text-zinc-200">
                {analysis.riskBreakdown.slippageRisk}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <Target size={14} className="text-emerald-400" />
                <span>Sizing Audit</span>
              </div>
              <div className="text-sm font-bold text-zinc-200">
                {analysis.riskBreakdown.positionSizingAssessment}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <CheckCircle2 size={14} className="text-primary" />
                <span>Rule Adherence</span>
              </div>
              <div className="text-sm font-bold text-zinc-200">
                {analysis.riskBreakdown.ruleAdherence}
              </div>
            </div>
          </div>

          {/* Behavioral Flags & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flags */}
            <div className="space-y-3 p-5 rounded-2xl bg-zinc-900/40 border border-white/5">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-widest">
                <ShieldAlert size={14} />
                <span>Identified Cognitive Flags</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-400 font-medium">
                {analysis.behavioralFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span className="text-zinc-300">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actionable Recommendations */}
            <div className="space-y-3 p-5 rounded-2xl bg-zinc-900/40 border border-white/5">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <Sparkles size={14} />
                <span>Prescriptive Next Steps</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-400 font-medium">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                    <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-zinc-500 font-medium text-sm">
          No execution telemetry available to audit.
        </div>
      )}
    </div>
  );

  if (asModal) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto">
        <div className="w-full max-w-4xl my-8">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
