/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpenText, 
  History, 
  LineChart, 
  Activity, 
  Bot, 
  ShieldAlert, 
  LifeBuoy, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  MoreVertical,
  Sun,
  Moon,
  Menu,
  X,
  Command,
  Download,
  UploadCloud
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTrades } from '@/context/TradeContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BTLogo } from '@/components/ui/BTLogo';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  isCollapsed?: boolean;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, isCollapsed = false, onClick }: NavItemProps) => (
  <NavLink
    to={to}
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors group relative",
        isCollapsed ? "justify-center px-0 w-10 mx-auto" : "w-full",
        isActive 
          ? "bg-zinc-800/80 text-zinc-50 border-l-2 border-emerald-500 rounded-l-none" 
          : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50"
      )
    }
  >
    {({ isActive }) => (
      <>
        <Icon 
          className={cn(
            "w-4 h-4 shrink-0 transition-colors", 
            isActive ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
          )} 
          size={16} 
        />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </>
    )}
  </NavLink>
);

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { trades } = useTrades();
  const location = useLocation();
  const navigate = useNavigate();

  const handleExportCSV = () => {
    if (!trades || trades.length === 0) {
      toast.error('No trades available to export.');
      return;
    }
    const headers = ['ID', 'Date', 'Ticker', 'Direction', 'Size', 'Entry Price', 'Exit Price', 'Stop Loss', 'PnL ($)', 'Status', 'R:R'];
    const rows = trades.map((t) => [
      t.id,
      t.trade_date,
      t.ticker,
      t.direction,
      t.position_size,
      t.entry_price,
      t.exit_price || '',
      t.stop_loss || '',
      t.pnl,
      t.status,
      t.risk_reward_ratio || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bentotrade_journal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Journal exported as CSV.');
  };

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const userInitial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const closeMobile = () => setIsMobileOpen(false);

  // Mobile Bottom Navigation items with standardized monochromatic icons
  const bottomNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/journal', icon: BookOpenText, label: 'Journal' },
    { to: '/journal-history', icon: History, label: 'History' },
    { to: '/market-pulse', icon: Activity, label: 'Pulse' },
    { to: '/ai-insights', icon: Bot, label: 'Insights' },
  ];

  return (
    <>
      {/* 1. MOBILE TOP HEADER BAR (Mobile screens only) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BTLogo size="sm" />
          <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
            BentoTrade 
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-mono">
              V6 Pro
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            title="Toggle theme"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="h-8 w-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </header>

      {/* 2. MOBILE DRAWER (Slide-over with Backdrop) */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={closeMobile}
          />

          {/* Drawer content */}
          <div className="relative w-[280px] max-w-[85vw] h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-4 flex items-center justify-between border-b border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <BTLogo size="sm" />
                <span className="font-bold text-base text-white tracking-tight">
                  BentoTrade
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobile}
                className="h-8 w-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              >
                <X size={16} />
              </Button>
            </div>

            <ScrollArea className="flex-1 py-4 px-2">
              <nav className="space-y-6">
                {/* MAIN */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                    Main
                  </h3>
                  <div className="space-y-0.5">
                    <NavItem to="/" icon={LayoutDashboard} label="Dashboard" onClick={closeMobile} />
                    <NavItem to="/journal" icon={BookOpenText} label="Trade Journal" onClick={closeMobile} />
                    <NavItem to="/journal-history" icon={History} label="Journal History" onClick={closeMobile} />
                    <NavItem to="/import" icon={UploadCloud} label="Broker Sync" onClick={closeMobile} />
                  </div>
                </div>

                {/* INTELLIGENCE */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                    Intelligence
                  </h3>
                  <div className="space-y-0.5">
                    <NavItem to="/analytics" icon={LineChart} label="Analytics" onClick={closeMobile} />
                    <NavItem to="/market-pulse" icon={Activity} label="MarketPulse" onClick={closeMobile} />
                    <NavItem to="/ai-insights" icon={Bot} label="AI Insights" onClick={closeMobile} />
                  </div>
                </div>

                {/* ADMIN (Only show if staff or admin) */}
                {(isAdmin || isStaff) && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                      Admin
                    </h3>
                    <div className="space-y-0.5">
                      {isAdmin && (
                        <NavItem to="/admin" icon={ShieldAlert} label="Control Tower" onClick={closeMobile} />
                      )}
                      {isStaff && (
                        <NavItem to="/admin/support" icon={LifeBuoy} label="Support Console" onClick={closeMobile} />
                      )}
                    </div>
                  </div>
                )}

                {/* SYSTEM */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                    System
                  </h3>
                  <div className="space-y-0.5">
                    <NavItem to="/settings" icon={Settings} label="Account" onClick={closeMobile} />
                  </div>
                </div>
              </nav>
            </ScrollArea>

            {/* Mobile Footer with User Profile */}
            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-8 w-8 border border-zinc-800 shrink-0">
                  <AvatarFallback className="bg-zinc-800 text-zinc-200 text-xs font-bold font-mono">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate text-xs">
                  <span className="font-semibold text-zinc-200 truncate">
                    {user?.displayName || user?.email?.split('@')[0] || 'Trader'}
                  </span>
                  <span className="text-zinc-500 text-[10px] font-mono truncate">{user?.email}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  closeMobile();
                  signOut();
                }}
                className="h-8 w-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-md shrink-0"
                title="Sign Out"
              >
                <LogOut size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 flex items-center justify-around shadow-2xl">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors text-[10px] font-medium min-w-[56px] gap-1",
                isActive 
                  ? "text-emerald-400 font-semibold" 
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon size={16} className={isActive ? "text-emerald-400" : "text-zinc-400"} />
              <span className="tracking-tight text-[10px]">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-500 -mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* 4. DESKTOP PERSISTENT SIDEBAR */}
      <aside
        className={cn(
          "hidden md:flex h-full bg-zinc-950 border-r border-zinc-800/80 flex-col transition-all duration-300 shrink-0 select-none",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand / Logo Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BTLogo size="sm" />
            {!isCollapsed && (
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-sm tracking-tight text-zinc-100">BentoTrade</span>
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  V6 Pro
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>

        {/* Navigation Groups */}
        <ScrollArea className="flex-1 py-4 px-2">
          <nav className="space-y-6">
            {/* MAIN */}
            <div>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                  Main
                </h3>
              )}
              <div className="space-y-0.5">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} />
                <NavItem to="/journal" icon={BookOpenText} label="Trade Journal" isCollapsed={isCollapsed} />
                <NavItem to="/journal-history" icon={History} label="Journal History" isCollapsed={isCollapsed} />
                <NavItem to="/import" icon={UploadCloud} label="Broker Sync" isCollapsed={isCollapsed} />
              </div>
            </div>

            {/* INTELLIGENCE */}
            <div>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                  Intelligence
                </h3>
              )}
              <div className="space-y-0.5">
                <NavItem to="/analytics" icon={LineChart} label="Analytics" isCollapsed={isCollapsed} />
                <NavItem to="/market-pulse" icon={Activity} label="MarketPulse" isCollapsed={isCollapsed} />
                <NavItem to="/ai-insights" icon={Bot} label="AI Insights" isCollapsed={isCollapsed} />
              </div>
            </div>

            {/* ADMIN (Only show if staff or admin) */}
            {(isAdmin || isStaff) && (
              <div>
                {!isCollapsed && (
                  <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                    Admin
                  </h3>
                )}
                <div className="space-y-0.5">
                  {isAdmin && (
                    <NavItem to="/admin" icon={ShieldAlert} label="Control Tower" isCollapsed={isCollapsed} />
                  )}
                  {isStaff && (
                    <NavItem to="/admin/support" icon={LifeBuoy} label="Support Console" isCollapsed={isCollapsed} />
                  )}
                </div>
              </div>
            )}

            {/* SYSTEM */}
            <div>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3 uppercase font-mono">
                  System
                </h3>
              )}
              <div className="space-y-0.5">
                <NavItem to="/settings" icon={Settings} label="Account" isCollapsed={isCollapsed} />
              </div>
            </div>
          </nav>
        </ScrollArea>

        {/* Footer: User Profile & Controls */}
        <div className="mt-auto p-3 border-t border-zinc-800/80 bg-zinc-950 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div 
                  className={cn(
                    "flex items-center gap-2.5 w-full p-1.5 rounded-md hover:bg-zinc-800/50 transition-colors text-left cursor-pointer group",
                    isCollapsed && "justify-center p-1"
                  )}
                >
                  <Avatar className="h-7 w-7 border border-zinc-800 shrink-0">
                    <AvatarFallback className="bg-zinc-800 text-zinc-200 text-xs font-bold font-mono">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                          {user?.displayName || user?.email?.split('@')[0] || 'Trader'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 truncate leading-tight">
                          {user?.email}
                        </span>
                      </div>
                      <MoreVertical size={13} className="text-zinc-500 group-hover:text-zinc-300 shrink-0 ml-1" />
                    </div>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl bg-zinc-950 border-zinc-800 shadow-2xl p-1.5 text-zinc-200 font-mono text-xs space-y-0.5">
                <DropdownMenuItem 
                  onClick={() => navigate('/settings')}
                  className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-zinc-900 focus:bg-zinc-900"
                >
                  <Settings size={14} className="text-emerald-400" />
                  <span>Risk & Account Settings</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => window.dispatchEvent(new CustomEvent('bt_open_command_palette'))}
                  className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-zinc-900 focus:bg-zinc-900"
                >
                  <Command size={14} className="text-emerald-400" />
                  <span>Command Palette (⌘K)</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-zinc-900 focus:bg-zinc-900"
                >
                  <Download size={14} className="text-emerald-400" />
                  <span>Export Journal CSV</span>
                </DropdownMenuItem>

                <div className="my-1 border-t border-zinc-800/80" />

                <DropdownMenuItem 
                  onClick={() => signOut()}
                  className="flex items-center gap-2 text-rose-400 focus:text-rose-300 focus:bg-rose-950/30 cursor-pointer rounded-lg px-2.5 py-2 font-medium"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
};
