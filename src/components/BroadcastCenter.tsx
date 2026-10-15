/**
 * BentoTrade V6.0 Command Core Broadcast Center Modal
 * Handles system-wide broadcasts and dispatch ledger history.
 */

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

  // Fetch History
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
  }, [isOpen]);

  const handleRecall = async (id: string) => {
    try {
      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .eq('id', id);

      if (!error) {
        setRecentBroadcasts(prev => prev.filter(b => b.id !== id));
        toast.success("Broadcast recalled");
      }
    } catch (err) {
      console.error("RECALL_FAILED:", err);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("ARE YOU SURE YOU WANT TO CLEAR ALL BROADCAST HISTORY?")) {
      try {
        const { error } = await supabase
          .from('broadcasts')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (!error) {
          setRecentBroadcasts([]);
          toast.success("Broadcast history cleared");
        }
      } catch (err) {
        toast.error("Failed to clear broadcast history");
      }
    }
  };

  const handleTransmit = async () => {
    if (!broadcastMessage.trim()) {
      toast.error("EMPTY_PAYLOAD");
      return;
    }

    setIsSending(true);
    try {
      const finalSenderId = impersonatingUserId || user?.id;

      const { error, data } = await supabase
        .from('broadcasts')
        .insert([{ 
          message: broadcastMessage.trim(), 
          level: broadcastLevel,
          target_type: targetType,
          target_value: targetValue || undefined,
          user_id: finalSenderId
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setRecentBroadcasts(prev => [data as Broadcast, ...prev]);
      }

      toast.success("TRANSMIT_SUCCESS: BROADCAST DISPATCHED");
      setBroadcastMessage('');
      setTargetValue('');
    } catch (err: any) {
      console.error("TRANSMIT_FAILED:", err);
      toast.error(err?.message || "TRANSMIT_FAILED");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl !max-w-6xl w-[95vw] h-[85vh] max-h-[85vh] rounded-3xl bg-zinc-950 border-zinc-800 p-0 shadow-2xl overflow-hidden font-mono flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar border-r border-zinc-800/80">
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Radio size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">COMMAND CORE BROADCAST</h3>
                  <p className="text-xs text-zinc-500 uppercase">System-Wide Telemetry Dispatcher</p>
                </div>
              </div>
            </header>

            <div className="space-y-5 flex-1">
              {/* Target Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">TARGET NODE</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'ticker', 'sector'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTargetType(type)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold uppercase border transition-all",
                        targetType === type ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">PRIORITY LEVEL</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['info', 'success', 'warning', 'emergency'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setBroadcastLevel(lvl)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold uppercase border transition-all",
                        broadcastLevel === lvl ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payload Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">BROADCAST PAYLOAD</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter broadcast message to dispatch to connected platform clients..."
                  className="w-full h-32 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 font-mono resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <footer className="pt-4 mt-auto border-t border-zinc-800/80 flex items-center justify-end gap-3 shrink-0">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-zinc-400 hover:text-white text-xs h-10 px-4 rounded-xl"
              >
                Abort
              </Button>
              <Button
                onClick={handleTransmit}
                disabled={isSending || !broadcastMessage.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2"
              >
                {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Radio size={14} />}
                <span>TRANSMIT_DATA</span>
              </Button>
            </footer>
          </div>

          {/* Right Ledger (5 cols) */}
          <div className="hidden lg:flex lg:col-span-5 bg-zinc-900/30 flex-col h-full overflow-hidden">
            <header className="p-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Broadcast History</span>
              {recentBroadcasts.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase transition-colors"
                >
                  Clear History
                </button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {recentBroadcasts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 space-y-2">
                  <Radio size={32} />
                  <span className="text-xs font-bold uppercase">No Active Broadcasts</span>
                </div>
              ) : (
                recentBroadcasts.map(b => (
                  <div key={b.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 relative group">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="font-bold text-purple-400 uppercase">[{b.level}]</span>
                      <span>{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-zinc-200">{b.message}</p>
                    <button
                      onClick={() => handleRecall(b.id)}
                      className="absolute top-2 right-2 p-1 rounded bg-rose-500/10 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete entry"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};
