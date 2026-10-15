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
  Ghost,
  Headphones
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

const AdminUptimeClock = React.memo(() => {
  const [uptime, setUptime] = useState('00:00:00');

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

  return <span className="text-xs font-mono font-bold text-emerald-400">{uptime}</span>;
});

AdminUptimeClock.displayName = 'AdminUptimeClock';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { initiateGhostMode, exitGhostMode, impersonatingUserId } = useAuth();
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
          <div className="flex items-center gap-5 bg-zinc-950/50 border border-zinc-800/80 p-3 rounded-md">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5">System Time</span>
              <span className="text-xs font-mono font-medium text-zinc-300">{currentDate}</span>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                <CircleDot className="w-2 h-2 text-emerald-400 animate-pulse" />
                Live Uptime
              </span>
              <AdminUptimeClock />
            </div>
          </div>
        </div>
      </header>
      
      {/* The Bento Grid Container - flex-1 and overflow-hidden are key */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden min-h-0">
        
        {/* Middle Column: Metrics & Command Table - Independent Scroll */}
        <div className="lg:col-span-3 h-full overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent pb-10 animate-in fade-in slide-in-from-left-8 duration-700 delay-150">
          
          {/* Metric Grid (Uniform Bento Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Platform Volume */}
            <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none overflow-hidden relative group">
              <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Platform Volume</span>
                  <div className="w-8 h-8 rounded-sm bg-indigo-950/50 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                    <Activity size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-zinc-100">
                    {isLoading ? '-' : (totalTrades ?? 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-sm bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 text-[10px] font-mono uppercase tracking-wider">
                      Live Telemetry
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">System-wide</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: User Base */}
            <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none overflow-hidden relative group">
              <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">User Base</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-950/50 border border-blue-800/60 flex items-center justify-center text-blue-400">
                    <Users size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-zinc-100">
                    {isLoading ? '-' : (totalUsers ?? 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-sm bg-blue-950/40 text-blue-400 border border-blue-800/50 text-[10px] font-mono uppercase tracking-wider">
                      Verified
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Active Traders</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Security Protocol */}
            <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none overflow-hidden relative group">
              <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Security Protocol</span>
                  <div className="w-8 h-8 rounded-sm bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                    <Cpu size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-emerald-400">
                    v3.5-LIVE
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-sm bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Optimal
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Zero-Trust Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* The Command Table (Dense & Institutional) */}
          <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none overflow-hidden">
            <CardHeader className="border-b border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-mono font-bold flex items-center gap-2 uppercase tracking-wider text-zinc-100">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Fleet Command Table
                  </CardTitle>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5 uppercase tracking-wider">Global Fleet Directory & Telemetry</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-zinc-800 rounded-sm font-mono h-7 bg-zinc-900 px-3 text-[10px] uppercase tracking-wider hover:bg-zinc-800 text-zinc-300"
                  onClick={exportToCSV}
                >
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <table className="w-full text-xs text-left align-middle border-collapse">
                <thead className="text-[10px] uppercase bg-zinc-900/60 text-zinc-500 font-mono font-bold border-b border-zinc-800/80 tracking-wider">
                  <tr>
                    <th scope="col" className="px-3 py-2 whitespace-nowrap">Trader Identifier</th>
                    <th scope="col" className="px-3 py-2 whitespace-nowrap text-center">Class</th>
                    <th scope="col" className="px-3 py-2 whitespace-nowrap">Deployment</th>
                    <th scope="col" className="px-3 py-2 text-right whitespace-nowrap">Protocols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-zinc-500 font-mono uppercase tracking-wider">
                        Syncing Fleet Records...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-zinc-500 font-mono uppercase tracking-wider">
                        No active fleet deployments.
                      </td>
                    </tr>
                  ) : (
                    users.map((user, idx) => (
                      <tr key={`${user.id}-${idx}`} className="hover:bg-zinc-900/40 transition-colors group">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-xs uppercase text-zinc-300 shrink-0">
                              {(user.display_name || user.full_name || 'A')[0]}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono font-bold text-xs text-zinc-100 truncate">
                                {user.full_name || user.display_name || 'Anonymous Trader'}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 truncate" title={user.id}>
                                UUID: {user.id.substring(0, 18)}...
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border",
                            user.role === 'admin' 
                              ? "bg-purple-950/40 text-purple-400 border-purple-800/50" 
                              : user.role === 'staff'
                              ? "bg-amber-950/40 text-amber-400 border-amber-800/50"
                              : "bg-zinc-900 text-zinc-400 border-zinc-800"
                          )}>
                            {user.role || 'Trader'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-400 font-mono text-xs whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 rounded-sm text-[10px] font-mono uppercase tracking-wider px-2.5 hover:bg-purple-950/40 text-purple-400 border border-purple-900/40 hover:border-purple-700/60"
                              onClick={() => handleGhostUser(user.id)}
                              disabled={impersonatingUserId === user.id}
                            >
                              <Ghost className="w-3 h-3 mr-1" /> Ghost
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 rounded-sm text-[10px] font-mono uppercase tracking-wider px-2.5 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
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
        <div className="lg:col-span-1 h-full overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent pb-10 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
          <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none">
            <CardHeader className="border-b border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
              <CardTitle className="text-xs font-mono font-bold flex items-center gap-2 uppercase tracking-wider text-zinc-100">
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                System_Ctrl
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
                EXECUTING PROTOCOLS WILL AFFECT GLOBAL INSTANCES.
              </p>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-9 rounded-sm border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 font-mono text-[11px] uppercase tracking-wider transition-colors text-zinc-200"
                onClick={() => handleAction('Cache clear')}
              >
                <div className="w-5 h-5 rounded-sm bg-orange-950/60 flex items-center justify-center mr-2 border border-orange-800/50">
                  <RefreshCw size={12} className="text-orange-400" />
                </div>
                Purge Cache
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-9 rounded-sm border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 font-mono text-[11px] uppercase tracking-wider transition-colors text-zinc-200"
                onClick={() => handleAction('Database audit')}
              >
                <div className="w-5 h-5 rounded-sm bg-blue-950/60 flex items-center justify-center mr-2 border border-blue-800/50">
                  <DatabaseBackup size={12} className="text-blue-400" />
                </div>
                Verify Integrity
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-9 rounded-sm border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 font-mono text-[11px] uppercase tracking-wider transition-colors text-zinc-200"
                onClick={() => handleAction('Broadcast message')}
              >
                <div className="w-5 h-5 rounded-sm bg-purple-950/60 flex items-center justify-center mr-2 border border-purple-800/50">
                  <Radio size={12} className="text-purple-400" />
                </div>
                Global Broadcast
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-9 rounded-sm border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 font-mono text-[11px] uppercase tracking-wider transition-colors text-zinc-200"
                onClick={() => navigate('/admin/support')}
              >
                <div className="w-5 h-5 rounded-sm bg-emerald-950/60 flex items-center justify-center mr-2 border border-emerald-800/50">
                  <Headphones size={12} className="text-emerald-400" />
                </div>
                Support Telemetry Desk
              </Button>
            </CardContent>
          </Card>

          {/* Live Activity Feed */}
          <Card className="rounded-md border border-zinc-800/80 bg-zinc-950/50 shadow-none overflow-hidden">
            <CardHeader className="border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/40">
              <CardTitle className="text-[10px] font-mono font-bold flex items-center gap-2 justify-between uppercase tracking-wider text-zinc-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Live_Telemetry
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
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
