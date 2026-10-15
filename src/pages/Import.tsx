'use client';

/**
 * BentoTrade V6.0 Broker Data Sync & CSV Import Center
 * Dedicated import interface for automated execution logs, FIFO round-trip grouping, and ledger insertion.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  DollarSign, 
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Zap,
  Info,
  Calendar,
  Sparkles,
  Key
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { useTrades } from '@/context/TradeContext';
import { useAuth } from '@/lib/auth';
import { BrokerSyncDropzone } from '@/components/BrokerSyncDropzone';
import { LiveBrokerSync } from '@/components/LiveBrokerSync';
import { 
  BrokerFormat, 
  GroupedTradePreview, 
  ParseResult, 
  parseBrokerCSV, 
  mapPreviewToTradePayload,
  generateSampleTradovateCSV 
} from '@/lib/quant-engine/broker-parser';

export type SyncViewMode = 'direct-sync' | 'csv-import';

export const ImportPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Safe router navigation fallback
  let navigate: ((to: string) => void) | null = null;
  try {
    navigate = useNavigate();
  } catch {
    navigate = (path: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    };
  }

  // Safe auth context fallback
  let user = null;
  try {
    const auth = useAuth();
    user = auth?.user || null;
  } catch {
    user = null;
  }

  // Safe trade context fallback
  let bulkCreateTrades: ((tradesList: any[]) => Promise<any>) | null = null;
  try {
    const tradeContext = useTrades();
    bulkCreateTrades = tradeContext?.bulkCreateTrades || null;
  } catch {
    bulkCreateTrades = null;
  }

  const [viewMode, setViewMode] = useState<SyncViewMode>('direct-sync');
  const [selectedBroker, setSelectedBroker] = useState<BrokerFormat>('tradovate-ninjatrader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileLoaded = (content: string, fileName: string) => {
    setIsProcessing(true);
    setStatusMessage(`Parsing raw executions from ${fileName}...`);
    setLoadedFileName(fileName);

    // Simulate snappy parsing with immediate async dispatch
    setTimeout(() => {
      try {
        const result = parseBrokerCSV(content);
        setParseResult(result);
        setIsProcessing(false);

        if (result.success) {
          toast.success(
            `Parsed ${result.rawExecutionsCount} raw fills into ${result.groupedTrades.length} closed round-trip trades!`
          );
        } else {
          toast.error(result.errors[0] || 'Failed to detect paired executions.');
        }
      } catch (err: any) {
        setIsProcessing(false);
        console.error('CSV Parsing Error:', err);
        toast.error(`CSV Parsing error: ${err.message || 'Unknown structure'}`);
      }
    }, 250);
  };

  const handleReset = () => {
    setLoadedFileName(null);
    setParseResult(null);
    setStatusMessage('');
  };

  const handleImportToLedger = async () => {
    if (!parseResult || parseResult.groupedTrades.length === 0) {
      toast.error('No closed trades to import.');
      return;
    }

    if (!user) {
      toast.error('You must be signed in to import trades.');
      return;
    }

    if (!bulkCreateTrades) {
      toast.error('Trade ledger service is not initialized.');
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(`Importing ${parseResult.groupedTrades.length} trades to institutional ledger...`);

    try {
      // Map preview items into database payloads
      const payloads = parseResult.groupedTrades.map(preview => 
        mapPreviewToTradePayload(preview, user.id)
      );

      await bulkCreateTrades(payloads);

      toast.dismiss(toastId);
      toast.success(
        `Successfully imported ${payloads.length} trades! Populating Calendar Heatmap & Analytics...`,
        { duration: 4000 }
      );

      // Redirect immediately to /journal-history so user sees their new trades in Calendar Heatmap & Blotter
      if (navigate) {
        navigate('/journal-history');
      } else if (typeof window !== 'undefined') {
        window.location.href = '/journal-history';
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('Bulk Import Error:', err);
      toast.error(`Import failed: ${err.message || 'Database error occurred'}`);
      setIsImporting(false);
    }
  };

  const isNetPositive = (parseResult?.totalProjectedPnl ?? 0) >= 0;

  if (!mounted) {
    return (
      <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto w-full font-mono animate-pulse">
        <div className="h-32 rounded-2xl bg-zinc-950 border border-zinc-800/80" />
        <div className="h-14 rounded-2xl bg-zinc-950 border border-zinc-800/80" />
        <div className="h-96 rounded-2xl bg-zinc-950 border border-zinc-800/80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto w-full font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              V6.0 Automated Ingestion
            </span>
            <span className="text-zinc-500 text-xs">•</span>
            <span className="text-zinc-400 text-xs">Broker Data Sync</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
            Broker Execution Blotter Sync
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-1">
            Drag and drop raw execution logs from your prop firm or broker. Our quant engine pairs Buy and Sell orders into round-trip trades with exact contract point multipliers.
          </p>
        </div>

        {parseResult && parseResult.groupedTrades.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
            >
              <RotateCcw size={14} />
              Reset Parser
            </button>

            <button
              onClick={handleImportToLedger}
              disabled={isImporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-[0_0_25px_rgba(16,185,129,0.45)] transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <CheckCircle2 size={16} className="stroke-[2.5]" />
              <span>{isImporting ? 'Importing to Ledger...' : `Import ${parseResult.groupedTrades.length} Trades to Ledger`}</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>

      {/* View Switcher Segmented Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-2 rounded-2xl bg-zinc-950 border border-zinc-800/80">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('direct-sync')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all",
              viewMode === 'direct-sync'
                ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Key size={14} className={viewMode === 'direct-sync' ? "text-emerald-400" : "text-zinc-500"} />
            <span>[🔑 Direct Prop Firm Sync]</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider",
              viewMode === 'direct-sync' 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
            )}>
              Active
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('csv-import')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all",
              viewMode === 'csv-import'
                ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <FileSpreadsheet size={14} className={viewMode === 'csv-import' ? "text-emerald-400" : "text-zinc-500"} />
            <span>[📄 CSV File Import]</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider",
              viewMode === 'csv-import' 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
            )}>
              Fallback
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500 px-3">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Zero-Knowledge Secure Enclave Enabled</span>
        </div>
      </div>

      {/* Direct Prop Firm Sync (Active View) */}
      {viewMode === 'direct-sync' && (
        <LiveBrokerSync />
      )}

      {/* CSV File Import (Fallback View) */}
      {viewMode === 'csv-import' && (
        <div className="space-y-6">
          <BrokerSyncDropzone
            selectedBroker={selectedBroker}
            onSelectBroker={setSelectedBroker}
            onFileLoaded={handleFileLoaded}
            isProcessing={isProcessing}
            statusMessage={statusMessage}
            loadedFileName={loadedFileName}
            onReset={handleReset}
          />

      {/* Parsing Summary & Analytics Preview */}
      {parseResult && parseResult.groupedTrades.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Closed Trades */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Closed Trades
              </span>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">
                {parseResult.groupedTrades.length}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                from {parseResult.rawExecutionsCount} raw fills
              </span>
            </div>

            {/* 2. Projected Net PnL */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Projected Net PnL
              </span>
              <div className={cn(
                "text-xl sm:text-2xl font-extrabold tracking-tight",
                isNetPositive ? "text-emerald-400" : "text-rose-500"
              )}>
                {isNetPositive ? '+' : ''}${parseResult.totalProjectedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                after fees & commissions
              </span>
            </div>

            {/* 3. Win Rate */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Win Rate
              </span>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">
                {parseResult.winRate}%
              </div>
              <span className="text-[10px] text-zinc-500 block">
                {parseResult.winCount}W / {parseResult.lossCount}L
              </span>
            </div>

            {/* 4. Gross Profit */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Gross Profit
              </span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                +${parseResult.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                winning trades
              </span>
            </div>

            {/* 5. Gross Loss */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Gross Loss
              </span>
              <div className="text-xl sm:text-2xl font-bold text-rose-500">
                -${parseResult.grossLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                losing trades
              </span>
            </div>

            {/* 6. Open Lots Alert */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Unpaired Fills
              </span>
              <div className={cn(
                "text-xl sm:text-2xl font-bold",
                parseResult.openPositionsCount > 0 ? "text-amber-400" : "text-zinc-400"
              )}>
                {parseResult.openPositionsCount}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                {parseResult.openPositionsCount > 0 ? 'Open contracts remaining' : '100% paired FIFO'}
              </span>
            </div>
          </div>

          {/* Grouped Trades Blotter Preview Table */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                  Ingestion Preview Blotter ({parseResult.groupedTrades.length} Trades)
                </span>
              </div>

              <div className="text-xs text-zinc-400">
                Projected PnL: <span className={cn("font-bold", isNetPositive ? "text-emerald-400" : "text-rose-400")}>
                  {isNetPositive ? '+' : ''}${parseResult.totalProjectedPnl.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500 tracking-wider bg-zinc-950">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Date / Window</th>
                    <th className="px-4 py-3">Instrument</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3 text-right">Size</th>
                    <th className="px-4 py-3 text-right">Entry Price</th>
                    <th className="px-4 py-3 text-right">Exit Price</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">Multiplier</th>
                    <th className="px-4 py-3 text-right">Fees</th>
                    <th className="px-4 py-3 text-right">Net PnL</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {parseResult.groupedTrades.map((trade, idx) => {
                    const isWin = trade.status === 'win';
                    const isLoss = trade.status === 'loss';
                    return (
                      <tr 
                        key={trade.id}
                        className="hover:bg-zinc-900/50 transition-colors duration-150"
                      >
                        <td className="px-4 py-3 text-zinc-500 text-[11px]">
                          #{idx + 1}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-200">{trade.tradeDate}</span>
                            <span className="text-[10px] text-zinc-500">{trade.entryTime} → {trade.exitTime}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-100">{trade.ticker}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                              {trade.marketType}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                            trade.direction === 'long' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          )}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-zinc-200">
                          {trade.positionSize}
                        </td>

                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                          {trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                          {trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3 text-right font-mono">
                          <span className={cn(
                            trade.pointsGained > 0 ? "text-emerald-400" : trade.pointsGained < 0 ? "text-rose-400" : "text-zinc-500"
                          )}>
                            {trade.pointsGained > 0 ? '+' : ''}{trade.pointsGained.toFixed(2)} pts
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right text-zinc-500 text-[11px]">
                          ${trade.multiplier}/pt
                        </td>

                        <td className="px-4 py-3 text-right text-zinc-500 text-[11px]">
                          ${trade.fees.toFixed(2)}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={cn(
                            isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-zinc-400"
                          )}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                            isWin ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            isLoss ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            "bg-zinc-800 text-zinc-400"
                          )}>
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Ingestion Action Footer */}
            <div className="p-4 sm:p-6 bg-zinc-900/60 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>
                  All trades will be stored with institutional tags (<code className="text-emerald-400">#Broker_Sync</code>) and immediately reflected across your Calendar Heatmap.
                </span>
              </div>

              <button
                onClick={handleImportToLedger}
                disabled={isImporting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-sm shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all transform active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 size={18} className="stroke-[3]" />
                <span>{isImporting ? 'Syncing to Ledger...' : `[ Import ${parseResult.groupedTrades.length} Trades to Ledger ]`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Helper Documentation Card */}
      {!parseResult && (
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <Info size={16} className="text-emerald-400" />
            <span>How Broker Data Sync Works</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400 leading-relaxed font-sans">
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
              <span className="font-mono font-bold text-emerald-400 uppercase text-[11px] block">
                1. Export from Broker
              </span>
              <p>
                In Tradovate, NinjaTrader, or your trading platform, export your fills or execution blotter as a CSV file for any day, week, or date range.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
              <span className="font-mono font-bold text-emerald-400 uppercase text-[11px] block">
                2. Automated FIFO Lot Matching
              </span>
              <p>
                Our quant algorithm chronologically pairs entries and exits on the exact same symbol (handling scale-ins, partial exits, and contract tick multipliers).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
              <span className="font-mono font-bold text-emerald-400 uppercase text-[11px] block">
                3. One-Click Ledger Injection
              </span>
              <p>
                Review projected net PnL, points gained, and commissions. Click "Import to Ledger" to populate your Calendar Heatmap, analytics, and journal blotter.
              </p>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};

export default ImportPage;
