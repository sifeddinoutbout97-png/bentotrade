/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTrades } from '@/context/TradeContext';
import { QuantMetricsGrid } from '@/components/QuantMetricsGrid';
import { InstitutionalTelemetry } from '@/components/InstitutionalTelemetry';
import { useSubscription } from '@/hooks/useSubscription';

export const Analytics = () => {
  const { subState } = useSubscription();
  const { trades, loading } = useTrades();

  if (loading) {
    return (
      <div className="bg-[#050505] min-h-[60vh] flex items-center justify-center -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8">
        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-[#050505] min-h-[70vh] flex flex-col items-center justify-center text-center p-8 -m-4 sm:-m-6 md:-m-8 rounded-none md:rounded-3xl border-0 md:border md:border-white/[0.03]">
        <div className="max-w-[400px] space-y-3">
          <p className="text-xs font-medium tracking-widest text-zinc-600 uppercase font-mono">Telemetry Status</p>
          <h2 className="text-xl font-bold font-mono text-zinc-200">No Analytics Recorded</h2>
          <p className="text-zinc-500 text-xs font-mono leading-relaxed">
            Execute and log trades in the journal to activate quantitative performance heuristics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden bg-[#050505] text-zinc-100 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 min-h-full rounded-none md:rounded-3xl border-0 md:border md:border-white/[0.03] animate-in fade-in duration-500 space-y-5 lg:space-y-6">
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



