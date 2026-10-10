/**
 * BentoTrade v5.5 Subscription Monetization Types & Schema
 * Includes 7-Day Stripe Free Trial lifecycle & AI Token Quotas
 */

export type SubscriptionTier = 'basic' | 'pro' | 'ultra';

export type BillingCycle = 'monthly' | 'annual';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface PlanFeature {
  title: string;
  included: boolean;
  tooltip?: string;
  highlighted?: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  badge?: string;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  isPopular?: boolean;
}

export interface UserSubscriptionState {
  currentTier: SubscriptionTier;
  billingCycle: BillingCycle;
  quotaUsed: number;
  quotaTotal: number; // e.g., 25 for Basic, 250 for Pro, 999999 for Ultra
  renewsAt: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  daysRemainingInTrial?: number;
}

export interface TierCapabilities {
  maxAiRequestsPerMonth: number;
  hasMonteCarlo: boolean;
  hasDeepDiagnostics: boolean;
  hasLiveFlow: boolean;
  hasCandlestickChart: boolean;
  hasWebhookIntegrations: boolean;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro';
}
