/**
 * BentoTrade V6.0 Global Command Palette
 * Interactive keyboard-first modal with natural-language trade command parser and quick navigation.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { 
  PlusCircle, 
  XCircle, 
  TrendingUp, 
  Cpu, 
  Sun, 
  Moon, 
  Search, 
  BarChart3, 
  ShieldCheck, 
  BookOpen, 
  Activity, 
  Command as CommandIcon,
  Zap,
  ArrowRight,
  Flame,
  Calendar,
  Sparkles,
  UploadCloud
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { getContractSpec } from '@/lib/quant-engine/multipliers';
import { useTrades } from '@/context/TradeContext';

interface ParsedTradeCommand {
  direction: 'long' | 'short';
  size: number;
  ticker: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  dollarRisk: number;
  dollarReward: number;
  rrRatio: number;
  multiplier: number;
}

function parseTradeCommandString(query: string): ParsedTradeCommand | null {
  if (!query) return null;
  const q = query.trim();

  // Pattern: (Long|Short) (\d+) (\w+) @? (\d+(?:\.\d+)?) (?:SL|sl)? (\d+(?:\.\d+)?) (?:TP|tp)? (\d+(?:\.\d+)?)
  const regex = /^(long|short)\s+(\d+)\s+([a-zA-Z0-9\/]+)(?:\s+@?\s*(\d+(?:\.\d+)?))?(?:\s+(?:SL|sl)\s+(\d+(?:\.\d+)?))?(?:\s+(?:TP|tp)\s+(\d+(?:\.\d+)?))?/i;
  const match = q.match(regex);

  if (!match) return null;

  const direction = match[1].toLowerCase() === 'short' ? 'short' : 'long';
  const size = parseInt(match[2], 10) || 1;
  const ticker = match[3].toUpperCase();
  const entryPrice = parseFloat(match[4]) || 0;
  const stopLoss = parseFloat(match[5]) || 0;
  const takeProfit = parseFloat(match[6]) || 0;

  const spec = getContractSpec(ticker);
  const multiplier = spec.multiplier || 1;

  const riskPts = stopLoss > 0 ? Math.abs(entryPrice - stopLoss) : 0;
  const rewardPts = takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0;

  const dollarRisk = riskPts * multiplier * size;
  const dollarReward = rewardPts * multiplier * size;
  const rrRatio = riskPts > 0 ? Number((rewardPts / riskPts).toFixed(2)) : 0;

  return {
    direction,
    size,
    ticker,
    entryPrice,
    stopLoss,
    takeProfit,
    dollarRisk,
    dollarReward,
    rrRatio,
    multiplier
  };
}

export interface BentoCommandPaletteProps {
  onOpenLogTrade?: () => void;
  onRunMonteCarlo?: () => void;
}

export const BentoCommandPalette: React.FC<BentoCommandPaletteProps> = ({
  onOpenLogTrade,
  onRunMonteCarlo
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { createTrade } = useTrades();

  // Listen for Ctrl+K / Cmd+K and custom event
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener('bt_open_command_palette', handleCustomOpen);

    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('bt_open_command_palette', handleCustomOpen);
    };
  }, [open]);

  const parsedTrade = useMemo(() => parseTradeCommandString(query), [query]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    setQuery('');
    command();
  }, []);

  const handleExecuteParsedTrade = async () => {
    if (!parsedTrade || parsedTrade.entryPrice <= 0) return;

    try {
      await createTrade({
        ticker: parsedTrade.ticker,
        direction: parsedTrade.direction,
        position_size: parsedTrade.size,
        entry_price: parsedTrade.entryPrice,
        exit_price: parsedTrade.takeProfit || parsedTrade.entryPrice,
        stop_loss: parsedTrade.stopLoss,
        trade_date: new Date().toISOString().split('T')[0],
        status: 'open',
        pnl: 0,
        fees: parsedTrade.ticker.startsWith('M') ? 1.24 * parsedTrade.size : 4.20 * parsedTrade.size,
        risk_reward_ratio: parsedTrade.rrRatio,
        notes: `Executed via V6.0 Command Palette NL Parser (${query})`
      });

      toast.success(`Trade logged: ${parsedTrade.direction.toUpperCase()} ${parsedTrade.size} ${parsedTrade.ticker} @ $${parsedTrade.entryPrice}`);
      setOpen(false);
      setQuery('');
      navigate('/journal-history');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to execute trade command');
    }
  };

  return (
    <>
      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setOpen(false)} 
          />

          <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-white divide-y divide-zinc-800/80 animate-in zoom-in-95 duration-150 font-mono">
            
            <Command label="BentoTrade V6.0 Command Menu" className="w-full">
              {/* Command Input */}
              <div className="flex items-center px-4 py-3.5 gap-3 bg-zinc-900/60">
                <Search size={18} className="text-emerald-400 shrink-0" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Type a command or trade (e.g. 'Long 2 MNQ @ 20150 SL 20120 TP 20210')..."
                  className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-mono font-medium"
                  autoFocus
                />
                <kbd className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] font-mono text-zinc-400 border border-zinc-800">
                  ESC
                </kbd>
              </div>

              {/* Natural Language Trade Preview Card */}
              {parsedTrade && (
                <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={15} className="text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        LIVE TRADE COMMAND DETECTED
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase font-black">
                      {parsedTrade.direction.toUpperCase()} {parsedTrade.size}x {parsedTrade.ticker}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block">ENTRY PRICE</span>
                      <span className="font-bold text-white">${parsedTrade.entryPrice || '—'}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block">STOP LOSS</span>
                      <span className="font-bold text-rose-400">${parsedTrade.stopLoss || '—'}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block">PLANNED R:R</span>
                      <span className="font-bold text-emerald-400">1:{parsedTrade.rrRatio}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block">MAX DOLLAR RISK</span>
                      <span className="font-bold text-amber-400">-${parsedTrade.dollarRisk.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-zinc-400">
                      Contract Multiplier: ${parsedTrade.multiplier}/pt
                    </span>
                    <button
                      onClick={handleExecuteParsedTrade}
                      disabled={parsedTrade.entryPrice <= 0}
                      className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all flex items-center gap-1.5 disabled:opacity-40 shadow-md shadow-emerald-500/20"
                    >
                      <span>Enter ↵ Log Trade to Journal</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestions / List */}
              <Command.List className="max-h-[340px] overflow-y-auto p-2 space-y-2 font-mono">
                <Command.Empty className="p-6 text-center text-xs text-zinc-500">
                  No matching quant commands or pages.
                </Command.Empty>

                {/* Group 1: Navigation & AI Labs */}
                <Command.Group heading="QUICK NAV & AI QUANT LAB" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1">
                  
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/ai-insights'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-emerald-500/15 aria-selected:text-emerald-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Cpu size={15} className="text-emerald-400" />
                      <span>Go to AI Quant Lab</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/ai-insights</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/market-pulse'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-primary/15 aria-selected:text-primary cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame size={15} className="text-amber-400" />
                      <span>Jump to Next Macro Catalyst</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/market-pulse</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/journal-history'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-indigo-500/15 aria-selected:text-indigo-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} className="text-indigo-400" />
                      <span>Toggle Calendar Heatmap</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/journal-history</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => {
                      if (onRunMonteCarlo) onRunMonteCarlo();
                      else navigate('/ai-insights');
                    })}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-purple-500/15 aria-selected:text-purple-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={15} className="text-purple-400" />
                      <span>Run Monte Carlo Audit</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Z-Score Engine</span>
                  </Command.Item>

                </Command.Group>

                {/* Group 2: Journal & System Actions */}
                <Command.Group heading="JOURNAL & SYSTEM SETTINGS" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1 pt-2">
                  
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/journal'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-emerald-500/15 aria-selected:text-emerald-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <PlusCircle size={15} className="text-emerald-400" />
                      <span>Open Trade Execution Logger</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/journal</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/import'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-emerald-500/15 aria-selected:text-emerald-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <UploadCloud size={15} className="text-emerald-400" />
                      <span>Broker Data Sync (CSV Ingestion)</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/import</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/analytics'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3 size={15} className="text-zinc-400" />
                      <span>View Quantitative Analytics Suite</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/analytics</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/settings'))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity size={15} className="text-zinc-400" />
                      <span>Risk & Prop Firm Configuration</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">/settings</span>
                  </Command.Item>

                </Command.Group>
              </Command.List>

              {/* Footer Guide */}
              <div className="px-4 py-2.5 bg-zinc-950 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>BentoTrade REVISION_6.0</span>
                </span>
                <div className="flex items-center gap-2">
                  <span>Use ↑↓ to navigate</span>
                  <span>•</span>
                  <span>↵ to execute</span>
                </div>
              </div>
            </Command>

          </div>
        </div>
      )}
    </>
  );
};
