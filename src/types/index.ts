/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TradeStatus = 'win' | 'loss' | 'breakeven' | 'open';
export type TradeDirection = 'long' | 'short';
export type MarketType = 'futures' | 'forex' | 'crypto' | 'equities' | 'options';
export type RiskLevel = 'LOW' | 'ELEVATED' | 'CRITICAL';
export type ExecutionGrade = 'A+' | 'A' | 'B+' | 'B' | 'C';

export interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  market_type?: MarketType | string;
  entry_price: number;
  exit_price?: number;
  stop_loss?: number;
  trade_date: string;
  position_size: number;
  direction: TradeDirection;
  status: TradeStatus;
  pnl: number;
  fees?: number;
  size_type?: string;
  risk_reward_ratio?: number;
  notes?: string;
  image_urls?: string[];
  ai_analysis?: string;
  created_at: string;
}

export type TradeData = Trade;

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
}

export interface TradeAnalysis {
  executionRating: ExecutionGrade;
  ratingScore: number;
  summary: string;
  behavioralFlags: string[];
  riskBreakdown: {
    riskRewardRatio: number;
    slippageRisk: string;
    positionSizingAssessment: string;
    ruleAdherence: string;
  };
  recommendations: string[];
  efficiencyScore: number;
}

export interface CalendarEvent {
  calendar_id?: string;
  id?: string;
  event: string;
  country: string;
  currency: string;
  impact: string;
  time: string;
  estimate: number | null;
  actual: number | null;
  prev: number | null;
  unit?: string;
}

export interface VolatilityCorridor {
  asset: string;
  expectedMove: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE' | 'NEUTRAL';
  recommendation: string;
}

export interface ActionableWindow {
  timeframe: string;
  event: string;
  status: 'PRE_RELEASE' | 'LIVE_EXECUTION' | 'POST_SETTLEMENT';
  guidance: string;
}

export interface MarketPulseSummary {
  riskLevel: 'LOW' | 'ELEVATED' | 'CRITICAL';
  headline: string;
  briefing: string;
  volatilityCorridors: VolatilityCorridor[];
  actionableWindows: ActionableWindow[];
  keyRisks: string[];
  timestamp: string;
}

export interface CandlestickData {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface DrawdownResult {
  maxDrawdown: number;
  peakIndex: number;
  valleyIndex: number;
  maxDrawdownPct: number;
}

export interface WinLossStreakInfo {
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  maxWinStreak?: number;
  maxLossStreak?: number;
}

export interface QuantMetricsData {
  sharpeRatio: number;
  maxDrawdown: DrawdownResult;
  profitFactor: number;
  executionEfficiency: number;
  winRate: number;
  expectancy: number;
  winLossStreaks: WinLossStreakInfo;
  riskOfRuin: number;
  totalTrades: number;
  totalPnL: number;
}

export interface MonteCarloSimulationParams {
  trades?: TradeData[];
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
  initialCapital?: number;
  riskPerTradePct?: number;
  simulations?: number;
  tradesPerSimulation?: number;
  ruinThresholdPct?: number;
}

export interface MonteCarloSimulationResult {
  simulationsRun: number;
  tradesPerPath: number;
  riskOfRuinPct: number;
  medianFinalEquity: number;
  tenthPercentileEquity: number;
  ninetiethPercentileEquity: number;
  worstMaxDrawdownPct: number;
  samplePaths: Array<{ index: number; equity: number }[]>;
}

export type QuantWorkerTaskType = 
  | 'CALCULATE_SHARPE'
  | 'CALCULATE_MAX_DRAWDOWN'
  | 'RUN_MONTE_CARLO';

export interface QuantWorkerRequest {
  id: string;
  type: QuantWorkerTaskType;
  payload: any;
}

export interface QuantWorkerResponse {
  id: string;
  type: QuantWorkerTaskType;
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs?: number;
}
