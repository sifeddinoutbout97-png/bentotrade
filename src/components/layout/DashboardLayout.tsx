/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/lib/auth';
import { Ghost, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const DashboardLayout = ({ children, fullHeight }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className={cn(
          "flex-1 overflow-x-hidden",
          fullHeight ? "overflow-hidden" : "overflow-y-auto"
        )}>
          <div className={cn(
            "mx-auto w-full",
            fullHeight ? "h-full" : "max-w-[1200px] p-6 md:p-10 md:px-16 lg:px-24"
          )}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
