/**
 * BentoTrade V6.0 AI Session Coach
 * Executive Session Debrief & Interactive "Ask Your Ledger" terminal with 1-click diagnostic chips.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  User, 
  Cpu, 
  TrendingUp, 
  ShieldAlert, 
  RotateCcw,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrades } from '@/context/TradeContext';
import { askTradingCoach, generateSessionDebrief } from '@/lib/tradingCoachService';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AiSessionCoach: React.FC = () => {
  const { trades } = useTrades();

  const [debrief, setDebrief] = useState(() => generateSessionDebrief(trades || []));
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDebrief(generateSessionDebrief(trades || []));
  }, [trades]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const diagnosticChips = [
    'Audit My Losing Streak',
    'Optimal Fractional Kelly Size',
    'Session Time-of-Day Leaks',
    'Win rate on MNQ breakouts?'
  ];

  const handleSendQuery = async (queryText?: string) => {
    const q = queryText || inputQuery;
    if (!q.trim() || isProcessing) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const responseText = await askTradingCoach(q, trades || []);
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: `Quant Coach Exception: ${e?.message || 'Failed to query trade journal ledger.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 shadow-2xl space-y-6 font-mono relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Executive Session Coach <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">V6.0 TERMINAL</span>
            </h2>
            <p className="text-xs text-zinc-400">Deterministic post-mortem debrief & interactive ledger AI auditor</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Playbook Score:</span>
          <span className={cn(
            "font-black text-sm px-2.5 py-0.5 rounded border",
            debrief.playbookAdherence >= 80 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-amber-500/20 text-amber-400 border-amber-500/40"
          )}>
            {debrief.playbookAdherence}%
          </span>
        </div>
      </div>

      {/* Top Executive Briefing Readout */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 leading-relaxed shadow-inner">
        <span className="text-emerald-400 font-bold block mb-1">SYSTEM BRIEFING READOUT:</span>
        <p>{debrief.summaryText}</p>
      </div>

      {/* Chat History Window */}
      <div className="h-[280px] overflow-y-auto space-y-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
            <HelpCircle size={24} className="text-emerald-400 opacity-60" />
            <span className="text-xs font-bold text-zinc-300">Ask Your Trade Journal Ledger</span>
            <p className="text-[11px] text-zinc-500 max-w-sm">Select a diagnostic chip below or type custom queries to audit win rates, fractional Kelly sizing, and time-of-day leaks.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn("flex flex-col space-y-1", msg.sender === 'user' ? "items-end" : "items-start")}>
              <div className="text-[10px] text-zinc-500 uppercase px-1">
                {msg.sender === 'user' ? `TRADER (${msg.timestamp})` : `QUANT COACH AI (${msg.timestamp})`}
              </div>
              <div className={cn(
                "p-3 rounded-xl text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed",
                msg.sender === 'user' ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-zinc-900 border border-zinc-800 text-zinc-200 border-l-2 border-l-emerald-500"
              )}>
                {msg.text}
              </div>
            </div>
          ))
        )}

        {isProcessing && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>ANALYZING JOURNAL EXECUTIONS...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* One-Click Diagnostic Chips */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          ONE-CLICK QUANT DIAGNOSTIC CHIPS
        </span>
        <div className="flex flex-wrap gap-2">
          {diagnosticChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendQuery(`[${chip}]`)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-emerald-400 border border-emerald-500/30 text-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 shadow-md"
            >
              <Sparkles size={12} className="text-emerald-400" />
              <span>[{chip}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Bar */}
      <div className="relative flex items-center pt-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendQuery(); }}
          placeholder="Query your journal (e.g., 'Audit my losing streak' or 'Show Friday afternoon PnL')..."
          className="w-full h-11 pl-4 pr-12 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-all font-mono"
        />
        <Button
          size="icon"
          onClick={() => handleSendQuery()}
          disabled={!inputQuery.trim() || isProcessing}
          className="absolute right-1 h-9 w-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all disabled:opacity-40"
        >
          <Send size={14} />
        </Button>
      </div>

    </div>
  );
};
