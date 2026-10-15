/**
 * BentoTrade v5.0 Quant Engine - Module 3: Dynamic Risk & Position Sizing
 * Institutional risk control and contract sizing before trade entry.
 */

import { getContractSpec, ContractSpec, AssetClass } from './multipliers';

export interface PositionSizingParams {
  accountBalance: number;     // e.g. $50,000
  riskPercent: number;        // e.g. 1% -> 1.0
  entryPrice: number;         // e.g. 20,500
  stopLossPrice: number;      // e.g. 20,480
  ticker: string;
  assetClass?: AssetClass | string;
}

export interface PositionSizingResult {
  cashRiskAmount: number;        // Cash Risk Target ($)
  pointsAtRisk: number;          // Abs(Entry Price - Stop Loss Price)
  dollarRiskPerUnit: number;     // Points at Risk * Contract Multiplier
  recommendedSize: number;       // Max allowable contract size (floor)
  actualDollarRisk: number;      // Recommended Size * Dollar Risk Per Unit
  actualRiskPercent: number;     // Actual Dollar Risk / Account Balance (%)
  contractSpec: ContractSpec;    // Contract metadata and multiplier
  isExecutable: boolean;         // True if position size >= min allowable size
  warningMessage?: string;
}

/**
 * Calculates max contract/position size based on exact cash risk budget
 */
export function calculatePositionSize(params: PositionSizingParams): PositionSizingResult {
  const {
    accountBalance,
    riskPercent,
    entryPrice,
    stopLossPrice,
    ticker,
    assetClass
  } = params;

  const spec = getContractSpec(ticker, assetClass);
  const multiplier = spec.multiplier;

  const balance = Math.max(0, accountBalance || 0);
  const riskPct = Math.max(0, riskPercent || 0);
  const cashRiskAmount = Math.round((balance * (riskPct / 100) + Number.EPSILON) * 100) / 100;

  const entry = Math.max(0, entryPrice || 0);
  const stop = Math.max(0, stopLossPrice || 0);
  const pointsAtRisk = Math.round((Math.abs(entry - stop) + Number.EPSILON) * 10000) / 10000;

  const dollarRiskPerUnit = Math.round((pointsAtRisk * multiplier + Number.EPSILON) * 100) / 100;

  if (balance <= 0) {
    return {
      cashRiskAmount: 0,
      pointsAtRisk,
      dollarRiskPerUnit,
      recommendedSize: 0,
      actualDollarRisk: 0,
      actualRiskPercent: 0,
      contractSpec: spec,
      isExecutable: false,
      warningMessage: 'Account balance must be greater than $0.'
    };
  }

  if (pointsAtRisk <= 0 || dollarRiskPerUnit <= 0) {
    return {
      cashRiskAmount,
      pointsAtRisk: 0,
      dollarRiskPerUnit: 0,
      recommendedSize: 0,
      actualDollarRisk: 0,
      actualRiskPercent: 0,
      contractSpec: spec,
      isExecutable: false,
      warningMessage: 'Stop Loss price must differ from Entry price.'
    };
  }

  // Recommended size is the floor of maximum allowable units given cash risk budget
  const rawSize = cashRiskAmount / dollarRiskPerUnit;
  const recommendedSize = spec.assetClass === 'crypto' || spec.assetClass === 'forex'
    ? Math.round((rawSize + Number.EPSILON) * 100) / 100 // Allow fractional size for crypto/forex
    : Math.floor(rawSize);                               // Strict integer contracts for futures/equities

  const actualDollarRisk = Math.round((recommendedSize * dollarRiskPerUnit + Number.EPSILON) * 100) / 100;
  const actualRiskPercent = balance > 0 
    ? Math.round(((actualDollarRisk / balance) * 100 + Number.EPSILON) * 100) / 100 
    : 0;

  const isExecutable = recommendedSize > 0;
  let warningMessage: string | undefined;

  if (!isExecutable) {
    warningMessage = `Cash risk budget ($${cashRiskAmount.toFixed(2)}) is smaller than 1 unit risk ($${dollarRiskPerUnit.toFixed(2)}). Consider tightening stop loss or reducing ticker multiplier.`;
  }

  return {
    cashRiskAmount,
    pointsAtRisk,
    dollarRiskPerUnit,
    recommendedSize,
    actualDollarRisk,
    actualRiskPercent,
    contractSpec: spec,
    isExecutable,
    warningMessage
  };
}
