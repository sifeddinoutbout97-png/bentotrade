/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Type, 
  DollarSign, 
  Calendar as CalendarIcon, 
  ArrowRightLeft, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Save,
  Plus,
  Shield,
  Activity,
  ScrollText,
  Coins,
  Globe,
  Loader2,
  Image as ImageIcon,
  Upload,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { createTrade } from '@/lib/trades';
import { useTrades } from '@/context/TradeContext';
import { Trade } from '@/types';
import { getMarketTypeFromTicker } from '@/lib/utils';

const ASSET_CONFIG: Record<string, { multiplier: number; name: string; type: 'futures' | 'cfds'; roundTripFee: number }> = {
  // Futures
  'NQ': { multiplier: 20, name: 'Nasdaq E-mini', type: 'futures', roundTripFee: 4.10 },
  'MNQ': { multiplier: 2, name: 'Micro Nasdaq', type: 'futures', roundTripFee: 1.20 },
  'ES': { multiplier: 50, name: 'S&P 500 E-mini', type: 'futures', roundTripFee: 4.10 },
  'MES': { multiplier: 5, name: 'Micro S&P', type: 'futures', roundTripFee: 1.20 },
  'GC': { multiplier: 100, name: 'Gold', type: 'futures', roundTripFee: 4.10 },
  'CL': { multiplier: 1000, name: 'Crude Oil', type: 'futures', roundTripFee: 4.10 },
  'RTY': { multiplier: 50, name: 'Russell 2000', type: 'futures', roundTripFee: 4.10 },
  'M2K': { multiplier: 5, name: 'Micro Russell', type: 'futures', roundTripFee: 1.20 },
  'YM': { multiplier: 5, name: 'Dow E-mini', type: 'futures', roundTripFee: 4.10 },
  'MYM': { multiplier: 0.5, name: 'Micro Dow', type: 'futures', roundTripFee: 1.20 },
  
  // CFDs / Forex
  'XAUUSD': { multiplier: 100, name: 'Gold Spot', type: 'cfds', roundTripFee: 0 },
  'EURUSD': { multiplier: 100000, name: 'EUR/USD', type: 'cfds', roundTripFee: 0 },
  'GBPUSD': { multiplier: 100000, name: 'GBP/USD', type: 'cfds', roundTripFee: 0 },
  'US30': { multiplier: 1, name: 'Dow 30 CFD', type: 'cfds', roundTripFee: 0 },
  'NAS100': { multiplier: 1, name: 'Nasdaq 100 CFD', type: 'cfds', roundTripFee: 0 },
};

/**
 * Calculates Profit and Loss for a trade based on position size and contract multipliers.
 * Formula: PnL = (Exit - Entry) * Multiplier * Quantity
 */
export const calculateTradePnL = (
  entry: number,
  exit: number,
  quantity: number,
  multiplier: number,
  direction: 'long' | 'short',
  fees: number = 0
) => {
  const diff = direction === 'long' ? exit - entry : entry - exit;
  return (diff * multiplier * quantity) - fees;
};

const tradeSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required'),
  entry_price: z.coerce.number().positive('Must be positive'),
  exit_price: z.coerce.number().optional().default(0),
  stop_loss: z.coerce.number().optional().default(0),
  trade_date: z.string().min(1, 'Date is required'),
  position_size: z.coerce.number().positive('Must be positive'),
  size_type: z.enum(['lots', 'contracts']).default('contracts'),
  direction: z.enum(['long', 'short']),
  status: z.enum(['win', 'loss', 'breakeven', 'open']),
  pnl: z.coerce.number().default(0),
  fees: z.coerce.number().default(0),
  notes: z.string().optional(),
  image_urls: z.array(z.string()).optional(),
});

type TradeFormValues = z.infer<typeof tradeSchema>;

const PropertyItem = ({ 
  label, 
  icon: Icon, 
  children, 
  className 
}: { 
  label: string; 
  icon: any; 
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:items-center border-b border-zinc-200/50 dark:border-border group", className)}>
    <div className="flex items-center gap-2 px-4 py-3 sm:py-2 text-zinc-500 dark:text-muted-foreground text-[12px] sm:text-[13px] font-medium transition-colors group-hover:bg-zinc-50 dark:group-hover:bg-muted/50 bg-zinc-50/10 dark:bg-muted/10 sm:bg-transparent">
      <Icon size={14} className="opacity-60" />
      {label}
    </div>
    <div className="px-4 py-3 sm:py-1.5 focus-within:bg-zinc-50 dark:focus-within:bg-muted/30 transition-colors">
      {children}
    </div>
  </div>
);

export const Journal = () => {
  const [marketType, setMarketType] = useState<'futures' | 'cfds'>('futures');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header & Market Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
            <span>Terminal</span> / <span>Trades</span> / <span className="text-emerald-500">Execution Logger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-zinc-100">
            Trade Journal
          </h1>
        </div>

        {/* Market Toggle Switch */}
        <div className="p-1 bg-zinc-900/80 rounded-md w-fit flex items-center gap-1 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setMarketType('futures')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-medium transition-colors",
              marketType === 'futures' 
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60" 
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <ScrollText size={13} className={marketType === 'futures' ? "text-emerald-400" : "opacity-40"} />
            Futures (E-mini/Micro)
          </button>
          <button
            type="button"
            onClick={() => setMarketType('cfds')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-medium transition-colors",
              marketType === 'cfds' 
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60" 
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Globe size={13} className={marketType === 'cfds' ? "text-emerald-400" : "opacity-40"} />
            CFDs / Forex
          </button>
        </div>
      </div>

      <TradeForm key={marketType} marketType={marketType} />
    </div>
  );
};

const TradeForm = ({ marketType }: { marketType: 'futures' | 'cfds' }) => {
  const { createTrade: contextCreateTrade } = useTrades();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema) as any,
    defaultValues: {
      ticker: '',
      entry_price: 0,
      exit_price: 0,
      stop_loss: 0,
      position_size: 1,
      size_type: 'contracts',
      direction: 'long',
      status: 'open',
      trade_date: new Date().toISOString().split('T')[0],
      pnl: 0,
      fees: 0,
      notes: '',
    },
  });

  // Watch market type changes to reset ticker and fees
  React.useEffect(() => {
    form.setValue('ticker', '');
    form.setValue('fees', 0);
    // Set sensible default size type based on market
    form.setValue('size_type', marketType === 'futures' ? 'contracts' : 'lots');
  } , [marketType, form]);

  const ticker = form.watch('ticker')?.toUpperCase();
  const entry = form.watch('entry_price');
  const exit = form.watch('exit_price');
  const stop = form.watch('stop_loss');
  const size = form.watch('position_size');
  const sizeType = form.watch('size_type');
  const direction = form.watch('direction');
  const fees = form.watch('fees');

  // Multiplier logic
  const assetInfo = ticker ? ASSET_CONFIG[ticker] : null;
  const multiplier = assetInfo ? assetInfo.multiplier : 1;
  
  const calculatedPnL = calculateTradePnL(
    entry,
    exit || 0,
    size,
    multiplier,
    direction,
    fees
  );

  const riskPoints = direction === 'long' ? entry - stop : stop - entry;
  const rewardPoints = direction === 'long' ? exit - entry : entry - exit;
  
  const calculatedRisk = Math.abs(riskPoints * size * multiplier);
  const rrRatio = (stop && stop !== 0 && riskPoints !== 0) 
    ? (rewardPoints / riskPoints).toFixed(2) 
    : '0.00';

  // Smart Defaults for Size Type
  React.useEffect(() => {
    if (!ticker) return;
    const t = ticker.toUpperCase();
    if (['XAUUSD', 'EURUSD', 'GBPUSD'].includes(t)) {
      form.setValue('size_type', 'lots');
    } else if (['NQ', 'MNQ', 'ES', 'MES', 'GC', 'CL', 'RTY', 'M2K', 'YM', 'MYM', 'DAX', 'NAS100', 'US30'].includes(t)) {
      form.setValue('size_type', 'contracts');
    }

    // Auto-calculate Fees
    const info = ASSET_CONFIG[t];
    if (info) {
      const calculatedFees = info.roundTripFee * size;
      form.setValue('fees', Number(calculatedFees.toFixed(2)));
    }
  }, [ticker, size, form]);

  React.useEffect(() => {
    const isValid = exit && exit !== 0 && entry && entry !== 0 && size && size !== 0;
    
    if (isValid) {
      form.setValue('pnl', Number(calculatedPnL.toFixed(2)));
      if (calculatedPnL > 0) form.setValue('status', 'win');
      if (calculatedPnL < 0) form.setValue('status', 'loss');
      if (calculatedPnL === 0) form.setValue('status', 'breakeven');
    } else {
      form.setValue('pnl', 0);
      form.setValue('status', 'open');
    }
  }, [calculatedPnL, exit, entry, size, form]);

  const onSubmit = async (values: TradeFormValues) => {
    setIsSubmitting(true);
    try {
      const tickerUpper = values.ticker.toUpperCase();
      const finalMarketType = getMarketTypeFromTicker(tickerUpper);

      // Upload images to Supabase first
      const imageUrls: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError, data } = await supabase.storage
            .from('trade-screenshots')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload image: ${file.name}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('trade-screenshots')
            .getPublicUrl(filePath);
          
          imageUrls.push(publicUrl);
        }
      }

      const payload: Omit<Trade, 'id' | 'created_at' | 'user_id'> = {
        ticker: tickerUpper,
        market_type: finalMarketType,
        entry_price: values.entry_price,
        exit_price: values.exit_price,
        stop_loss: values.stop_loss,
        trade_date: values.trade_date,
        position_size: values.position_size,
        size_type: values.size_type,
        direction: values.direction,
        status: values.status,
        pnl: values.pnl,
        fees: values.fees,
        risk_reward_ratio: Number(rrRatio),
        notes: values.notes,
        image_urls: imageUrls,
      };
      await contextCreateTrade(payload);
      toast.success('Trade logged successfully');
      form.reset();
      setFiles([]);
      setPreviews([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to log trade');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > 13) {
      toast.error('Maximum 13 images allowed per trade');
      return;
    }

    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);

    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);

    URL.revokeObjectURL(previews[index]);
    const newPreviews = [...previews];
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-md border border-zinc-800/80 bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-sm text-zinc-200">
            {form.watch('ticker') ? form.watch('ticker').substring(0, 3) : '---'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-zinc-100">
                {form.watch('ticker') || 'UNTITLED EXECUTION'}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider bg-zinc-900 text-zinc-400 rounded-sm border border-zinc-800">
                {marketType}
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-500">
              {direction.toUpperCase()} • SIZE: {size} {form.watch('size_type')}
            </p>
          </div>
        </div>

        <Button 
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 px-5 rounded-md font-mono text-xs uppercase tracking-wider transition-colors shadow-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Save className="mr-2 h-3.5 w-3.5" />
              Record Execution
            </>
          )}
        </Button>
      </div>

      {/* 2-Column Institutional Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* COLUMN 1: Execution Data */}
        <div className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                Execution Parameters
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">ORDER_FILL_DATA</span>
          </div>

          <div className="space-y-3 font-mono">
            {/* Ticker Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Coins size={13} className="text-zinc-500" /> Ticker
              </span>
              <Select 
                value={form.watch('ticker')}
                onValueChange={(v) => form.setValue('ticker', v)}
              >
                <SelectTrigger className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold text-zinc-100">
                  <SelectValue placeholder="Select instrument..." />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900 font-mono text-xs">
                  {Object.entries(ASSET_CONFIG)
                    .filter(([_, config]) => config.type === marketType)
                    .map(([tickerKey, config]) => (
                    <SelectItem key={tickerKey} value={tickerKey} className="text-xs font-mono">
                      {tickerKey} ({config.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <ArrowRightLeft size={13} className="text-zinc-500" /> Direction
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue('direction', 'long')}
                  className={cn(
                    "h-8 rounded-sm text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1",
                    direction === 'long'
                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-600/60"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  )}
                >
                  ▲ LONG
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('direction', 'short')}
                  className={cn(
                    "h-8 rounded-sm text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1",
                    direction === 'short'
                      ? "bg-rose-950/50 text-rose-400 border-rose-600/60"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  )}
                >
                  ▼ SHORT
                </button>
              </div>
            </div>

            {/* Trade Date */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <CalendarIcon size={13} className="text-zinc-500" /> Execution Date
              </span>
              <Input 
                type="date"
                {...form.register('trade_date')}
                className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono text-zinc-100"
              />
            </div>

            {/* Entry & Exit Prices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 border-b border-zinc-800/60">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <DollarSign size={12} className="text-zinc-500" /> Entry Price
                </label>
                <Input 
                  type="number"
                  step="0.01"
                  {...form.register('entry_price')}
                  className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold text-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <DollarSign size={12} className="text-zinc-500" /> Exit Price
                </label>
                <Input 
                  type="number"
                  step="0.01"
                  {...form.register('exit_price')}
                  className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold text-zinc-100"
                />
              </div>
            </div>

            {/* Stop Loss & Risk */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Shield size={13} className="text-zinc-500" /> Stop Loss
              </span>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  step="0.01"
                  {...form.register('stop_loss')}
                  className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono text-zinc-100 flex-1"
                />
                {calculatedRisk > 0 && (
                  <span className="text-[10px] font-mono text-rose-400 px-2 py-1 rounded-sm bg-rose-950/40 border border-rose-800/50 whitespace-nowrap">
                    Risk: -${calculatedRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* Position Size & Multiplier */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Layers size={13} className="text-zinc-500" /> 
                {marketType === 'futures' ? 'Contracts' : 'Lots'}
              </span>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  step="0.01"
                  {...form.register('position_size')}
                  className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold text-zinc-100 w-24"
                />
                {multiplier > 1 && (
                  <span className="text-[10px] font-mono text-zinc-400 px-2 py-1 rounded-sm bg-zinc-900 border border-zinc-800">
                    ${multiplier}/pt multiplier
                  </span>
                )}
              </div>
            </div>

            {/* Outcome Status */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                {form.watch('status') === 'win' ? (
                  <CheckCircle2 size={13} className="text-emerald-500" />
                ) : (
                  <XCircle size={13} className="text-rose-500" />
                )} 
                Outcome
              </span>
              <Select 
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as any)}
              >
                <SelectTrigger className="border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold text-zinc-100">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900 font-mono text-xs">
                  <SelectItem value="open">OPEN</SelectItem>
                  <SelectItem value="win" className="text-emerald-400">WIN</SelectItem>
                  <SelectItem value="loss" className="text-rose-400">LOSS</SelectItem>
                  <SelectItem value="breakeven">BREAKEVEN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* P/L & R:R Ratio */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 py-2 border-b border-zinc-800/60">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <DollarSign size={13} className="text-zinc-500" /> Net P/L
              </span>
              <div className="flex items-center gap-3">
                <Input 
                  type="number"
                  step="0.01"
                  {...form.register('pnl')}
                  className={cn(
                    "border-zinc-800 bg-zinc-900/80 rounded-sm h-8 text-xs font-mono font-bold transition-colors w-32",
                    form.watch('pnl') > 0 ? "text-emerald-400" : form.watch('pnl') < 0 ? "text-rose-400" : "text-zinc-100"
                  )}
                />
                {exit && exit !== 0 && (
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-1 rounded-sm border",
                    Number(rrRatio) >= 2 
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" 
                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
                  )}>
                    R:R {rrRatio}R
                  </span>
                )}
              </div>
            </div>

            {/* Estimated Fees */}
            <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] sm:items-center gap-2 pt-2">
              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Plus size={13} className="text-zinc-600" /> Roundtrip Fee
              </span>
              <Input 
                type="number"
                step="0.01"
                disabled
                {...form.register('fees')}
                className="border-zinc-800/40 bg-zinc-900/40 rounded-sm h-8 text-xs font-mono text-zinc-500 cursor-not-allowed w-28"
              />
            </div>
          </div>
        </div>

        {/* COLUMN 2: Qualitative Analysis & Screenshots */}
        <div className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-6 space-y-6 flex flex-col">
          {/* Notes Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                Qualitative Reflections & Notes
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">POST_MORTEM</span>
          </div>

          {/* Taller Textarea */}
          <Textarea 
            {...form.register('notes')}
            placeholder="Type your execution post-mortem here... What market structure did you observe? What was the liquidity state? Was execution disciplined or emotional?"
            className="min-h-[220px] rounded-sm border border-zinc-800 bg-zinc-900/70 p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-emerald-500 resize-none leading-relaxed"
          />

          {/* Screenshots Section */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-zinc-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                  Chart Screenshots
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded-sm bg-zinc-900 border border-zinc-800">
                {files.length} / 13 Images
              </span>
            </div>

            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 rounded-sm p-6 text-center transition-colors cursor-pointer group",
                files.length >= 13 && "opacity-50 pointer-events-none"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple 
                accept="image/*" 
                className="hidden" 
              />
              <Upload size={20} className="text-zinc-500 group-hover:text-emerald-400 mx-auto mb-2 transition-colors" />
              <p className="text-xs font-mono font-medium text-zinc-300">
                Click to attach chart captures or drag & drop
              </p>
              <p className="text-[10px] font-mono text-zinc-600 mt-1">PNG, JPG, WEBP up to 5MB</p>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group aspect-video rounded-sm overflow-hidden border border-zinc-800 bg-zinc-900">
                    <img 
                      src={preview} 
                      alt={`Preview ${index}`} 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-rose-400 hover:text-rose-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

