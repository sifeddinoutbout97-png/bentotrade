import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMarketTypeFromTicker(ticker: string): 'futures' | 'cfds' {
  const t = ticker.toUpperCase();
  
  // Specific Futures Symbols (Hardcoded)
  const futuresSymbols = ['NQ', 'ES', 'YM', 'RTY', 'GC', 'CL', 'BTC', 'MNQ', 'MES', 'MYM', 'M2K'];
  if (futuresSymbols.some(s => t.startsWith(s)) || futuresSymbols.includes(t)) {
    return 'futures';
  }

  // Specific CFD/Forex Patterns
  if (
    t.includes('USD') || 
    t.includes('XAU') || 
    t.includes('EUR') || 
    t.includes('GBP') || 
    t.includes('JPY') ||
    t.includes('NAS') || 
    t.includes('US30') || 
    t.includes('GER40')
  ) {
    return 'cfds';
  }

  return 'cfds'; // Default safety
}

export function formatCurrency(amount: number | null | undefined, showSign = false): string {
  const val = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(val));

  if (val < 0) return `-${absFormatted}`;
  if (val > 0 && showSign) return `+${absFormatted}`;
  return absFormatted;
}

export function formatDate(dateInput: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('en-US', options || { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
