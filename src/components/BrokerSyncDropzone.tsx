'use client';

/**
 * BentoTrade V6.0 Broker Sync Dropzone
 * Drag-and-Drop CSV zone with format selector, sample generator, and reactive drag state.
 */

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Download, 
  RefreshCw,
  SlidersHorizontal,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  BrokerFormat, 
  SUPPORTED_BROKERS, 
  generateSampleTradovateCSV 
} from '@/lib/quant-engine/broker-parser';

interface BrokerSyncDropzoneProps {
  selectedBroker: BrokerFormat;
  onSelectBroker: (broker: BrokerFormat) => void;
  onFileLoaded: (content: string, fileName: string) => void;
  isProcessing: boolean;
  statusMessage?: string;
  loadedFileName?: string | null;
  onReset?: () => void;
}

export const BrokerSyncDropzone: React.FC<BrokerSyncDropzoneProps> = ({
  selectedBroker,
  onSelectBroker,
  onFileLoaded,
  isProcessing,
  statusMessage,
  loadedFileName,
  onReset
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentBroker = SUPPORTED_BROKERS.find(b => b.id === selectedBroker) || SUPPORTED_BROKERS[0];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please upload a valid .csv execution export file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onFileLoaded(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = generateSampleTradovateCSV();
    onFileLoaded(sample, 'tradovate_sample_executions.csv');
  };

  const handleDownloadSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    const sample = generateSampleTradovateCSV();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tradovate_sample_executions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Broker Format Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={16} className="text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider block">
              Broker Execution Format
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {currentBroker.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedBroker}
            onChange={(e) => onSelectBroker(e.target.value as BrokerFormat)}
            className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors"
          >
            {SUPPORTED_BROKERS.map((broker) => (
              <option key={broker.id} value={broker.id} className="bg-zinc-950 text-zinc-200 py-1">
                {broker.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center select-none overflow-hidden group",
          isDragging 
            ? "border-emerald-500 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.15)]" 
            : loadedFileName
              ? "border-emerald-500/50 bg-zinc-950/80"
              : "border-zinc-700 hover:border-emerald-500 bg-zinc-950/50 hover:bg-zinc-950/80"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <RefreshCw size={26} className="animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold text-zinc-200">
                {statusMessage || 'Parsing raw executions...'}
              </h3>
              <p className="text-xs font-mono text-zinc-500">
                Executing FIFO lot-matching & multiplier PnL calculation
              </p>
            </div>
          </div>
        ) : loadedFileName ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <FileCheck size={28} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-mono font-bold text-zinc-100 bg-zinc-900 px-3 py-1 rounded-md border border-zinc-800">
                  {loadedFileName}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Ready to Import
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                Drop another file or click to replace
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 group-hover:scale-105 transition-all duration-200 shadow-inner">
              <UploadCloud size={30} />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-bold font-mono text-zinc-200 tracking-tight">
                Drag and drop your <span className="text-emerald-400">{currentBroker.label}</span> here
              </h3>
              <p className="text-xs font-mono text-zinc-500">
                Supports automated FIFO matching, partial fills, commissions, and contract multipliers
              </p>
              <p className="text-[11px] font-mono text-zinc-600">
                {currentBroker.fileHint}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 group-hover:border-zinc-700">
                <FileSpreadsheet size={14} className="text-emerald-400" />
                Browse Local Files
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadSample();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-400 font-semibold transition-colors"
                title="Test with pre-configured Tradovate execution data"
              >
                <Sparkles size={13} />
                Load Sample Tradovate CSV
              </button>

              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Download sample template for reference"
              >
                <Download size={13} />
                Download Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
