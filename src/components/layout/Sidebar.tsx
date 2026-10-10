/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  BarChart3, 
  Bot, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  MoreVertical,
  ClipboardList,
  ShieldCheck,
  Sun,
  Moon,
  Zap,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  icon: React.ReactNode;
  label: string;
  isCollapsed?: boolean;
  emoji?: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon, label, isCollapsed = false, emoji, onClick }: NavItemProps) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3.5 py-2.5 mx-2 rounded-xl transition-all text-sm font-medium",
        isActive 
          ? "bg-primary text-primary-foreground shadow-sm font-bold" 
          : "text-zinc-500 dark:text-muted-foreground hover:bg-zinc-100 dark:hover:bg-muted hover:text-zinc-950 dark:hover:text-foreground"
      )
    }
  >
    <div className="flex items-center justify-center w-5 h-5 shrink-0 opacity-85">
      {emoji ? <span className="text-base">{emoji}</span> : icon}
    </div>
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const userInitial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const closeMobile = () => setIsMobileOpen(false);

  // Mobile Bottom Navigation items
  const bottomNavItems = [
    { to: '/', icon: Home, label: 'Dashboard', emoji: '🏠' },
    { to: '/journal', icon: FileText, label: 'Journal', emoji: '📝' },
    { to: '/journal-history', icon: ClipboardList, label: 'History', emoji: '📋' },
    { to: '/market-pulse', icon: Zap, label: 'Pulse', emoji: '⚡' },
    { to: '/ai-insights', icon: Bot, label: 'Insights', emoji: '🤖' },
  ];

  return (
    <>
      {/* 1. MOBILE TOP HEADER BAR (Mobile screens only) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white/85 dark:bg-[#090d16]/90 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BTLogo size="sm" />
          <span className="font-black text-lg tracking-tight text-zinc-950 dark:text-white">
            BentoTrade <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 uppercase tracking-widest font-mono">v5 Pro</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Toggle theme"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="h-9 w-9 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </header>

      {/* 2. MOBILE DRAWER (Slide-over with Backdrop) */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={closeMobile}
          />

          {/* Drawer content */}
          <div className="relative w-[280px] max-w-[85vw] h-full bg-white dark:bg-[#090d16] border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <BTLogo size="sm" />
                <span className="font-black text-lg text-zinc-950 dark:text-white tracking-tight">
                  BentoTrade
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobile}
                className="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X size={18} />
              </Button>
            </div>

            <ScrollArea className="flex-1 py-3 px-2">
              <div className="space-y-1">
                <NavItem to="/" icon={<Home size={18} />} label="Dashboard" emoji="🏠" onClick={closeMobile} />
                <NavItem to="/journal" icon={<FileText size={18} />} label="Trade Journal" emoji="📝" onClick={closeMobile} />
                <NavItem to="/journal-history" icon={<ClipboardList size={18} />} label="Journal History" emoji="📋" onClick={closeMobile} />
                <NavItem to="/analytics" icon={<BarChart3 size={18} />} label="Analytics" emoji="📈" onClick={closeMobile} />
                <NavItem to="/market-pulse" icon={<Zap size={18} />} label="MarketPulse Desk" emoji="⚡" onClick={closeMobile} />
                <NavItem to="/ai-insights" icon={<Bot size={18} />} label="AI Insights" emoji="🤖" onClick={closeMobile} />
                {isAdmin && (
                  <NavItem 
                    to="/admin" 
                    icon={<ShieldCheck size={18} />} 
                    label="Control Tower" 
                    emoji="🛡️" 
                    onClick={closeMobile} 
                  />
                )}
              </div>

              <div className="mt-6 px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">System</span>
                <div className="mt-2 space-y-1">
                  <NavItem to="/settings" icon={<Settings size={18} />} label="Account & Keys" emoji="⚙️" onClick={closeMobile} />
                </div>
              </div>
            </ScrollArea>

            {/* Mobile Footer with User & Signout */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-8 w-8 border border-zinc-200 dark:border-zinc-800">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-black">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate text-xs">
                  <span className="font-bold text-zinc-950 dark:text-white truncate">
                    {user?.displayName || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-zinc-500 text-[10px] truncate">{user?.email}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  closeMobile();
                  signOut();
                }}
                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg shrink-0"
                title="Logout"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-xl border-t border-zinc-200/80 dark:border-zinc-800 px-2 flex items-center justify-around shadow-2xl">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all text-[10px] font-medium min-w-[56px]",
                isActive 
                  ? "text-emerald-500 font-bold dark:text-emerald-400" 
                  : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              )}
            >
              <span className="text-base leading-none mb-1">{item.emoji}</span>
              <span className="tracking-tight">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* 4. DESKTOP PERSISTENT SIDEBAR */}
      <aside
        className={cn(
          "hidden md:flex h-screen bg-white/80 dark:bg-card border-r border-zinc-200/50 dark:border-border flex-col transition-all duration-300 backdrop-blur-xl shrink-0",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="p-6 flex items-center justify-between font-black text-zinc-950 dark:text-foreground">
          <div className="flex items-center gap-3 overflow-hidden">
            <BTLogo size="sm" />
            {!isCollapsed && <span className="truncate tracking-tighter text-xl">BentoTrade</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 text-zinc-400 dark:text-muted-foreground hover:bg-zinc-100 dark:hover:bg-muted rounded-lg"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        <ScrollArea className="flex-1 mt-4 px-2">
          <div className="space-y-1">
            <NavItem to="/" icon={<Home size={18} />} label="Dashboard" emoji="🏠" isCollapsed={isCollapsed} />
            <NavItem to="/journal" icon={<FileText size={18} />} label="Trade Journal" emoji="📝" isCollapsed={isCollapsed} />
            <NavItem to="/journal-history" icon={<ClipboardList size={18} />} label="Journal History" emoji="📋" isCollapsed={isCollapsed} />
            <NavItem to="/analytics" icon={<BarChart3 size={18} />} label="Analytics" emoji="📈" isCollapsed={isCollapsed} />
            <NavItem to="/market-pulse" icon={<Zap size={18} />} label="MarketPulse" emoji="⚡" isCollapsed={isCollapsed} />
            <NavItem to="/ai-insights" icon={<Bot size={18} />} label="AI Insights" emoji="🤖" isCollapsed={isCollapsed} />
            {isAdmin && (
              <NavItem 
                to="/admin" 
                icon={<ShieldCheck size={18} />} 
                label="Control Tower" 
                emoji="🛡️" 
                isCollapsed={isCollapsed} 
              />
            )}
          </div>

          <div className="mt-10 px-4 py-2">
            {!isCollapsed && <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">System</span>}
            <div className="mt-3 space-y-1">
              <NavItem to="/settings" icon={<Settings size={18} />} label="Account" emoji="⚙️" isCollapsed={isCollapsed} />
            </div>
          </div>
        </ScrollArea>

        <div className="mt-auto p-4 border-t border-zinc-200/50 dark:border-border flex flex-col gap-4">
          <div className={cn("flex justify-center", !isCollapsed && "px-2")}>
            <button
              onClick={toggleTheme}
              className="p-2 relative z-50 rounded-xl hover:bg-zinc-100 dark:hover:bg-muted transition-all active:scale-95 flex items-center justify-center w-full group"
              title="Toggle Theme"
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-zinc-600 dark:text-slate-400" />
              ) : (
                <Moon className="h-5 w-5 text-zinc-600 dark:text-slate-400" />
              )}
              {!isCollapsed && <span className="ml-3 text-sm font-bold text-zinc-500 group-hover:text-zinc-950 dark:text-foreground">Theme</span>}
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className={cn(
                "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-muted transition-all text-left cursor-pointer group",
                isCollapsed && "justify-center px-0"
              )}>
                <Avatar className="h-8 w-8 border border-zinc-200/50 dark:border-border transition-transform group-hover:scale-105">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-black border border-primary/20">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between overflow-hidden">
                    <div className="flex flex-col text-[12px] truncate">
                      <span className="font-black text-zinc-950 dark:text-foreground truncate">{user?.displayName || user?.email?.split('@')[0]}</span>
                      <span className="text-zinc-400 dark:text-muted-foreground text-[10px] truncate leading-none">{user?.email}</span>
                    </div>
                    <MoreVertical size={14} className="text-zinc-400 dark:text-muted-foreground opacity-50 group-hover:opacity-100 shrink-0" />
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl bg-white/90 dark:bg-popover border-zinc-200/50 dark:border-border shadow-2xl p-1 backdrop-blur-xl">
              <DropdownMenuItem 
                onClick={() => signOut()}
                className="flex items-center gap-2 text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-destructive/10 cursor-pointer rounded-xl px-3 py-2 text-sm font-bold"
              >
                <LogOut size={16} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
};
