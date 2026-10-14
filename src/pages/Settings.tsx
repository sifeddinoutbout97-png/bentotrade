
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Trophy, 
  TrendingUp,
  BarChart3,
  LogOut,
  Settings as SettingsIcon,
  CircleCheck,
  Bot,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTradeSummary } from '@/lib/trades';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export default function Settings() {
  const { isAdmin, user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setUser(authUser);
        const summary = await getTradeSummary();
        setStats(summary);
      } catch (error) {
        console.error('Error fetching settings data:', error);
        setUser(authUser);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authUser]);

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 md:p-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
          <span>System</span> / <span>Settings</span> / <span className="text-emerald-500">Account Telemetry</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-zinc-100">
          Account & Modules
        </h1>
        <p className="text-xs font-mono text-zinc-400 mt-1">
          Manage identity credentials, cryptographic session telemetry, and active execution modules.
        </p>
      </header>

      {/* 12-Column Asymmetrical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Trader Profile (4 Columns on LG) */}
        <div className="col-span-1 lg:col-span-4 rounded-md border border-zinc-800/80 bg-zinc-950/50 p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <User size={13} className="text-emerald-400" /> Trader Identity
            </span>
            <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-800/60 rounded-sm font-mono text-[10px] uppercase px-2 py-0.5">
              Active
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 text-2xl font-mono font-bold shrink-0">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-mono font-bold text-zinc-100 truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Authenticated Trader'}
              </div>
              <div className="text-xs font-mono text-zinc-400 truncate mt-0.5">
                {user?.email}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-1">
                Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric', day: 'numeric' }) : 'Unknown'}
              </div>
            </div>
          </div>

          {/* Account UUID Badge */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Shield size={11} className="text-zinc-600" /> Account UUID
            </span>
            <div className="p-2.5 rounded-sm bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-300 break-all select-all">
              {user?.id || 'SEC_UNASSIGNED'}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
            <div className="p-3 rounded-sm bg-zinc-900/60 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                <BarChart3 size={11} /> Trades
              </div>
              <p className="text-xl font-mono font-bold text-zinc-100">
                {stats?.totalTrades || 0}
              </p>
            </div>
            <div className="p-3 rounded-sm bg-zinc-900/60 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                <Trophy size={11} className="text-amber-400" /> Win Rate
              </div>
              <p className="text-xl font-mono font-bold text-emerald-400">
                {stats?.winRate?.toFixed(1) || 0}%
              </p>
            </div>
          </div>

          {/* Security & Sign Out */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <CircleCheck size={14} className="text-emerald-500 shrink-0" />
              <span>Session Authenticated & Encrypted</span>
            </div>

            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full h-9 rounded-sm border-zinc-800 bg-zinc-900/60 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/60 transition-colors font-mono text-xs uppercase tracking-wider gap-2 text-zinc-300"
            >
              <LogOut size={13} />
              Sign Out Session
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: System Modules (8 Columns on LG, Vertically Stacked) */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          {/* Module 1: Trade Logging Engine */}
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-6 space-y-4">
            <div className="flex flex-row items-center justify-between whitespace-nowrap gap-4 pb-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-indigo-950/60 text-indigo-400 border border-indigo-800/60 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm text-zinc-100">Trade Logging Engine</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">High-Frequency Telemetry</p>
                </div>
              </div>
              <Badge className="bg-indigo-950/40 text-indigo-400 border-indigo-800/50 rounded-sm font-mono text-[9px] uppercase px-2 py-0.5 shrink-0">
                V5.0 ACTIVE
              </Badge>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed font-sans">
              Real-time execution telemetry synchronized via Supabase zero-trust infrastructure. Automated multi-asset precision journaling with native support for index futures (NQ, ES), commodities (CL, GC), and Forex contract multipliers.
            </p>

            <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Zero-latency sync</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
          </div>

          {/* Module 2: AI Insights v5.0 */}
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-6 space-y-4">
            <div className="flex flex-row items-center justify-between whitespace-nowrap gap-4 pb-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm text-zinc-100">AI Insights v5.0</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Neural Risk Audit</p>
                </div>
              </div>
              <Badge className="bg-amber-950/40 text-amber-400 border-amber-800/50 rounded-sm font-mono text-[9px] uppercase px-2 py-0.5 shrink-0">
                V5.0 PIPELINE
              </Badge>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed font-sans">
              Quantitative behavioral analysis engine. Continuously audits execution history to identify expectancy variance, win/loss clustering, and revenge trading triggers, enforcing strict risk protocol adherence.
            </p>

            <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Pattern recognition</span>
              <span className="text-emerald-400">ARMED</span>
            </div>
          </div>

          {/* Module 3: System Configuration (Admin Only) */}
          {isAdmin && (
            <div className="rounded-md border border-purple-900/40 bg-zinc-950/50 p-6 space-y-4">
              <div className="flex flex-row items-center justify-between whitespace-nowrap gap-4 pb-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-purple-950/60 text-purple-400 border border-purple-800/60 flex items-center justify-center shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-sm text-zinc-100">Control Tower Root Access</h3>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Fleet Administration & Audit</p>
                  </div>
                </div>
                <Badge className="bg-purple-950/40 text-purple-400 border-purple-800/50 rounded-sm font-mono text-[9px] uppercase px-2 py-0.5 shrink-0">
                  SEC_LEVEL_ROOT
                </Badge>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed font-sans">
                As a system administrator, you have access to core fleet operations, Ghost Mode session simulation, database integrity audits, and global user permissions.
              </p>

              <div className="pt-2 flex items-center justify-end">
                <Button 
                  variant="outline" 
                  className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 rounded-sm font-mono text-xs h-8 px-4"
                  onClick={() => window.location.href = '/admin'}
                >
                  Launch Control Tower →
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
