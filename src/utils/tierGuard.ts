/**
 * BentoTrade Tier Access & Quota Guard Utility
 */

import { SubscriptionTier, UserSubscriptionState, TierCapabilities } from '../types/subscription';

export const TIER_LIMITS: Record<SubscriptionTier, TierCapabilities> = {
  basic: {
    maxAiRequestsPerMonth: 25,
    hasMonteCarlo: false,
    hasDeepDiagnostics: false,
    hasLiveFlow: false,
    hasCandlestickChart: false,
    hasWebhookIntegrations: false,
    model: 'gemini-1.5-flash'
  },
  pro: {
    maxAiRequestsPerMonth: 250,
    hasMonteCarlo: true,
    hasDeepDiagnostics: true,
    hasLiveFlow: false,
    hasCandlestickChart: true,
    hasWebhookIntegrations: false,
    model: 'gemini-1.5-flash'
  },
  ultra: {
    maxAiRequestsPerMonth: 999999, // unlimited representation
    hasMonteCarlo: true,
    hasDeepDiagnostics: true,
    hasLiveFlow: true,
    hasCandlestickChart: true,
    hasWebhookIntegrations: true,
    model: 'gemini-1.5-pro'
  }
};

/**
 * Checks if user is eligible to execute an AI prompt based on quota and status
 */
export function canExecuteAiPrompt(userSub: UserSubscriptionState): boolean {
  if (userSub.status !== 'active') return false;
  if (userSub.currentTier === 'ultra') return true;
  return userSub.quotaUsed < userSub.quotaTotal;
}

/**
 * Checks feature access by feature key
 */
export function hasFeatureAccess(tier: SubscriptionTier, featureKey: string): boolean {
  const caps = TIER_LIMITS[tier];
  if (!caps) return false;

  switch (featureKey) {
    case 'monte_carlo':
      return caps.hasMonteCarlo;
    case 'deep_diagnostics':
      return caps.hasDeepDiagnostics;
    case 'live_flow':
      return caps.hasLiveFlow;
    case 'candlestick_chart':
      return caps.hasCandlestickChart;
    case 'webhooks':
      return caps.hasWebhookIntegrations;
    case 'unlimited_ai':
      return tier === 'ultra';
    default:
      return false;
  }
}

/**
 * Computes quota usage percentage (0 - 100)
 */
export function getQuotaPercentage(used: number, total: number): number {
  if (total <= 0 || total >= 999999) return 0;
  const pct = (used / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
