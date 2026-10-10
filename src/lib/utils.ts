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

  return 'cfds'; // Default safety for V1
}
