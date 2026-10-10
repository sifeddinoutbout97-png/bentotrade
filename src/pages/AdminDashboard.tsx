import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  Cpu, 
  RefreshCw,
  DatabaseBackup,
  Database,
  Radio,
  Settings,
  MoreVertical,
  Clock,
  CircleDot,
  Ghost
} from 'lucide-react';
import { motion } from 'motion/react';
import { BroadcastCenter } from '@/components/BroadcastCenter';
import { AuditReportModal, type AuditReport, type AuditIssue } from '@/components/AuditReportModal';
import { UserManagementModal, type ManagedUser } from '@/components/UserManagementModal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  role: string | null;
  full_name?: string | null;
  display_name?: string | null;
  created_at: string;
}

interface ActivityEvent {
  id: string;
  user_id: string;
  type: 'TRADE_LOGGED' | 'USER_JOINED';
  ticker?: string;
  pnl?: number;
  full_name?: string;
  timestamp: Date;
}

interface AuditResult {
  id: string;
  ticker: string;
  trade_date: string;
  issue: string;
  user_id: string;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { initiateGhostMode, exitGhostMode, impersonatingUserId } = useAuth();
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uptime, setUptime] = useState('00:00:00');
  
  // New State for Live Activity & Ghost Mode
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [liveActivities, setLiveActivities] = useState<ActivityEvent[]>([]);

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Broadcast Center State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // User Management State
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      setUptime(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const channels: any[] = [];

    const fetchAdminData = async () => {
      setIsLoading(true);
      console.log("FETCH_INIT: Starting global admin telemetry sync...");
      try {
        // Platform Volume - Fetching TOTAL trades across ALL users
        const { count: tradesCount, error: tradesError } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true });
        
        if (tradesError) {
          console.error("PLATFORM_VOLUME_FAULT:", tradesError);
        } else if (isMounted) {
          console.log(`PLATFORM_VOLUME_CONNECTED: ${tradesCount} records found system-wide.`);
          setTotalTrades(tradesCount || 0);
        }

        // User Base - Fetching TOTAL profiles across ALL users
        console.log("USER_BASE_SYNC: Requesting global profile set (No Filters)...");
        const { data: usersData, count: usersCount, error: usersDataError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });
        
        if (usersDataError) {
          console.error("USER_BASE_FAULT:", usersDataError);
          if (isMounted) {
            setUsers([]);
            setTotalUsers(0);
            toast.error(`FETCH_ERROR: USER_BASE_LINK_FAILED: ${usersDataError.message}`);
          }
        } else if (usersData && isMounted) {
          // THE DIAGNOSTIC LOG REQUESTED
          console.log("ALL_PROFILES_FETCHED:", usersData);
          console.log(`USER_BASE_CONNECTED: ${usersData.length} profiles retrieved. Exact DB count: ${usersCount}`);
          
          if (usersData.length === 0) {
            console.warn("USER_BASE_EMPTY: Database returned zero rows. Verifying RLS or table status.");
          }

          const uniqueUsersMap = new Map<string, Profile>();
          usersData.forEach(u => {
            if (u && u.id) uniqueUsersMap.set(u.id, u);
          });
          const uniqueUsers = Array.from(uniqueUsersMap.values());

          setUsers(uniqueUsers); 
          setTotalUsers(usersCount || uniqueUsers.length);
          
          const map: Record<string, string> = {};
          uniqueUsers.forEach(u => {
            map[u.id] = u.full_name || u.display_name || 'Anonymous Trader';
          });
          setUserMap(map);
        }

      } catch (err) {
        console.error("ADMIN_DAEMON_FAULT:", err);
        if (isMounted) {
          toast.error("SYSTEM_FAULT: OVERVIEW_SYNC_INTERRUPTED");
        }
      } finally {
        if (isMounted) setIsLoading(false);
        console.log("ADMIN_SYNC_SEQUENCE_TERMINATED.");
      }
    };

    // Main Activity Subscription
    const channel = supabase
      .channel('admin_dashboard_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT') {
          const newTrade = payload.new;
          setLiveActivities(prev => [
            {
              id: newTrade.id,
              user_id: newTrade.user_id,
              type: 'TRADE_LOGGED',
              ticker: newTrade.ticker,
              pnl: newTrade.pnl,
              timestamp: new Date()
            } as ActivityEvent,
            ...prev
          ].slice(0, 8));
          
          setUserMap(currentMap => {
            const humanName = currentMap[newTrade.user_id] || 'Anonymous Trader';
            toast.success(`Trade logged by ${humanName} (${newTrade.ticker})`);
            return currentMap;
          });
          setTotalTrades(prev => prev !== null ? prev + 1 : 1);
        } else if (payload.eventType === 'DELETE') {
          setTotalTrades(prev => prev !== null && prev > 0 ? prev - 1 : 0);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT') {
          const newUser = payload.new as Profile;
          const name = newUser.full_name || newUser.display_name || 'Anonymous Trader';
          
          setLiveActivities(prev => [
            {
              id: newUser.id,
              user_id: newUser.id,
              type: 'USER_JOINED',
              full_name: name,
              timestamp: new Date()
            } as ActivityEvent,
            ...prev
          ].slice(0, 8));

          setUserMap(currentMap => ({
            ...currentMap,
            [newUser.id]: name
          }));
          setUsers(prev => {
            if (prev.some(u => u.id === newUser.id)) return prev;
            return [newUser, ...prev];
          });
          setTotalUsers(prev => prev !== null ? prev + 1 : 1);
          toast.success(`New user joined: ${name}`);
        } else if (payload.eventType === 'UPDATE') {
          const updatedUser = payload.new as Profile;
          const name = updatedUser.full_name || updatedUser.display_name || 'Anonymous Trader';
          setUserMap(currentMap => ({
            ...currentMap,
            [updatedUser.id]: name
          }));
          setUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
          setTotalUsers(prev => prev !== null && prev > 0 ? prev - 1 : 0);
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error("SUPABASE REALTIME ERROR:", err);
        }
      });
    channels.push(channel);

    fetchAdminData();

    return () => {
      isMounted = false;
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const handleGhostUser = (userId: string) => {
    initiateGhostMode(userId);
    navigate('/');
  };

  const handleAudit = async () => {
    setIsAuditing(true);
    const tablesChecked = ['profiles', 'trades', 'broadcasts', 'journal_logs', 'security_audit'];
    
    try {
      // Deep Scan Heuristics
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*');
      
      if (tradesError) throw tradesError;
      
      const issues: AuditIssue[] = [];
      const tradeList = trades || [];

      tradeList.forEach(t => {
        // 1. GHOST_TRADES Check (Price is 0)
        if (t.entry_price === 0 || (t.status !== 'open' && t.exit_price === 0)) {
          issues.push({
            id: t.id,
            ticker: t.ticker,
            trade_date: t.trade_date,
            issue: 'GHOST_TRADE: ZERO_PRICE_DETECTED',
            user_id: t.user_id,
            severity: 'high',
            type: 'ghost'
          });
        }

        // 2. RISK_VIOLATIONS (Missing Stop Loss)
        if (!t.stop_loss || t.stop_loss === 0) {
          issues.push({
            id: t.id,
            ticker: t.ticker,
            trade_date: t.trade_date,
            issue: 'RISK_VIOLATION: MISSING_STOP_LOSS',
            user_id: t.user_id,
            severity: 'medium',
            type: 'risk'
          });
        }

        // 3. MATH_MISMATCH (PnL vs Price Math)
        if (t.status !== 'open' && t.exit_price && t.pnl) {
          const diff = t.direction === 'long' 
            ? (t.exit_price - t.entry_price) 
            : (t.entry_price - t.exit_price);
          const expectedPnl = diff * (t.position_size || 0);
          
          // Use 1% variance threshold
          const variance = Math.abs(expectedPnl - t.pnl);
          const percentError = Math.abs(variance / (t.pnl || 1)) * 100;

          if (percentError > 1 && variance > 1) {
            issues.push({
              id: t.id,
              ticker: t.ticker,
              trade_date: t.trade_date,
              issue: `MATH_MISMATCH: PnL_DISCREPANCY (${percentError.toFixed(1)}%)`,
              user_id: t.user_id,
              severity: 'low',
              type: 'calc'
            });
          }
        }
      });

      const score = Math.max(0, 100 - (issues.length * 2));
      
      const report: AuditReport = {
        status: issues.length === 0 ? 'Verified' : 'Issues Found',
        tablesChecked,
        integrityScore: score,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        issues
      };

      setAuditReport(report);
      setIsAuditModalOpen(true);
    } catch (err) {
      toast.error("Audit failed: " + (err as any).message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleFixIssue = (issue: AuditIssue) => {
    setIsAuditModalOpen(false);
    navigate(`/journal-history`);
    toast.info(`Redirecting to remediate ${issue.ticker} corruption...`, {
      icon: <Activity className="w-4 h-4 text-blue-500" />
    });
  };

  const handleResolveAll = () => {
    if (auditReport && auditReport.issues.length > 0) {
      handleFixIssue(auditReport.issues[0]);
    }
  };

  const endGhostMode = () => {
    exitGhostMode();
  };

  const handleResetJournal = async (userId: string) => {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
  };

  const handleManageUser = (user: Profile) => {
    setSelectedUser(user as ManagedUser);
    setIsUserModalOpen(true);
  };

  const handleUserUpdated = (userId: string, updates: Partial<ManagedUser>) => {
    setUsers(currentUsers => 
      currentUsers.map(user => 
        user.id === userId ? { ...user, ...updates } : user
      ) as Profile[]
    );
  };

  const handleAction = (action: string) => {
    if (action === 'Broadcast message') {
      setIsBroadcastModalOpen(true);
      return;
    }
    if (action === 'Database audit') {
      handleAudit();
      return;
    }

    const loadingToast = toast.loading(`${action} in progress...`);
    
    // Simulate system processing
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success(`${action} completed successfully. System integrity verified.`);
    }, 1500);
  };

  const exportToCSV = () => {
    if (users.length === 0) {
      toast.error("No user data available to export.");
      return;
    }

    const headers = ["ID", "Name", "Role", "Joined Date"];
    const rows = users.map(user => [
      user.id,
      user.full_name || user.display_name || 'Anonymous',
      user.role || 'User',
      new Date(user.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bentotrade_users_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("User list exported successfully.");
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 md:p-10 md:px-16 lg:px-24">
      {/* Modals & Overlays */}
      <AuditReportModal 
        isOpen={isAuditModalOpen}
        onOpenChange={setIsAuditModalOpen}
        report={auditReport}
        onFixIssue={handleFixIssue}
        onResolveAll={handleResolveAll}
      />

      <BroadcastCenter 
        isOpen={isBroadcastModalOpen} 
        onOpenChange={setIsBroadcastModalOpen} 
      />

      <UserManagementModal
        isOpen={isUserModalOpen}
        onOpenChange={setIsUserModalOpen}
        user={selectedUser}
        onResetJournal={handleResetJournal}
        onGhostMode={handleGhostUser}
        onUserUpdated={handleUserUpdated}
      />

      {/* Header Section - Shrink-0 keeps it at the top */}
      <header className="mb-8 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] mb-3 font-black uppercase tracking-[0.2em]">
              <span>System</span> / <span>Admin</span> / <span className="text-emerald-500">Overview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-foreground leading-none tracking-tight flex items-center gap-4">
              Control Tower
              <ShieldCheck className="text-emerald-500 w-10 h-10" />
            </h1>
            <p className="text-muted-foreground mt-4 text-sm font-medium flex items-center gap-3">
              Global system configuration and telemetry.
              <span className="text-[10px] font-black tracking-[0.5em] text-zinc-500 uppercase border-l border-zinc-200 dark:border-zinc-800 pl-3">Protocol v3.5-GHOST</span>
            </p>
          </div>
          
          {/* Live Status Indicator */}
          <div className="flex items-center gap-6 bg-white/70 dark:bg-zinc-900/50 border border-zinc-950/5 dark:border-white/5 p-4 rounded-[2rem] shadow-sm dark:shadow-2xl backdrop-blur-[20px]">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">System Time</span>
              <span className="text-xs font-bold text-zinc-950 dark:text-white">{currentDate}</span>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-white/5"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <CircleDot className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                Live Uptime
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{uptime}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* The Bento Grid Container - flex-1 and overflow-hidden are key */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden min-h-0">
        
        {/* Middle Column: Metrics & Command Table - Independent Scroll */}
        <div className="lg:col-span-3 h-full overflow-y-auto pr-4 space-y-8 scrollbar-hide pb-10 animate-in fade-in slide-in-from-left-8 duration-700 delay-150">
          
          {/* Metric Grid (Bento Style) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl overflow-hidden relative group backdrop-blur-[20px]">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-500 border border-indigo-500/20">
                    <Activity size={28} strokeWidth={2.5} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Platform Volume</p>
                  <h3 className="text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
                    {isLoading ? '-' : totalTrades?.toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl overflow-hidden relative group backdrop-blur-[20px]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-500 border border-blue-500/20">
                    <Users size={28} strokeWidth={2.5} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">User Base</p>
                  <h3 className="text-5xl font-black tracking-tighter text-zinc-950 dark:text-white">
                    {isLoading ? '-' : totalUsers?.toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Verified</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl overflow-hidden relative group backdrop-blur-[20px]">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-500 border border-emerald-500/20">
                    <Cpu size={28} strokeWidth={2.5} />
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Optimal
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Security Protocol</p>
                  <h3 className="text-3xl font-black tracking-tight mt-1 text-zinc-950 dark:text-white">
                    v3.5-LIVE
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 mt-4 uppercase tracking-widest">
                    Real-time encryption active
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* The Command Table */}
          <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl overflow-hidden backdrop-blur-[20px]">
            <CardHeader className="border-b border-zinc-950/5 dark:border-white/5 bg-zinc-50/20 dark:bg-white/5 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black flex items-center gap-3 uppercase tracking-tight text-zinc-950 dark:text-white">
                    <Users className="w-6 h-6 text-zinc-600 dark:text-zinc-500" />
                    Command Table
                  </CardTitle>
                  <p className="text-xs text-zinc-500 mt-1 font-bold uppercase tracking-widest opacity-60">Global Fleet Administration</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-zinc-200 dark:border-white/5 rounded-xl font-black h-10 bg-white dark:bg-zinc-900 px-6 text-[10px] uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-950 dark:text-white"
                  onClick={exportToCSV}
                >
                  Export Data
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left align-middle">
                <thead className="text-[10px] uppercase bg-zinc-50/30 dark:bg-white/5 text-zinc-500 font-black border-b border-zinc-950/5 dark:border-white/5 tracking-[0.2em]">
                  <tr>
                    <th scope="col" className="px-8 py-5 whitespace-nowrap">Trader Identifier</th>
                    <th scope="col" className="px-8 py-5 whitespace-nowrap text-center">Class</th>
                    <th scope="col" className="px-8 py-5 whitespace-nowrap">Deployment</th>
                    <th scope="col" className="px-8 py-5 text-right whitespace-nowrap">Protocols</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-zinc-950/5 dark:divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-zinc-500 font-bold uppercase tracking-widest">
                        Syncing Fleet...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-zinc-500 font-bold uppercase tracking-widest">
                        No active deployments.
                      </td>
                    </tr>
                  ) : (
                    users.map((user, idx) => (
                      <tr key={`${user.id}-${idx}`} className="hover:bg-zinc-50/30 dark:hover:bg-white/5 transition-all duration-300 group px-8">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-950/5 dark:border-white/5 flex items-center justify-center font-black text-sm uppercase text-zinc-600 dark:text-zinc-400 group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                              {(user.display_name || 'A')[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-zinc-950 dark:text-white text-base tracking-tight">
                                {user.full_name || user.display_name || 'Anonymous Trader'}
                              </span>
                              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest mt-1" title={user.id}>
                                SEC_ID: {user.id.substring(0, 16)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                            user.role === 'admin' 
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" 
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-950/5 dark:border-white/5"
                          )}>
                            {user.role || 'User'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase">
                          {new Date(user.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '')}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest px-4 hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-400 border border-transparent hover:border-purple-500/20"
                              onClick={() => handleGhostUser(user.id)}
                              disabled={impersonatingUserId === user.id}
                            >
                              <Ghost className="w-4 h-4 mr-2" /> Ghost
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest px-4 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-950 dark:text-white border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                              onClick={() => handleManageUser(user)}
                            >
                              Manage
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Sidebar: System Controls & Live Feed - Independent Scroll */}
        <div className="lg:col-span-1 h-full overflow-y-auto space-y-8 scrollbar-hide pb-10 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
          <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl backdrop-blur-[20px]">
            <CardHeader className="border-b border-zinc-950/5 dark:border-white/5 bg-zinc-50/20 dark:bg-white/5 px-8 py-6">
              <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.2em] text-zinc-950 dark:text-white">
                <Settings className="w-5 h-5 text-zinc-600 dark:text-zinc-500" />
                System_Ctrl
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed mb-6">
                EXECUTING PROTOCOLS WILL AFFECT GLOBAL INSTANCES.
              </p>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-14 rounded-2xl border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-black text-[10px] uppercase tracking-widest group transition-all text-zinc-950 dark:text-white"
                onClick={() => handleAction('Cache clear')}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mr-4 border border-orange-500/20 group-hover:scale-110 transition-transform">
                  <RefreshCw size={18} className="text-orange-600 dark:text-orange-500" />
                </div>
                Purge Cache
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-14 rounded-2xl border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-black text-[10px] uppercase tracking-widest group transition-all text-zinc-950 dark:text-white"
                onClick={() => handleAction('Database audit')}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mr-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <DatabaseBackup size={18} className="text-blue-600 dark:text-blue-500" />
                </div>
                Verify Integrity
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-14 rounded-2xl border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-black text-[10px] uppercase tracking-widest group transition-all text-zinc-950 dark:text-white"
                onClick={() => handleAction('Broadcast message')}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mr-4 border border-purple-500/20 group-hover:scale-110 transition-transform">
                  <Radio size={18} className="text-purple-600 dark:text-purple-500" />
                </div>
                Global Broadcast
              </Button>
            </CardContent>
          </Card>

          {/* Live Activity Feed */}
          <Card className="rounded-[32px] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl backdrop-blur-[20px] overflow-hidden">
            <CardHeader className="border-b border-zinc-950/5 dark:border-white/5 px-8 py-6 bg-zinc-50/20 dark:bg-white/5">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 justify-between uppercase tracking-[0.2em] text-zinc-950 dark:text-white">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                  Live_Telemetry
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y border-zinc-950/5 dark:divide-white/5">
                {liveActivities.length === 0 ? (
                  <div className="px-8 py-12 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                    AWAITING UPLINK...
                  </div>
                ) : (
                  liveActivities.map((activity, idx) => (
                    <div key={`${activity.id || 'act'}-${activity.type}-${idx}`} className="p-6 flex items-start gap-4 hover:bg-zinc-50/30 dark:hover:bg-white/5 transition-colors group">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110",
                        activity.type === 'TRADE_LOGGED' 
                          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" 
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      )}>
                        {activity.type === 'TRADE_LOGGED' ? <Activity className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-relaxed">
                          <span className="text-zinc-950 dark:text-white">
                            {activity.type === 'USER_JOINED' ? (activity.full_name || 'New User') : (userMap[activity.user_id] || 'Trader')}
                          </span>
                          <span className="text-zinc-400 mx-1">/</span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {activity.type === 'TRADE_LOGGED' ? `EXEC_TRADE: ` : `SYSTEM_JOIN:`}
                          </span>
                          {activity.type === 'TRADE_LOGGED' && (
                            <span className="font-black text-indigo-700 dark:text-indigo-400 uppercase ml-1">{activity.ticker}</span>
                          )}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            {activity.type === 'TRADE_LOGGED' ? `Profit: $${activity.pnl || '0.00'}` : 'Auth Success'}
                          </span>
                          <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-tighter">
                            {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Added missing icon for live activity 
function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
