/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrades } from '@/context/TradeContext';
import { useTheme } from '@/components/ThemeProvider';
import { QuantMetricsGrid } from '@/components/QuantMetricsGrid';
import { InstitutionalTelemetry } from '@/components/InstitutionalTelemetry';
import { useSubscription } from '@/hooks/useSubscription';
import { TradeData } from '@/types';

export const Analytics = () => {
  const { theme } = useTheme();
  const { subState } = useSubscription();
  const { trades, loading } = useTrades();

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-muted border border-border rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl shadow-primary/10">
          📉
        </div>
        <div className="max-w-[440px] space-y-4">
          <h1 className="text-3xl font-black text-foreground tracking-tighter">No Analytics Yet</h1>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed">
            You need to log at least one trade to start seeing performance heuristics and your equity curve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 px-1 md:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
              v5.0 Quant Core
            </span>
          </div>
          <h1 className="text-3xl md:text-[44px] font-black text-foreground tracking-tighter leading-tight md:leading-none">
            Quantitative Analytics
          </h1>
          <p className="text-muted-foreground text-base md:text-lg font-medium opacity-80 leading-relaxed md:leading-normal">
            Institutional edge distribution, drawdown recovery corridors, and risk-of-ruin telemetry.
          </p>
        </div>
      </header>

      {/* Bento Quant Metrics Suite */}
      <QuantMetricsGrid trades={trades} />

      {/* Institutional Quant Telemetry Suite */}
      <InstitutionalTelemetry 
        trades={trades} 
        isPremium={subState.currentTier === 'ultra'} 
      />
    </div>
  );
};


