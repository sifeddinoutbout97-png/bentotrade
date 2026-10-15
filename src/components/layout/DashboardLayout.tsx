/**
 * BentoTrade v6.0 Authenticated Layout
 * Features TopTelemetryBar HUD, Sidebar navigation, BentoCommandPalette modal, and fluid max-w-[1600px] widescreen containers.
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { TopTelemetryBar } from './TopTelemetryBar';
import { BentoCommandPalette } from '@/components/BentoCommandPalette';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, fullHeight }) => {
  const handleOpenCommandPalette = () => {
    window.dispatchEvent(new CustomEvent('bt_open_command_palette'));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative pt-14 md:pt-0">
        <TopTelemetryBar onOpenCommandPalette={handleOpenCommandPalette} />
        <main className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain",
          fullHeight ? "overflow-hidden" : ""
        )}>
          <div className={cn(
            "mx-auto w-full",
            fullHeight ? "h-full" : "max-w-[1600px] px-6 py-6 pb-24 md:pb-10"
          )}>
            {children}
          </div>
        </main>
      </div>
      <BentoCommandPalette />
    </div>
  );
};
