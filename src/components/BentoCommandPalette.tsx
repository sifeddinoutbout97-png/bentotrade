import React, { useEffect, useState, useCallback } from 'react';
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
  Command as CommandIcon 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface BentoCommandPaletteProps {
  onOpenLogTrade?: () => void;
  onRunMonteCarlo?: () => void;
}

export const BentoCommandPalette: React.FC<BentoCommandPaletteProps> = ({
  onOpenLogTrade,
  onRunMonteCarlo
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Listen for Ctrl+K / Cmd+K
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

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      {/* Floating Trigger Pill for Mobile/Mouse users */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 dark:bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white shadow-2xl backdrop-blur-xl text-xs font-mono transition-all hover:scale-105"
      >
        <CommandIcon size={14} className="text-primary" />
        <span>Command Menu</span>
        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-bold border border-zinc-700">
          ⌘K
        </kbd>
      </button>

      {/* Headless Command Palette Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          {/* Backdrop click to close */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setOpen(false)} 
          />

          <div className="w-full max-w-2xl rounded-3xl bg-gray-900/90 border border-zinc-800 shadow-2xl backdrop-blur-2xl overflow-hidden text-white divide-y divide-zinc-800 animate-in zoom-in-95 duration-150">
            <Command label="BentoTrade Command Menu" className="w-full">
              {/* Search Bar Input */}
              <div className="flex items-center px-5 py-4 gap-3 bg-zinc-950/40">
                <Search size={18} className="text-primary shrink-0" />
                <Command.Input
                  placeholder="Type a quant command or search actions..."
                  className="w-full bg-transparent text-sm md:text-base text-white placeholder-zinc-500 outline-none font-medium"
                  autoFocus
                />
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-400 border border-zinc-700">
                  ESC
                </kbd>
              </div>

              {/* Suggestions / Groups */}
              <Command.List className="max-h-[380px] overflow-y-auto p-3 space-y-3 font-sans">
                <Command.Empty className="p-8 text-center text-xs font-mono text-zinc-500">
                  No matching quant commands found.
                </Command.Empty>

                {/* Group 1: Trading */}
                <Command.Group heading="Trading Actions" className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 px-3 py-1">
                  <Command.Item
                    onSelect={() => runCommand(() => {
                      if (onOpenLogTrade) {
                        onOpenLogTrade();
                      } else {
                        navigate('/journal');
                      }
                      toast.info('Opening trade execution ledger');
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-emerald-500/15 aria-selected:text-emerald-400 aria-selected:border aria-selected:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <PlusCircle size={16} className="text-emerald-500" />
                      <span>Log New Trade</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Instant Sync</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => {
                      navigate('/journal');
                      toast.info('Navigating to open positions');
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-rose-500/15 aria-selected:text-rose-400 aria-selected:border aria-selected:border-rose-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle size={16} className="text-rose-500" />
                      <span>Quick Close Position</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Portfolio</span>
                  </Command.Item>
                </Command.Group>

                {/* Group 2: Intelligence & Quant */}
                <Command.Group heading="Intelligence & Quant Engine" className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 px-3 py-1 pt-2">
                  <Command.Item
                    onSelect={() => runCommand(() => {
                      navigate('/market-pulse');
                      toast.success('Analyzing QQQ / Tech 100 liquidity corridors');
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-primary/20 aria-selected:text-primary aria-selected:border aria-selected:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp size={16} className="text-primary" />
                      <span>Analyze QQQ Order Flow & Corridors</span>
                    </div>
                    <span className="text-[10px] font-mono text-primary font-bold">Neural Engine</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => {
                      if (onRunMonteCarlo) {
                        onRunMonteCarlo();
                      } else {
                        navigate('/analytics');
                      }
                      toast.success('Executing 10,000-path Monte Carlo risk simulation');
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-indigo-500/20 aria-selected:text-indigo-400 aria-selected:border aria-selected:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Cpu size={16} className="text-indigo-400" />
                      <span>Run Monte Carlo Risk Simulation</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400">Web Worker</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => {
                      navigate('/analytics');
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 size={16} className="text-zinc-400" />
                      <span>View Quantitative Analytics Suite</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Sharpe / DD</span>
                  </Command.Item>
                </Command.Group>

                {/* Group 3: Navigation & UI */}
                <Command.Group heading="UI & System Theme" className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 px-3 py-1 pt-2">
                  <Command.Item
                    onSelect={() => runCommand(() => {
                      const next = theme === 'dark' ? 'light' : 'dark';
                      setTheme(next);
                      toast.info(`Theme set to ${next} mode`);
                    })}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-amber-500/15 aria-selected:text-amber-400 aria-selected:border aria-selected:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Sun size={16} className="text-amber-400" />
                      ) : (
                        <Moon size={16} className="text-indigo-400" />
                      )}
                      <span>Toggle Dark / Light Mode</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 capitalize">{theme}</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/journal'))}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} className="text-zinc-400" />
                      <span>Go to Journal Ledger</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">History</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/market-pulse'))}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Activity size={16} className="text-zinc-400" />
                      <span>Go to MarketPulse Macro Calendar</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Macro</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/ai-insights'))}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium cursor-pointer text-zinc-200 aria-selected:bg-white/10 aria-selected:text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Cpu size={16} className="text-emerald-400" />
                      <span>Go to Market Intelligence & Telemetry</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">Terminal</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>

              {/* Footer Guide */}
              <div className="px-5 py-3 bg-zinc-950/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>BentoTrade v5.5 Institutional Core</span>
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
