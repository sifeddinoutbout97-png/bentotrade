/**
 * BentoTrade V6.0 Interactive Risk & Terminal Configuration Center
 * Manage prop firm account presets, daily loss limits, tilt guardrail parameters, and account telemetry.
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Trophy, 
  BarChart3, 
  CircleCheck, 
  Settings as SettingsIcon,
  Sliders,
  Save,
  Gauge,
  ShieldAlert,
  Zap,
  RotateCcw
} from 'lucide-react';
import { getTradeSummary } from '@/lib/trades';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { user: authUser, signOut } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Risk Settings State
  const [preset, setPreset] = useState<string>('$50,000 Topstep EOD');
  const [accountSize, setAccountSize] = useState<number>(50000);
  const [maxLoss, setMaxLoss] = useState<number>(2000);
  const [trailingDrawdown, setTrailingDrawdown] = useState<number>(2000);
  const [tiltLockoutLosses, setTiltLockoutLosses] = useState<number>(3);
  const [tiltLockoutMins, setTiltLockoutMins] = useState<number>(15);

  useEffect(() => {
    // Load saved risk settings
    try {
      const saved = localStorage.getItem('bt_v6_risk_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.preset) setPreset(parsed.preset);
        if (parsed.accountSize) setAccountSize(parsed.accountSize);
        if (parsed.maxLoss) setMaxLoss(parsed.maxLoss);
        if (parsed.trailingDrawdown) setTrailingDrawdown(parsed.trailingDrawdown);
        if (parsed.tiltLockoutLosses) setTiltLockoutLosses(parsed.tiltLockoutLosses);
        if (parsed.tiltLockoutMins) setTiltLockoutMins(parsed.tiltLockoutMins);
      }
    } catch (e) {
      console.warn('Error reading risk settings:', e);
    }

    const fetchData = async () => {
      try {
        const summary = await getTradeSummary();
        setStats(summary);
      } catch (error) {
        console.error('Error fetching settings summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePresetChange = (selected: string) => {
    setPreset(selected);
    if (selected === '$50,000 Topstep EOD') {
      setAccountSize(50000);
      setMaxLoss(2000);
      setTrailingDrawdown(2000);
    } else if (selected === '$50,000 Apex Intraday') {
      setAccountSize(50000);
      setMaxLoss(2500);
      setTrailingDrawdown(2500);
    } else if (selected === '$100,000 FTMO') {
      setAccountSize(100000);
      setMaxLoss(5000);
      setTrailingDrawdown(10000);
    }
  };

  const handleSaveRiskSettings = () => {
    const payload = {
      preset,
      accountSize,
      maxLoss,
      trailingDrawdown,
      tiltLockoutLosses,
      tiltLockoutMins
    };

    localStorage.setItem('bt_v6_risk_settings', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('bt_risk_settings_updated'));
    toast.success('V6.0 Risk & Prop Firm Parameters Saved!', {
      description: 'Telemetry HUD, Prop Copilot, and Execution Pad updated in real time.'
    });
  };

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
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 p-6 md:p-8 animate-in fade-in duration-500 pb-20 font-mono">
      
      {/* Header */}
      <header className="pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
          <span>System</span> / <span>Settings</span> / <span className="text-emerald-400">V6.0 Terminal Config</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-zinc-100 flex items-center gap-3">
          Risk & Prop Firm Configuration <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">REVISION_6.0</span>
        </h1>
        <p className="text-xs font-mono text-zinc-400 mt-1">
          Configure prop firm evaluation rules, daily loss buffers, tilt lockouts, and identity credentials.
        </p>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Trader Identity (4 Columns) */}
        <div className="col-span-1 lg:col-span-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <User size={14} className="text-emerald-400" /> Trader Identity
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 rounded font-mono text-[10px] uppercase px-2 py-0.5">
              PROTOCOL V6.0
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {authUser?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">
                {authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Authenticated Trader'}
              </div>
              <div className="text-xs text-zinc-400 truncate mt-0.5">
                {authUser?.email}
              </div>
            </div>
          </div>

          {/* Account UUID */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Shield size={12} className="text-zinc-500" /> Account UUID
            </span>
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 break-all select-all font-mono">
              {authUser?.id || 'SEC_UNASSIGNED'}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                <BarChart3 size={12} /> Total Executions
              </div>
              <p className="text-xl font-bold text-white">
                {stats?.totalTrades || 0}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                <Trophy size={12} className="text-amber-400" /> Win Rate
              </div>
              <p className="text-xl font-bold text-emerald-400">
                {stats?.winRate?.toFixed(1) || 0}%
              </p>
            </div>
          </div>

          {/* Sign Out */}
          <div className="pt-4 border-t border-zinc-800/80">
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full h-10 rounded-xl border-zinc-800 bg-zinc-900 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800 transition-colors font-mono text-xs uppercase tracking-wider text-zinc-300"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Risk & Prop Firm Parameters (8 Columns) */}
        <div className="col-span-1 lg:col-span-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sliders size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight uppercase">V6.0 PROP FIRM & RISK PARAMETERS</h2>
                <p className="text-xs text-zinc-400">Live guardrail thresholds enforcing zero-tilt discipline</p>
              </div>
            </div>

            <Button
              onClick={handleSaveRiskSettings}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Save size={15} />
              <span>Save Config</span>
            </Button>
          </div>

          {/* Preset Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              1. ACCOUNT EQUITY & PROP FIRM PRESET
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                '$50,000 Topstep EOD',
                '$50,000 Apex Intraday',
                '$100,000 FTMO',
                'Custom'
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-20",
                    preset === p 
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold text-zinc-500">PRESET</span>
                  <span className="text-xs font-extrabold">{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Numerical Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            
            {/* Account Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                STARTING ACCOUNT BALANCE ($)
              </label>
              <input
                type="number"
                value={accountSize}
                onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            {/* Daily Max Loss */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                DAILY MAX LOSS LIMIT ($)
              </label>
              <input
                type="number"
                value={maxLoss}
                onChange={(e) => setMaxLoss(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            {/* Trailing Drawdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                MAX TRAILING DRAWDOWN ($)
              </label>
              <input
                type="number"
                value={trailingDrawdown}
                onChange={(e) => setTrailingDrawdown(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            {/* Tilt Lockout Threshold */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                TILT GUARDRAIL LOSS TRIGGER
              </label>
              <select
                value={tiltLockoutLosses}
                onChange={(e) => setTiltLockoutLosses(parseInt(e.target.value, 10))}
                className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
              >
                <option value={2}>2 Consecutive Losses in 20 min</option>
                <option value={3}>3 Consecutive Losses in 20 min</option>
                <option value={4}>4 Consecutive Losses in 20 min</option>
              </select>
            </div>

          </div>

          {/* Guardrail Lockout Policy Banner */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
            <span className="font-bold uppercase tracking-wider text-emerald-400 block">ZERO-TILT LOCKOUT POLICY:</span>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              When {tiltLockoutLosses} consecutive losses occur within 20 minutes or daily drawdown limit (${maxLoss}) is breached, the Quick Execution Pad triggers a mandatory {tiltLockoutMins}-minute lockout overlay to protect firm capital.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
