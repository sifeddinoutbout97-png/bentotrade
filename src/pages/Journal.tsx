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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-20">
      <header className="mb-12">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
          <span>Trades</span> / <span className="font-bold text-foreground">New Trade</span>
        </div>
      </header>

      {/* Market Toggle Switch */}
      <div className="mb-8 p-1 bg-muted rounded-xl w-fit flex items-center gap-1 border border-border">
        <button
          type="button"
          onClick={() => setMarketType('futures')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            marketType === 'futures' 
              ? "bg-background text-foreground shadow-sm border border-border" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ScrollText size={14} className={marketType === 'futures' ? "text-foreground" : "opacity-40"} />
          Futures
        </button>
        <button
          type="button"
          onClick={() => setMarketType('cfds')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            marketType === 'cfds' 
              ? "bg-background text-foreground shadow-sm border border-border" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe size={14} className={marketType === 'cfds' ? "text-foreground" : "opacity-40"} />
          CFDs
        </button>
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
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-6">
        <h1 className="text-3xl md:text-[40px] font-bold text-foreground leading-tight tracking-tight flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {form.watch('ticker') ? (
            <>
              <span className="font-extrabold tracking-tighter uppercase">{form.watch('ticker')}</span>
              <span className="text-xl md:text-2xl font-medium text-muted-foreground opacity-40">Trade</span>
              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest rounded-md border border-border">
                {marketType === 'futures' ? 'Futures' : 'CFD'}
              </span>
            </>
          ) : (
            'New Trade'
          )}
        </h1>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={isSubmitting}
          className="w-full md:w-auto bg-primary text-primary-foreground hover:opacity-90 h-10 px-6 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 justify-center"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Trade
            </>
          )}
        </Button>
      </div>

      <form className="space-y-0 border-t border-border">
        <PropertyItem label="Ticker" icon={marketType === 'futures' ? ScrollText : Coins}>
          <Select 
            value={form.watch('ticker')}
            onValueChange={(v) => form.setValue('ticker', v)}
          >
            <SelectTrigger className="border-none focus:ring-0 p-0 h-7 text-sm font-bold bg-transparent shadow-none hover:bg-transparent uppercase text-foreground">
              <SelectValue placeholder="Select ticker..." />
            </SelectTrigger>
            <SelectContent className="border-border shadow-2xl rounded-xl bg-popover">
              {Object.entries(ASSET_CONFIG)
                .filter(([_, config]) => config.type === marketType)
                .map(([ticker]) => (
                <SelectItem key={ticker} value={ticker} className="text-sm font-medium">
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyItem>

        <PropertyItem label="Direction" icon={ArrowRightLeft}>
          <Select 
            onValueChange={(v) => form.setValue('direction', v as any)} 
            defaultValue="long"
          >
            <SelectTrigger className="border-none focus:ring-0 p-0 h-7 text-sm font-bold bg-transparent shadow-none hover:bg-transparent text-foreground">
              <SelectValue placeholder="Select side" />
            </SelectTrigger>
            <SelectContent className="border-border shadow-2xl rounded-xl bg-popover">
              <SelectItem value="long" className="text-sm">Long</SelectItem>
              <SelectItem value="short" className="text-sm">Short</SelectItem>
            </SelectContent>
          </Select>
        </PropertyItem>

        <PropertyItem label="Trade Date" icon={CalendarIcon}>
          <Input 
            type="date"
            {...form.register('trade_date')}
            className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground"
          />
        </PropertyItem>

        <PropertyItem label="Entry Price" icon={DollarSign}>
          <Input 
            type="number"
            step="0.01"
            {...form.register('entry_price')}
            className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground"
          />
        </PropertyItem>

        <PropertyItem label="Exit Price" icon={DollarSign}>
          <Input 
            type="number"
            step="0.01"
            {...form.register('exit_price')}
            className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground"
          />
        </PropertyItem>

        <PropertyItem label="Stop Loss" icon={Shield}>
          <div className="flex items-center justify-between w-full">
            <Input 
              type="number"
              step="0.01"
              {...form.register('stop_loss')}
              className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground"
            />
            {calculatedRisk > 0 && (
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                Risk: -${calculatedRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </PropertyItem>

        <PropertyItem label={marketType === 'futures' ? "Size (Contracts)" : "Size (Lots)"} icon={Layers}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1">
              <Input 
                type="number"
                step="0.01"
                {...form.register('position_size')}
                className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground w-24"
              />
              
              {/* Position Mode Indicator */}
              <div className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                marketType === 'futures' 
                  ? "bg-primary/5 text-primary border-primary/20" 
                  : "bg-indigo-500/5 text-indigo-400 border-indigo-500/20"
              )}>
                {marketType === 'futures' ? 'Contracts' : 'Lots'}
              </div>
            </div>

            {multiplier > 1 && (
              <Badge variant="outline" className="text-[10px] h-5 bg-muted/50 border-border font-medium text-muted-foreground uppercase px-2">
                {assetInfo ? (
                  `$${multiplier}/pt multiplier (${assetInfo.name})`
                ) : (
                  `$${multiplier}/pt multiplier detected`
                )}
              </Badge>
            )}
          </div>
        </PropertyItem>

        <PropertyItem label="Outcome" icon={form.watch('status') === 'win' ? CheckCircle2 : XCircle}>
          <Select 
            onValueChange={(v) => form.setValue('status', v as any)} 
            defaultValue="open"
          >
            <SelectTrigger className="border-none focus:ring-0 p-0 h-7 text-sm bg-transparent shadow-none font-bold text-foreground">
              <SelectValue placeholder="Select outcome" />
            </SelectTrigger>
            <SelectContent className="border-border shadow-2xl rounded-xl bg-popover">
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="win" className="text-emerald-500 font-bold">Win</SelectItem>
              <SelectItem value="loss" className="text-rose-500 font-bold">Loss</SelectItem>
              <SelectItem value="breakeven">Breakeven</SelectItem>
            </SelectContent>
          </Select>
        </PropertyItem>

        <PropertyItem label="P/L Amount" icon={DollarSign}>
          <div className="flex items-center justify-between w-full">
            <Input 
              type="number"
              step="0.01"
              {...form.register('pnl')}
              className={cn(
                "border-none focus-visible:ring-0 px-0 h-7 text-sm font-extrabold bg-transparent w-full transition-colors",
                form.watch('pnl') > 0 ? "text-emerald-500" : form.watch('pnl') < 0 ? "text-rose-500" : "text-foreground"
              )}
            />
            {exit && exit !== 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  R:R
                </span>
                <Badge className={cn(
                  "h-5 text-[10px] font-bold px-2 rounded-lg",
                  Number(rrRatio) >= 2 ? "bg-emerald-500/10 text-emerald-500 border-none" : "bg-muted text-muted-foreground border-none"
                )} variant="outline">
                  {rrRatio}R
                </Badge>
              </div>
            )}
          </div>
        </PropertyItem>

        <PropertyItem label="Estimated Fees" icon={Plus}>
          <Input 
            type="number"
            step="0.01"
            disabled
            {...form.register('fees')}
            className="border-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent font-bold text-foreground opacity-50 cursor-not-allowed"
          />
        </PropertyItem>
      </form>

      <div className="mt-12 group p-8 bg-white/70 dark:bg-muted/20 rounded-3xl border border-zinc-950/5 dark:border-border shadow-sm dark:shadow-none backdrop-blur-[20px] transition-all hover:border-zinc-300 dark:hover:border-border/80">
        <div className="flex items-center gap-2 mb-6 text-zinc-950 dark:text-white">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Activity size={18} className="text-primary text-primary-700 dark:text-primary" />
          </div>
          <h2 className="text-xl font-black tracking-tight uppercase">Reflections & Notes</h2>
        </div>
        <Textarea 
          {...form.register('notes')}
          placeholder="Start typing your reflection here... what did you see on the charts? Were you disciplined today?"
          className="min-h-[300px] border-none focus-visible:ring-0 p-0 text-[16px] leading-relaxed resize-none bg-transparent placeholder:text-zinc-300 dark:placeholder:text-muted-foreground/30 font-medium text-zinc-950 dark:text-white"
        />

        {/* Image Upload Section */}
        <div className="mt-10 pt-10 border-t border-zinc-950/5 dark:border-border/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <ImageIcon size={18} className="text-indigo-700 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white uppercase">Chart Screenshots</h2>
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-muted px-2 py-1 rounded-md border border-zinc-200 dark:border-transparent">
              {files.length} / 13 Images
            </span>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed border-zinc-950/5 dark:border-border rounded-3xl p-12 text-center transition-all cursor-pointer group hover:border-primary/50 hover:bg-primary/5",
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
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-muted flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Upload size={24} className="text-zinc-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-zinc-950 dark:text-white font-black mb-1">Click to upload or drag and drop</p>
            <p className="text-zinc-500 text-sm font-medium">PNG, JPG, WEBP up to 5MB (Max 13)</p>
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-8">
              {previews.map((preview, index) => (
                <div key={index} className="relative group aspect-video rounded-2xl overflow-hidden border border-border shadow-sm">
                  <img 
                    src={preview} 
                    alt={`Preview ${index}`} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

