/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  Zap
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  emoji?: string;
}

const NavItem = ({ to, icon, label, isCollapsed, emoji }: NavItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-2 mx-2 rounded-xl transition-all text-sm font-medium",
        isActive 
          ? "bg-primary text-primary-foreground shadow-sm font-bold" 
          : "text-zinc-500 dark:text-muted-foreground hover:bg-zinc-100 dark:hover:bg-muted hover:text-zinc-950 dark:hover:text-foreground"
      )
    }
  >
    <div className="flex items-center justify-center w-5 h-5 shrink-0 opacity-80">
      {emoji ? <span className="text-base">{emoji}</span> : icon}
    </div>
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  console.log('Current Theme:', theme);
  
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const userInitial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <aside
      className={cn(
        "h-screen bg-white/80 dark:bg-card border-r border-zinc-200/50 dark:border-border flex flex-col transition-all duration-300 backdrop-blur-xl",
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
  );
};
