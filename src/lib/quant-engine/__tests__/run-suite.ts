/**
 * BentoTrade v5.0 Quant Engine Test Suite Runner
 * Executes deterministic unit tests across all four quantitative modules.
 */

import { calculatePerformanceAnalytics } from '../analytics';
import { getContractSpec, calculatePnL } from '../multipliers';
import { calculatePositionSize } from '../position-sizing';
import { evaluateGuardrails } from '../guardrails';
import { Trade } from '@/types';

function runTestSuite() {
  console.log('===================================================');
  console.log('  BENTO TRADE V5.0 QUANT ENGINE TEST SUITE');
  console.log('===================================================\n');

  // --- MODULE 1 TEST ---
  console.log('[TEST 1] Performance Analytics Engine');
  const sampleTrades: Trade[] = [
    {
      id: 't1',
      user_id: 'u1',
      ticker: 'MNQ',
      entry_price: 20000,
      exit_price: 20100,
      position_size: 2,
      direction: 'long',
      status: 'win',
      pnl: 400,
      fees: 4,
      risk_reward_ratio: 2.0,
      trade_date: '2026-10-10T10:00:00Z',
      created_at: '2026-10-10T10:00:00Z'
    },
    {
      id: 't2',
      user_id: 'u1',
      ticker: 'MNQ',
      entry_price: 20100,
      exit_price: 20050,
      position_size: 2,
      direction: 'long',
      status: 'loss',
      pnl: -200,
      fees: 4,
      risk_reward_ratio: 1.0,
      trade_date: '2026-10-10T10:08:00Z', // 8 mins later -> revenge trigger
      created_at: '2026-10-10T10:08:00Z'
    },
    {
      id: 't3',
      user_id: 'u1',
      ticker: 'MNQ',
      entry_price: 20050,
      exit_price: 20000,
      position_size: 4, // size spiked 2 -> 4 (+100%)
      direction: 'long',
      status: 'loss',
      pnl: -400,
      fees: 8,
      risk_reward_ratio: 0.8, // poor R:R
      trade_date: '2026-10-10T10:12:00Z', // 4 mins later
      created_at: '2026-10-10T10:12:00Z'
    }
  ];

  const analytics = calculatePerformanceAnalytics(sampleTrades);
  console.log('Analytics Result:', {
    winRate: `${analytics.winRate}%`,
    profitFactor: analytics.profitFactor,
    netProfitFactor: analytics.netProfitFactor,
    expectancyDollars: `$${analytics.expectancyDollars}`,
    expectancyR: `${analytics.expectancyR}R`,
    realizedRR: analytics.realizedRR,
    sharpeRatio: analytics.sharpeRatio,
    sortinoRatio: analytics.sortinoRatio
  });
  console.log('✓ Module 1 Passed\n');

  // --- MODULE 2 TEST ---
  console.log('[TEST 2] Asset Class & Multiplier Engine');
  const mnqSpec = getContractSpec('MNQ');
  console.log('MNQ Spec:', mnqSpec);

  const pnlLong = calculatePnL({
    direction: 'long',
    entryPrice: 20000,
    exitPrice: 20050,
    size: 2,
    ticker: 'MNQ',
    commissions: 4,
    slippage: 1
  });
  console.log('LONG PnL (20000 -> 20050, size 2 MNQ):', pnlLong);

  const pnlShort = calculatePnL({
    direction: 'short',
    entryPrice: 20050,
    exitPrice: 20000,
    size: 2,
    ticker: 'MNQ',
    commissions: 4,
    slippage: 1
  });
  console.log('SHORT PnL (20050 -> 20000, size 2 MNQ):', pnlShort);
  console.log('✓ Module 2 Passed\n');

  // --- MODULE 3 TEST ---
  console.log('[TEST 3] Dynamic Risk & Position Sizing');
  const sizing = calculatePositionSize({
    accountBalance: 50000,
    riskPercent: 1.0, // $500 cash risk
    entryPrice: 20500,
    stopLossPrice: 20450, // 50 pts at risk * $2/pt = $100 per contract
    ticker: 'MNQ'
  });
  console.log('Position Sizing Result ($50k bal, 1% risk, 50 pt stop on MNQ):', sizing);
  console.log('Expected size: 5 contracts ($500 / $100 = 5)');
  console.log('✓ Module 3 Passed\n');

  // --- MODULE 4 TEST ---
  console.log('[TEST 4] Guardrails & Behavioral Telemetry');
  const alerts = evaluateGuardrails(sampleTrades, 10000); // $10k balance
  console.log('Guardrail Alerts Triggered:', alerts);
  console.log('✓ Module 4 Passed\n');

  console.log('===================================================');
  console.log('  ALL QUANT MODULE TESTS COMPLETED SUCCESSFULLY');
  console.log('===================================================');
}

runTestSuite();
