import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  RefreshCw, 
  Cpu, 
  Database,
  Info,
  ShieldAlert,
  Zap,
  Terminal,
  Trash2,
  AlertOctagon
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Broadcast {
  id: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'emergency';
  target_type: 'all' | 'ticker' | 'sector';
  target_value?: string;
  created_at: string;
}

interface BroadcastCenterProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BroadcastCenter: React.FC<BroadcastCenterProps> = ({ isOpen, onOpenChange }) => {
  const { user, impersonatingUserId } = useAuth();
  
  // Input State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLevel, setBroadcastLevel] = useState<'info' | 'success' | 'warning' | 'emergency'>('info');
  const [targetType, setTargetType] = useState<'all' | 'ticker' | 'sector'>('all');
  const [targetValue, setTargetValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Ledger State
  const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([]);

  // Fetch History & Subscribe
  useEffect(() => {
    let isMounted = true;
    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!error && data && isMounted) {
          setRecentBroadcasts(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch broadcast history:", err);
      }
    };

    fetchHistory();

    const channel = supabase.channel('broadcast-center-ledger');
    
    channel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'broadcasts' 
      }, (payload) => {
        if (isMounted) {
          setRecentBroadcasts(prev => [payload.new as Broadcast, ...(prev || [])].slice(0, 10));
        }
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'broadcasts' 
      }, (payload) => {
        if (isMounted) {
          setRecentBroadcasts(prev => prev.filter(b => b.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error("FAILED_TO_SYNC_LEDGER");
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  const handleRecall = async (id: string) => {
    // Custom confirm style for consistency
    const confirmation = window.confirm("RECALL_SAFETY_PROTOCOL v1.1: ARE YOU SURE YOU WANT TO TERMINATE THIS BROADCAST?");
    if (!confirmation) return;

    try {
      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("RECALL_SUCCESS: BROADCAST_TERMINATED");
    } catch (err) {
      console.error("RECALL_FAILED:", err);
      toast.error("COMM_ERROR: RECALL_LINK_FAILED");
    }
  };

  const handleTransmit = async () => {
    if (!broadcastMessage.trim()) {
      toast.error("COMM_ERROR: EMPTY_PAYLOAD");
      return;
    }

    if (targetType !== 'all' && !targetValue.trim()) {
      toast.error("COMM_ERROR: TARGET_MISSING");
      return;
    }

    setIsSending(true);
    try {
      // Use logical OR to ensure we have a valid sender ID, prioritizing impersonation if active
      const finalSenderId = impersonatingUserId || user?.id;

      const { error } = await supabase
        .from('broadcasts')
        .insert([{ 
          message: broadcastMessage.trim(), 
          level: broadcastLevel,
          target_type: targetType,
          target_value: targetType === 'all' ? null : targetValue.trim().toUpperCase(),
          sender_id: finalSenderId,
          created_at: new Date().toISOString() 
        }]);

      if (error) throw error;
      
      toast.success("TRANSMISSION_SUCCESS: PAYLOAD_DISPATCHED");
      setBroadcastMessage('');
      setTargetValue('');
      onOpenChange(false);
    } catch (err) {
      console.error("TRANSMISSION_FAILED:", err);
      toast.error("FATAL_ERROR: LINK_FAILURE");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[90vw] lg:max-w-6xl !max-w-6xl bg-black/90 border-white/10 rounded-[1.5rem] p-0 shadow-2xl backdrop-blur-3xl overflow-hidden ring-0 outline-none border">
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[600px]">
          {/* Left Section: Transmission Control (7 cols) */}
          <div className="lg:col-span-7 p-10 flex flex-col h-full overflow-y-auto scrollbar-hide border-r border-white/5">
            <header className="mb-8 shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/20">
                  <Terminal size={28} className="animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black text-white tracking-[0.25em] uppercase leading-none mb-2">
                    COMMAND_CORE
                  </DialogTitle>
                  <DialogDescription className="text-zinc-500 font-bold text-[10px] tracking-[0.5em] uppercase opacity-60 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Secure Uplink Established • Protocol v3.5
                  </DialogDescription>
                </div>
              </div>
            </header>

            <div className="flex-1 space-y-8">
              {/* Target Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-3 px-1">
                  <div className="w-1 h-3 bg-purple-600 rounded-full" />
                  Routing_Parameters
                </label>
                
                <div className="flex p-1.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  {['all', 'ticker', 'sector'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setTargetType(type as any)}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 relative overflow-hidden group",
                        targetType === type 
                          ? "text-white" 
                          : "text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      {targetType === type && (
                        <motion.div 
                          layoutId="activeTabBroadcast"
                          className="absolute inset-0 bg-white/5 border border-white/10 shadow-[inset_0_0_30px_rgba(255,255,255,0.03)]"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10">{type}</span>
                    </button>
                  ))}
                </div>

                {targetType !== 'all' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-1"
                  >
                    {targetType === 'ticker' ? (
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-purple-500 transition-colors">
                          <Zap size={14} />
                        </div>
                        <input 
                          type="text"
                          placeholder="IDENTIFIER_TAG (e.g., BTC, ES...)"
                          value={targetValue}
                          onChange={(e) => setTargetValue(e.target.value.toUpperCase())}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-6 py-4 text-xs font-black text-white placeholder:text-zinc-800 focus:outline-none focus:border-purple-500/50 transition-all uppercase tracking-[0.2em] font-mono"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {['Futures', 'Forex', 'Crypto', 'Stocks'].map((sector) => (
                          <button
                            key={sector}
                            onClick={() => setTargetValue(sector)}
                            className={cn(
                              "py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] border transition-all duration-500",
                              targetValue === sector 
                                ? "bg-purple-500/20 border-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.1)]" 
                                : "bg-white/[0.01] border-white/5 text-zinc-600 hover:border-white/20 hover:text-zinc-400"
                            )}
                          >
                            {sector}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Priority Matrix */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-3 px-1">
                  <div className="w-1 h-3 bg-purple-600 rounded-full" />
                  Priority_Vector
                </label>
                <div className="flex gap-3">
                  {[
                    { id: 'info', color: 'blue', label: 'INFO', icon: Info, glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
                    { id: 'success', color: 'emerald', label: 'OPTIM', icon: Zap, glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]' },
                    { id: 'warning', color: 'amber', label: 'WARN', icon: ShieldAlert, glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' },
                    { id: 'emergency', color: 'rose', label: 'CRIT', icon: Radio, glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]' },
                  ].map((level) => {
                    const isActive = broadcastLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        onClick={() => setBroadcastLevel(level.id as any)}
                        className={cn(
                          "flex-1 h-14 rounded-xl border transition-all duration-500 flex flex-col items-center justify-center gap-1 group relative overflow-hidden",
                          isActive 
                            ? `border-${level.color}-500 bg-${level.color}-500/10 ${level.glow}` 
                            : "border-white/5 bg-white/[0.01] hover:border-white/20"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-black tracking-[0.2em] transition-colors relative z-10",
                          isActive ? `text-white` : "text-zinc-600 group-hover:text-zinc-500"
                        )}>
                          {level.label}
                        </span>
                        <div className={cn(
                          "h-0.5 w-4 rounded-full transition-all duration-500 relative z-10",
                          isActive ? `bg-${level.color}-500` : "bg-zinc-800"
                        )} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payload Field */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 flex items-center gap-3 px-1">
                  <div className="w-1 h-3 bg-purple-600 rounded-full" />
                  Payload_Sequence
                </label>
                <div className="relative">
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="ENTER RAW COMMUNICATIONS DATA..."
                    className="w-full h-40 bg-zinc-950/50 border border-white/10 rounded-2xl p-6 text-white placeholder:text-zinc-800 focus:outline-none focus:border-purple-500/50 transition-all resize-none text-xs font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <footer className="pt-8 mt-auto flex items-center justify-end gap-6 shrink-0">
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[9px] hover:bg-white/5 h-12 px-6 rounded-xl transition-all"
              >
                ABORT_LINK
              </Button>
              <Button 
                onClick={handleTransmit}
                disabled={isSending || !broadcastMessage.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-[0.4em] text-[10px] h-12 px-10 rounded-xl shadow-[0_0_40px_rgba(147,51,234,0.3)] disabled:opacity-50 transition-all group overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-3">
                  {isSending ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      DISPATCHING...
                    </>
                  ) : (
                    <>
                      TRANSMIT_DATA
                      <Radio size={14} />
                    </>
                  )}
                </span>
              </Button>
            </footer>
          </div>

          {/* Right Section: Dispatch Ledger (5 cols) */}
          <div className="hidden lg:flex lg:col-span-5 bg-zinc-950/40 border-l border-white/5 flex-col h-full overflow-hidden">
            <header className="p-8 border-b border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent shrink-0">
              <div className="flex items-center justify-between mb-3 leading-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                  TRADE_LOGGING_ENGINE 
                  <span className="text-[8px] font-mono text-emerald-500 font-bold tracking-normal opacity-80 decoration-emerald-500/20 underline underline-offset-2 uppercase">[STATUS: VERIFIED • v2.5]</span>
                </h4>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-emerald-500/60 font-bold">LIVE</span>
                </div>
              </div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] leading-relaxed">
                High-fidelity telemetry for system-wide auditing.
              </p>
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
              {recentBroadcasts?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-6">
                  <Radio size={64} className="text-zinc-600" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">STATIC_IDLE</p>
                </div>
              ) : (
                recentBroadcasts?.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 group hover:bg-white/[0.04] transition-all relative overflow-hidden"
                  >
                    <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          log.level === 'emergency' ? 'bg-rose-500' : 
                          log.level === 'warning' ? 'bg-amber-500' : 
                          log.level === 'success' ? 'bg-emerald-500' : 
                          'bg-blue-500'
                        )} />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-[0.3em]",
                          log.level === 'emergency' ? 'text-rose-500' : 
                          log.level === 'warning' ? 'text-amber-500' : 
                          log.level === 'success' ? 'text-emerald-500' : 
                          'text-blue-500'
                        )}>
                          {log.level}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-600 font-bold">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </span>
                      <button 
                        onClick={() => handleRecall(log.id)}
                        className="ml-3 p-1.5 rounded-lg bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white border border-rose-500/20"
                        title="Recall Broadcast"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    
                    <p className="text-[10px] font-medium text-zinc-400 leading-relaxed tracking-wide italic relative z-10 line-clamp-2">
                       "{log.message}"
                    </p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10">
                      <div className="flex items-center gap-2">
                        <Cpu size={12} className="text-zinc-700" />
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">
                          NODE::{log.target_type}
                        </span>
                      </div>
                      {log.target_value && (
                        <span className="text-[9px] font-mono font-black text-purple-400/50 tracking-tighter">
                          [{log.target_value}]
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <footer className="p-6 bg-black/40 border-t border-white/5 shrink-0">
              <div className="flex items-center justify-between opacity-30">
                <div className="flex items-center gap-3">
                  <Database size={14} className="text-zinc-600" />
                  <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em]">END_LOG</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-700 font-bold tracking-tight">SEC_04</span>
              </div>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  );
};
