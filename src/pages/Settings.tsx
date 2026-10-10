
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
    <div className="max-w-4xl mx-auto space-y-12 p-6 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-[40px] font-bold text-foreground tracking-tight mb-2">Account</h1>
        <p className="text-muted-foreground text-lg font-medium opacity-80">Manage your profile and account preferences.</p>
      </header>

      <section className="grid gap-8">
        {/* Profile Card */}
        <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden border-none ring-1 ring-border">
          <CardHeader className="bg-muted/30 border-b border-border py-8 px-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-3xl font-black shadow-2xl shadow-primary/20">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-black text-foreground">Trader Profile</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none rounded-lg px-3 py-0.5 font-bold">Active</Badge>
                  <span className="opacity-40">•</span>
                  <span className="font-medium">Member since {new Date(user?.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Email Address</label>
                  <div className="flex items-center gap-3 text-foreground font-bold text-lg">
                    <Mail size={18} className="text-primary opacity-60" />
                    {user?.email}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Account ID</label>
                  <div className="flex items-center gap-3 text-muted-foreground font-mono text-xs opacity-80">
                    <Shield size={18} className="opacity-40" />
                    {user?.id}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-muted/20 border border-border space-y-2 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BarChart3 size={14} className="group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Trades</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{stats?.totalTrades || 0}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/20 border border-border space-y-2 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy size={14} className="group-hover:text-amber-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Win Rate</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{stats?.winRate.toFixed(1) || 0}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CircleCheck size={16} className="text-emerald-500" />
                </div>
                Data secured by Supabase Zero-Trust
              </div>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="h-11 px-6 rounded-xl border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all font-bold gap-3 text-foreground"
              >
                <LogOut size={16} />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md shadow-sm p-8 space-y-6 group hover:border-primary/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">Trade Logging Engine</h3>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Contract multipliers active</p>
              </div>
            </div>
            <p className="text-[15px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
              Trade Logging Engine v3.8 is now fully synchronized with Supabase real-time telemetry. Featuring enhanced high-frequency auditing for $NQ and $ES contract multipliers, and automated precision journaling for multi-asset execution. Zero-latency PnL tracking is now active across all global corridors.
            </p>
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-none font-bold uppercase text-[10px] tracking-widest px-3">V3.8 ACTIVE</Badge>
          </Card>

          <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md shadow-sm p-8 space-y-6 border-dashed relative overflow-hidden group hover:border-border/80 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <Bot size={80} />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">AI Insights v4.5</h3>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Operational</p>
              </div>
            </div>
            <p className="text-[15px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
              AI Insights v4.5 has transitioned to the Neural-Sync Pipeline. Currently processing institutional order flow data and deep-risk neural audits. Predictive sentiment modeling and volatility clustering analysis are now integrated for real-time strategic intelligence.
            </p>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-none font-bold uppercase text-[10px] tracking-widest px-3">V4.5 PIPELINE</Badge>
          </Card>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 gap-8 mt-8">
            <Card className="rounded-3xl border-destructive/20 bg-card shadow-sm p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground tracking-tight">System Configuration (Admin)</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Global Settings</p>
                </div>
              </div>
              <p className="text-[15px] text-muted-foreground leading-relaxed font-medium mt-2">
                As an administrator, you have access to core system operations. Extreme caution is advised when modifying global settings.
              </p>
              <div className="flex items-center gap-4 pt-4">
                {/* Future settings can go here */}
                <Button variant="outline" className="border-border rounded-xl font-bold" onClick={() => window.location.href='/admin'}>Go to Admin Dashboard</Button>
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
