import React from 'react';
import { Terminal, Zap, ShieldAlert, Radio, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'emergency';

interface SystemNotificationProps {
  id?: string | number;
  message: string;
  level: NotificationLevel;
  timestamp?: string;
  onDismiss?: () => void;
}

const levelConfigs = {
  info: {
    icon: Terminal,
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    accent: 'bg-blue-400',
    header: '[ SYSTEM_INFO ]'
  },
  success: {
    icon: Zap,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
    accent: 'bg-emerald-400',
    header: '[ OPTIM_ACTIVE ]'
  },
  warning: {
    icon: ShieldAlert,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    accent: 'bg-amber-400',
    header: '[ UPLINK_WARN ]'
  },
  emergency: {
    icon: Radio,
    color: 'text-rose-400',
    border: 'border-rose-500/50',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]',
    accent: 'bg-rose-400',
    header: '[ CRIT_EMERGENCY ]'
  }
};

export const SystemNotification: React.FC<SystemNotificationProps> = ({ 
  message, 
  level, 
  timestamp, 
  onDismiss 
}) => {
  const config = levelConfigs[level];
  const Icon = config.icon;
  const time = timestamp || new Date().toLocaleTimeString('en-US', { hour12: false }) + ' UTC';

  return (
    <div className={cn(
      "dark relative min-w-[320px] max-w-[420px] bg-stone-950/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl overflow-hidden flex flex-col gap-3 group pointer-events-auto shadow-2xl",
      config.glow
    )}>
      {/* Accent Strip */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1.5",
        config.accent,
        level === 'emergency' && "animate-pulse"
      )} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg bg-white/[0.08] relative flex items-center justify-center border border-white/5", 
            config.color,
            level === 'emergency' && "shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"
          )}>
            <Icon size={16} className={cn(level === 'emergency' && "animate-pulse")} />
          </div>
          <span className="text-[10px] font-mono font-black tracking-[0.25em] text-white uppercase">
            {config.header}
          </span>
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Message */}
      <div className="text-zinc-300 text-[13px] font-medium leading-relaxed px-1">
        {message}
      </div>

      {/* Footer / Timestamp */}
      <div className="flex items-center justify-end px-1">
        <span className="text-[8px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase opacity-80">
          {time}
        </span>
      </div>
    </div>
  );
};
