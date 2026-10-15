/**
 * BentoTrade V6.0 Quant Engine - Module: Universal Broker Execution Parser
 * Institutional CSV parser with FIFO lot-matching, contract multiplier normalization, and PnL calculation.
 */

import Papa from 'papaparse';
import { calculatePnL, getContractSpec } from './multipliers';
import { getMarketTypeFromTicker } from '@/lib/utils';
import { Trade } from '@/types';

export type BrokerFormat = 
  | 'tradovate-ninjatrader'
  | 'interactive-brokers'
  | 'thinkorswim'
  | 'rithmic'
  | 'generic';

export interface BrokerOption {
  id: BrokerFormat;
  label: string;
  description: string;
  fileHint: string;
}

export const SUPPORTED_BROKERS: BrokerOption[] = [
  {
    id: 'tradovate-ninjatrader',
    label: 'Tradovate / NinjaTrader CSV',
    description: 'Standard fill/order executions export from Tradovate or NinjaTrader 8',
    fileHint: 'Columns: Timestamp, Contract/Instrument, Action/Side, Price, Quantity, Fee'
  },
  {
    id: 'interactive-brokers',
    label: 'Interactive Brokers (IBKR)',
    description: 'Flex query execution report or Activity Statement trades CSV',
    fileHint: 'Columns: Date/Time, Symbol, Buy/Sell, Quantity, Price, Comm/Fee'
  },
  {
    id: 'thinkorswim',
    label: 'Thinkorswim / Charles Schwab',
    description: 'Account Statement trade history CSV export',
    fileHint: 'Columns: Exec Time, Symbol, Side, Qty, Price, Commission'
  },
  {
    id: 'rithmic',
    label: 'Rithmic / Quantower',
    description: 'Rithmic R | Trader Pro or Quantower fills blotter CSV',
    fileHint: 'Columns: Fill Time, Symbol, Side, Size, Fill Price, Account'
  },
  {
    id: 'generic',
    label: 'Universal Execution CSV',
    description: 'Generic execution table (Timestamp, Ticker, Side, Price, Qty)',
    fileHint: 'Columns: Date/Timestamp, Ticker/Symbol, Side (Buy/Sell), Price, Size'
  }
];

export interface RawExecution {
  id: string;
  timestamp: string;
  tradeDate: string; // YYYY-MM-DD
  ticker: string;
  rawSymbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  fees: number;
  orderId?: string;
}

export interface GroupedTradePreview {
  id: string;
  ticker: string;
  marketType: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  tradeDate: string; // YYYY-MM-DD
  entryTime: string;
  exitTime: string;
  pnl: number;
  grossPnl: number;
  pointsGained: number;
  ticksGained: number;
  fees: number;
  status: 'win' | 'loss' | 'breakeven';
  multiplier: number;
  notes: string;
  tags: string[];
}

export interface ParseResult {
  success: boolean;
  rawExecutionsCount: number;
  groupedTrades: GroupedTradePreview[];
  openPositionsCount: number;
  totalProjectedPnl: number;
  grossProfit: number;
  grossLoss: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  errors: string[];
}

/**
 * Normalizes futures contracts by removing expiration codes (e.g. MNQU4, NQ 09-24, MESM24 -> MNQ, NQ, MES)
 */
export function cleanTickerSymbol(raw: string): string {
  if (!raw) return 'UNKNOWN';
  let sym = raw.trim().toUpperCase();

  // Strip common prefixes/suffixes like /ES or .NQ or exchange suffixes
  sym = sym.replace(/^\/+/, '');
  sym = sym.split('.')[0].trim();
  sym = sym.split(':')[0].trim();

  // Match month code + 1 or 2 digit year: e.g., MNQU4, NQM24, ESZ23, CLK24, GCQ24
  const monthCodeRegex = /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,2})$/i;
  const match = sym.match(monthCodeRegex);
  if (match) {
    return match[1].toUpperCase();
  }

  // Match space + month-year format: e.g. "NQ 09-24", "ES 12-23", "MNQ 06-24"
  const spaceDateRegex = /^([A-Z0-9]{1,5})\s+\d{2}[-/]\d{2}$/i;
  const spaceMatch = sym.match(spaceDateRegex);
  if (spaceMatch) {
    return spaceMatch[1].toUpperCase();
  }

  return sym;
}

/**
 * Intelligently finds the appropriate value from a row object using candidate column names
 */
function findRowValue(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const cleanCand = cand.toLowerCase().replace(/[\s_\-/]/g, '');
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[\s_\-/]/g, '');
      if (cleanKey === cleanCand || cleanKey.includes(cleanCand)) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return undefined;
}

/**
 * Standardize timestamp string into ISO format and Date object
 */
function parseTimestamp(rawDate: string): { iso: string; dateOnly: string; timeMs: number } {
  if (!rawDate) {
    const now = new Date();
    return {
      iso: now.toISOString(),
      dateOnly: now.toISOString().split('T')[0],
      timeMs: now.getTime()
    };
  }

  // Handle common broker formats like "2024-05-15 09:30:15", "5/15/2024 9:30:15 AM", "2024-05-15T09:30:15Z"
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return {
      iso: parsed.toISOString(),
      dateOnly: parsed.toISOString().split('T')[0],
      timeMs: parsed.getTime()
    };
  }

  // Fallback for custom formats: YYYYMMDD HH:mm:ss
  const compactMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (compactMatch) {
    const d = new Date(
      parseInt(compactMatch[1]),
      parseInt(compactMatch[2]) - 1,
      parseInt(compactMatch[3]),
      parseInt(compactMatch[4]),
      parseInt(compactMatch[5]),
      parseInt(compactMatch[6])
    );
    return {
      iso: d.toISOString(),
      dateOnly: d.toISOString().split('T')[0],
      timeMs: d.getTime()
    };
  }

  const fallback = new Date();
  return {
    iso: fallback.toISOString(),
    dateOnly: fallback.toISOString().split('T')[0],
    timeMs: fallback.getTime()
  };
}

/**
 * Parse CSV string into standardized RawExecution array
 */
export function parseRawExecutions(csvContent: string): { executions: RawExecution[]; errors: string[] } {
  const errors: string[] = [];
  const parseResult = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false
  });

  if (parseResult.errors && parseResult.errors.length > 0) {
    parseResult.errors.forEach(e => {
      if (e.type !== 'FieldMismatch') {
        errors.push(`Line ${e.row}: ${e.message}`);
      }
    });
  }

  const rows = parseResult.data || [];
  const executions: RawExecution[] = [];

  rows.forEach((row, idx) => {
    // 1. Ticker / Symbol detection
    const rawTicker = findRowValue(row, [
      'contract', 'symbol', 'instrument', 'ticker', 'product', 'item', 'description'
    ]);
    if (!rawTicker) return;

    // 2. Action / Side detection
    const rawSide = findRowValue(row, [
      'action', 'side', 'bs', 'buy/sell', 'type', 'marketpos', 'transaction', 'direction'
    ]);
    if (!rawSide) return;

    const sideUpper = rawSide.toUpperCase();
    const isBuy = sideUpper.includes('BUY') || sideUpper.includes('BOT') || sideUpper === 'B' || sideUpper.includes('LONG');
    const isSell = sideUpper.includes('SELL') || sideUpper.includes('SLD') || sideUpper === 'S' || sideUpper.includes('SHORT');

    if (!isBuy && !isSell) return;

    // 3. Price detection
    const rawPrice = findRowValue(row, [
      'price', 'fillprice', 'avgprice', 'executionprice', 'execprice', 'tradeprice', 'rate'
    ]);
    const price = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.-]/g, '')) : 0;
    if (isNaN(price) || price <= 0) return;

    // 4. Quantity detection
    const rawQty = findRowValue(row, [
      'quantity', 'qty', 'size', 'filledqty', 'contracts', 'shares', 'amount'
    ]);
    const quantity = rawQty ? Math.abs(parseFloat(rawQty.replace(/[^0-9.-]/g, ''))) : 1;
    if (isNaN(quantity) || quantity <= 0) return;

    // 5. Date / Time detection
    const rawTime = findRowValue(row, [
      'timestamp', 'filltime', 'time', 'date', 'datetime', 'tradedate', 'executiontime', 'exectime'
    ]);
    const parsedTime = parseTimestamp(rawTime || '');

    // 6. Fees / Commission detection
    const rawFee = findRowValue(row, [
      'commission', 'fee', 'comm', 'fees', 'totalfee', 'cost'
    ]);
    const fee = rawFee ? Math.abs(parseFloat(rawFee.replace(/[^0-9.-]/g, '')) || 0) : 0;

    // 7. Order ID
    const orderId = findRowValue(row, ['orderid', 'fillid', 'tradeid', 'id', 'ticket']) || `exec-${idx}`;

    const cleanTicker = cleanTickerSymbol(rawTicker);

    executions.push({
      id: `exec-${idx}-${Date.now()}`,
      timestamp: parsedTime.iso,
      tradeDate: parsedTime.dateOnly,
      ticker: cleanTicker,
      rawSymbol: rawTicker,
      side: isBuy ? 'BUY' : 'SELL',
      price,
      quantity,
      fees: isNaN(fee) ? 0 : fee,
      orderId
    });
  });

  return { executions, errors };
}

interface OpenLot {
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  timestamp: string;
  tradeDate: string;
  fees: number;
  rawSymbol: string;
}

/**
 * Institutional FIFO Matching Engine:
 * Pairs BUY and SELL executions on the same instrument to produce round-trip closed trades
 */
export function pairExecutionsFIFO(executions: RawExecution[]): {
  groupedTrades: GroupedTradePreview[];
  openPositionsCount: number;
} {
  // Sort executions strictly chronologically
  const sorted = [...executions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Group by ticker
  const tickerMap: Record<string, RawExecution[]> = {};
  sorted.forEach(exec => {
    if (!tickerMap[exec.ticker]) tickerMap[exec.ticker] = [];
    tickerMap[exec.ticker].push(exec);
  });

  const groupedTrades: GroupedTradePreview[] = [];
  let openPositionsCount = 0;

  // Process each ticker independently
  Object.keys(tickerMap).forEach(ticker => {
    const execs = tickerMap[ticker];
    const inventory: OpenLot[] = [];

    execs.forEach(exec => {
      let remainingQty = exec.quantity;
      const execFeePerUnit = exec.fees / exec.quantity;

      // Check if there is opposing inventory to close
      while (inventory.length > 0 && remainingQty > 0) {
        const lot = inventory[0];

        // Same side? Cannot close, stop matching
        if (lot.side === exec.side) {
          break;
        }

        // Opposing side found! Close a portion or all of this lot
        const matchedQty = Math.min(lot.qty, remainingQty);
        const lotFeePortion = (lot.fees / (lot.qty || 1)) * matchedQty;
        const execFeePortion = execFeePerUnit * matchedQty;
        const totalTradeFees = Math.round((lotFeePortion + execFeePortion) * 100) / 100;

        // Long trade: Opened with BUY, closed with SELL
        // Short trade: Opened with SELL, closed with BUY
        const isLong = lot.side === 'BUY';
        const direction: 'long' | 'short' = isLong ? 'long' : 'short';
        const entryPrice = lot.price;
        const exitPrice = exec.price;

        // Calculate PnL with multiplier engine
        const pnlRes = calculatePnL({
          direction,
          entryPrice,
          exitPrice,
          size: matchedQty,
          ticker,
          commissions: totalTradeFees
        });

        const status: 'win' | 'loss' | 'breakeven' = 
          pnlRes.pnl > 0 ? 'win' : pnlRes.pnl < 0 ? 'loss' : 'breakeven';

        const marketType = getMarketTypeFromTicker(ticker);

        const openTimeFormatted = new Date(lot.timestamp).toLocaleTimeString('en-US', { hour12: false });
        const closeTimeFormatted = new Date(exec.timestamp).toLocaleTimeString('en-US', { hour12: false });

        groupedTrades.push({
          id: `rt-${ticker}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          ticker,
          marketType,
          direction,
          entryPrice,
          exitPrice,
          positionSize: matchedQty,
          tradeDate: exec.tradeDate, // Close date is standard institutional recognition date
          entryTime: openTimeFormatted,
          exitTime: closeTimeFormatted,
          pnl: pnlRes.pnl,
          grossPnl: pnlRes.grossPnl,
          pointsGained: pnlRes.pointsGained,
          ticksGained: pnlRes.ticksGained,
          fees: totalTradeFees,
          status,
          multiplier: pnlRes.multiplierUsed,
          notes: `Auto-synchronized via Broker Sync. Matched entry @ ${entryPrice.toFixed(2)} (${openTimeFormatted}) with exit @ ${exitPrice.toFixed(2)} (${closeTimeFormatted}).`,
          tags: ['#Broker_Sync', `#${ticker}`, isLong ? '#Long_Position' : '#Short_Position']
        });

        // Deduct from lot and incoming exec
        lot.qty -= matchedQty;
        remainingQty -= matchedQty;

        // Remove lot if fully filled
        if (lot.qty <= 0.00001) {
          inventory.shift();
        }
      }

      // If quantity still remains, add as open lot in inventory
      if (remainingQty > 0.00001) {
        inventory.push({
          side: exec.side,
          qty: remainingQty,
          price: exec.price,
          timestamp: exec.timestamp,
          tradeDate: exec.tradeDate,
          fees: execFeePerUnit * remainingQty,
          rawSymbol: exec.rawSymbol
        });
      }
    });

    openPositionsCount += inventory.reduce((acc, lot) => acc + lot.qty, 0);
  });

  // Sort grouped trades newest first
  groupedTrades.sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());

  return { groupedTrades, openPositionsCount };
}

/**
 * Universal broker CSV parsing pipeline
 */
export function parseBrokerCSV(csvContent: string): ParseResult {
  const { executions, errors } = parseRawExecutions(csvContent);

  if (executions.length === 0) {
    return {
      success: false,
      rawExecutionsCount: 0,
      groupedTrades: [],
      openPositionsCount: 0,
      totalProjectedPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      errors: errors.length > 0 ? errors : ['No valid execution records found in CSV file. Check column headers.']
    };
  }

  const { groupedTrades, openPositionsCount } = pairExecutionsFIFO(executions);

  const totalProjectedPnl = Math.round(groupedTrades.reduce((acc, t) => acc + t.pnl, 0) * 100) / 100;
  const grossProfit = Math.round(groupedTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0) * 100) / 100;
  const grossLoss = Math.round(Math.abs(groupedTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0)) * 100) / 100;

  const winCount = groupedTrades.filter(t => t.status === 'win').length;
  const lossCount = groupedTrades.filter(t => t.status === 'loss').length;
  const winRate = groupedTrades.length > 0 ? Math.round((winCount / groupedTrades.length) * 1000) / 10 : 0;

  return {
    success: groupedTrades.length > 0,
    rawExecutionsCount: executions.length,
    groupedTrades,
    openPositionsCount,
    totalProjectedPnl,
    grossProfit,
    grossLoss,
    winCount,
    lossCount,
    winRate,
    errors
  };
}

/**
 * Converts a GroupedTradePreview into the exact database schema format for Supabase
 */
export function mapPreviewToTradePayload(
  preview: GroupedTradePreview, 
  userId: string
): Omit<Trade, 'id'> {
  return {
    user_id: userId,
    ticker: preview.ticker,
    market_type: preview.marketType,
    entry_price: preview.entryPrice,
    exit_price: preview.exitPrice,
    position_size: preview.positionSize,
    direction: preview.direction,
    status: preview.status,
    pnl: preview.pnl,
    fees: preview.fees,
    trade_date: preview.tradeDate,
    notes: preview.notes,
    tags: preview.tags,
    size_type: 'Contracts',
    created_at: new Date().toISOString()
  };
}

/**
 * Generates sample Tradovate/NinjaTrader CSV data for rapid testing
 */
export function generateSampleTradovateCSV(): string {
  const today = new Date().toISOString().split('T')[0];
  return `Timestamp,Contract,Action,Price,Quantity,Fee,OrderId
${today} 09:32:15,MNQU4,Buy,20140.25,2,1.24,TRD-9001
${today} 09:38:40,MNQU4,Sell,20165.50,2,1.24,TRD-9002
${today} 10:05:10,MESU4,Sell,5682.50,1,1.40,TRD-9003
${today} 10:14:22,MESU4,Buy,5674.25,1,1.40,TRD-9004
${today} 11:20:05,MNQU4,Buy,20185.00,4,2.48,TRD-9005
${today} 11:25:30,MNQU4,Sell,20172.25,4,2.48,TRD-9006
${today} 13:45:12,NQ 09-24,Buy,20210.00,1,2.50,TRD-9007
${today} 14:02:45,NQ 09-24,Sell,20235.00,1,2.50,TRD-9008
${today} 14:30:00,MNQU4,Buy,20220.50,2,1.24,TRD-9009
${today} 14:48:15,MNQU4,Sell,20252.75,2,1.24,TRD-9010
${today} 15:10:30,CL 08-24,Buy,78.40,1,2.10,TRD-9011
${today} 15:25:50,CL 08-24,Sell,79.15,1,2.10,TRD-9012`;
}
