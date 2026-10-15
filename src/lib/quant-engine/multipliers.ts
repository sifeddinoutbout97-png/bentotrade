/**
 * BentoTrade v5.0 Quant Engine - Module 2: Asset Class & Multiplier Engine
 * Standardizes contract specs, tick values, and PnL calculations across instruments.
 */

export type AssetClass = 'futures' | 'forex' | 'crypto' | 'equities' | 'options';

export interface ContractSpec {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  multiplier: number;       // Point value multiplier (e.g. 2 for MNQ, 20 for NQ)
  tickSize: number;         // Minimum price movement (e.g. 0.25)
  tickValue: number;        // Dollar value per tick (multiplier * tickSize)
  description: string;
}

export interface PnLParams {
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  ticker: string;
  assetClass?: AssetClass | string;
  commissions?: number;
  slippage?: number;
}

export interface PnLResult {
  pnl: number;                // Net PnL after commissions & slippage
  grossPnl: number;           // Gross PnL before costs
  priceDelta: number;         // Exit - Entry for LONG, Entry - Exit for SHORT
  pointsGained: number;       // Directional point movement
  ticksGained: number;        // Number of ticks captured
  totalCommissions: number;   // Commissions deducted
  totalSlippage: number;      // Slippage deducted
  multiplierUsed: number;     // Multiplier applied
  spec: ContractSpec;
}

/**
 * Institutional Contract Specification Registry
 */
export const CONTRACT_SPECS: Record<string, ContractSpec> = {
  // --- FUTURES & INDEXES ---
  MNQ: {
    ticker: 'MNQ',
    name: 'Micro E-mini Nasdaq-100',
    assetClass: 'futures',
    multiplier: 2,
    tickSize: 0.25,
    tickValue: 0.50,
    description: '$2.00 per index point ($0.50 per 0.25 tick)'
  },
  NQ: {
    ticker: 'NQ',
    name: 'E-mini Nasdaq-100',
    assetClass: 'futures',
    multiplier: 20,
    tickSize: 0.25,
    tickValue: 5.00,
    description: '$20.00 per index point ($5.00 per 0.25 tick)'
  },
  MES: {
    ticker: 'MES',
    name: 'Micro E-mini S&P 500',
    assetClass: 'futures',
    multiplier: 5,
    tickSize: 0.25,
    tickValue: 1.25,
    description: '$5.00 per index point ($1.25 per 0.25 tick)'
  },
  ES: {
    ticker: 'ES',
    name: 'E-mini S&P 500',
    assetClass: 'futures',
    multiplier: 50,
    tickSize: 0.25,
    tickValue: 12.50,
    description: '$50.00 per index point ($12.50 per 0.25 tick)'
  },
  RTY: {
    ticker: 'RTY',
    name: 'E-mini Russell 2000',
    assetClass: 'futures',
    multiplier: 50,
    tickSize: 0.10,
    tickValue: 5.00,
    description: '$50.00 per index point ($5.00 per 0.10 tick)'
  },
  M2K: {
    ticker: 'M2K',
    name: 'Micro E-mini Russell 2000',
    assetClass: 'futures',
    multiplier: 5,
    tickSize: 0.10,
    tickValue: 0.50,
    description: '$5.00 per index point ($0.50 per 0.10 tick)'
  },
  YM: {
    ticker: 'YM',
    name: 'E-mini Dow Jones',
    assetClass: 'futures',
    multiplier: 5,
    tickSize: 1.00,
    tickValue: 5.00,
    description: '$5.00 per index point ($5.00 per 1.00 tick)'
  },
  MYM: {
    ticker: 'MYM',
    name: 'Micro E-mini Dow Jones',
    assetClass: 'futures',
    multiplier: 0.5,
    tickSize: 1.00,
    tickValue: 0.50,
    description: '$0.50 per index point ($0.50 per 1.00 tick)'
  },
  CL: {
    ticker: 'CL',
    name: 'Crude Oil Futures',
    assetClass: 'futures',
    multiplier: 1000,
    tickSize: 0.01,
    tickValue: 10.00,
    description: '$1,000 per point ($10.00 per $0.01 tick)'
  },
  MCL: {
    ticker: 'MCL',
    name: 'Micro Crude Oil Futures',
    assetClass: 'futures',
    multiplier: 100,
    tickSize: 0.01,
    tickValue: 1.00,
    description: '$100 per point ($1.00 per $0.01 tick)'
  },
  GC: {
    ticker: 'GC',
    name: 'Gold Futures',
    assetClass: 'futures',
    multiplier: 100,
    tickSize: 0.10,
    tickValue: 10.00,
    description: '$100 per troy oz ($10.00 per $0.10 tick)'
  },
  MGC: {
    ticker: 'MGC',
    name: 'Micro Gold Futures',
    assetClass: 'futures',
    multiplier: 10,
    tickSize: 0.10,
    tickValue: 1.00,
    description: '$10 per troy oz ($1.00 per $0.10 tick)'
  },
  SI: {
    ticker: 'SI',
    name: 'Silver Futures',
    assetClass: 'futures',
    multiplier: 5000,
    tickSize: 0.005,
    tickValue: 25.00,
    description: '$5,000 per index point ($25.00 per 0.005 tick)'
  },
  MSI: {
    ticker: 'MSI',
    name: 'Micro Silver Futures',
    assetClass: 'futures',
    multiplier: 1000,
    tickSize: 0.005,
    tickValue: 5.00,
    description: '$1,000 per index point ($5.00 per 0.005 tick)'
  },
  HG: {
    ticker: 'HG',
    name: 'Copper Futures',
    assetClass: 'futures',
    multiplier: 25000,
    tickSize: 0.0005,
    tickValue: 12.50,
    description: '$25,000 per index point ($12.50 per 0.0005 tick)'
  },
  ZB: {
    ticker: 'ZB',
    name: '30-Year U.S. Treasury Bond',
    assetClass: 'futures',
    multiplier: 1000,
    tickSize: 0.03125,
    tickValue: 31.25,
    description: '$1,000 per point ($31.25 per 1/32 tick)'
  },

  // --- FOREX ---
  EURUSD: {
    ticker: 'EURUSD',
    name: 'Euro / US Dollar',
    assetClass: 'forex',
    multiplier: 100000, // 1 Standard Lot = 100,000 units
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip on USD quote)'
  },
  GBPUSD: {
    ticker: 'GBPUSD',
    name: 'British Pound / US Dollar',
    assetClass: 'forex',
    multiplier: 100000,
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip on USD quote)'
  },
  USDJPY: {
    ticker: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    assetClass: 'forex',
    multiplier: 1000, // 1 pip = 0.01
    tickSize: 0.01,
    tickValue: 10.00,
    description: 'Standard Lot JPY pair ($10/pip approx)'
  },
  AUDUSD: {
    ticker: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    assetClass: 'forex',
    multiplier: 100000,
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip on USD quote)'
  },
  USDCAD: {
    ticker: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    assetClass: 'forex',
    multiplier: 100000,
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip approx)'
  },
  USDCHF: {
    ticker: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    assetClass: 'forex',
    multiplier: 100000,
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip approx)'
  },
  NZDUSD: {
    ticker: 'NZDUSD',
    name: 'New Zealand Dollar / US Dollar',
    assetClass: 'forex',
    multiplier: 100000,
    tickSize: 0.0001,
    tickValue: 10.00,
    description: 'Standard Lot ($10/pip on USD quote)'
  },
  XAUUSD: {
    ticker: 'XAUUSD',
    name: 'Gold Spot / US Dollar (CFD)',
    assetClass: 'forex',
    multiplier: 100,
    tickSize: 0.01,
    tickValue: 1.00,
    description: 'Gold Spot CFD ($100 per $1.00 move per 1.0 lot)'
  }
};

/**
 * Retrieve contract specification by ticker symbol, falling back to flat multiplier 1.0 for crypto/equities
 */
export function getContractSpec(ticker: string, assetClassHint?: string): ContractSpec {
  const cleanTicker = (ticker || '').trim().toUpperCase();

  if (CONTRACT_SPECS[cleanTicker]) {
    return CONTRACT_SPECS[cleanTicker];
  }

  // Handle Forex pairs without slash (e.g. EURUSD, GBPUSD)
  if (cleanTicker.length === 6 && (cleanTicker.endsWith('USD') || cleanTicker.startsWith('USD'))) {
    const isJpy = cleanTicker.includes('JPY');
    return {
      ticker: cleanTicker,
      name: `${cleanTicker} Forex Spot`,
      assetClass: 'forex',
      multiplier: isJpy ? 1000 : 100000,
      tickSize: isJpy ? 0.01 : 0.0001,
      tickValue: 10.00,
      description: 'Standard Forex Pair Spec'
    };
  }

  // Handle Crypto / Equities default (1.0 multiplier)
  const inferredClass: AssetClass = 
    assetClassHint === 'crypto' || cleanTicker.includes('BTC') || cleanTicker.includes('ETH') || cleanTicker.includes('SOL')
      ? 'crypto'
      : assetClassHint === 'futures'
      ? 'futures'
      : assetClassHint === 'forex'
      ? 'forex'
      : 'equities';

  return {
    ticker: cleanTicker || 'UNKNOWN',
    name: `${cleanTicker || 'Generic'} Instrument`,
    assetClass: inferredClass,
    multiplier: 1.0,
    tickSize: 0.01,
    tickValue: 0.01,
    description: 'Default 1.0 multiplier (Equity/Crypto/Spot)'
  };
}

/**
 * Calculate precise PnL across Long/Short positions with zero floating-point rounding errors
 */
export function calculatePnL(params: PnLParams): PnLResult {
  const {
    direction,
    entryPrice,
    exitPrice,
    size,
    ticker,
    assetClass,
    commissions = 0,
    slippage = 0
  } = params;

  const spec = getContractSpec(ticker, assetClass);
  const multiplier = spec.multiplier;

  // Determine directional price delta
  const isLong = direction.toLowerCase() === 'long';
  const priceDelta = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pointsGained = priceDelta;

  // Gross PnL
  const grossPnl = priceDelta * multiplier * size;

  // Total deductions
  const totalCommissions = Math.max(0, commissions);
  const totalSlippage = Math.max(0, slippage);
  const netPnlRaw = grossPnl - totalCommissions - totalSlippage;

  // Eliminate floating point representation artifacts (e.g. 0.000000000000004)
  const pnl = Math.round((netPnlRaw + Number.EPSILON) * 100) / 100;
  const grossPnlClean = Math.round((grossPnl + Number.EPSILON) * 100) / 100;

  // Ticks captured calculation
  const tickSize = spec.tickSize || 0.01;
  const ticksGained = Math.round((priceDelta / tickSize) * 100) / 100;

  return {
    pnl,
    grossPnl: grossPnlClean,
    priceDelta: Math.round((priceDelta + Number.EPSILON) * 10000) / 10000,
    pointsGained: Math.round((pointsGained + Number.EPSILON) * 10000) / 10000,
    ticksGained,
    totalCommissions: Math.round((totalCommissions + Number.EPSILON) * 100) / 100,
    totalSlippage: Math.round((totalSlippage + Number.EPSILON) * 100) / 100,
    multiplierUsed: multiplier,
    spec
  };
}
