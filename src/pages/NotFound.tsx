/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Terminal, ArrowLeft, ShieldAlert, Cpu } from 'lucide-react';

export const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen w-full bg-[#050505] text-zinc-100 flex flex-col justify-between p-6 sm:p-12 font-mono selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-white">
            BT
          </div>
          <div className="text-xs tracking-wider text-zinc-300 font-medium">
            BENTOTRADE <span className="text-zinc-600 font-normal">v5 QUANTITATIVE CORE</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>ROUTING EXCEPTION</span>
        </div>
      </div>

      {/* Main Terminal Box */}
      <div className="max-w-2xl w-full mx-auto my-12">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Terminal size={15} className="text-emerald-400" />
              <span>TERMINAL TELEMETRY DISPATCH</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-500/20">
              HTTP 404
            </span>
          </div>

          <div className="space-y-3">
            <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="text-emerald-400">404</span>
              <span className="text-zinc-500 font-light">//</span>
              <span className="text-zinc-200 text-xl sm:text-2xl font-medium">Page Not Found</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              The requested trading endpoint or telemetry resource cannot be resolved on this execution cluster.
            </p>
          </div>

          {/* Diagnostic Console */}
          <div className="p-4 rounded-lg bg-black/60 border border-white/[0.05] space-y-2 text-[11px] text-zinc-400">
            <div className="flex items-center justify-between text-zinc-500 text-[10px] border-b border-white/[0.04] pb-1.5">
              <span>SYSTEM TRACE DETAILS</span>
              <span>NODE: NYC-EQUINIX-NY4</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">PATH:</span>
              <span className="text-emerald-400">{location.pathname || '/unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">STATUS:</span>
              <span className="text-rose-400">ERR_ROUTE_NOT_FOUND (SOFT_404_PREVENTED)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">TIMESTAMP:</span>
              <span className="text-zinc-300">{new Date().toISOString()}</span>
            </div>
          </div>

          {/* Action Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono uppercase tracking-wider transition-all"
            >
              <ArrowLeft size={14} />
              Return to Terminal Dashboard
            </Link>
            <Link
              to="/journal"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-zinc-300 border border-white/[0.08] text-xs font-mono uppercase tracking-wider transition-all"
            >
              Open Trade Journal
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-zinc-600 border-t border-white/[0.04] pt-4 gap-2">
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-zinc-500" />
          <span>BENTOTRADE QUANTITATIVE EXECUTION DESK</span>
        </div>
        <span>ALL COMMUNICATIONS TLS ENCRYPTED</span>
      </div>
    </div>
  );
};
