import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  SubscriptionTier, 
  BillingCycle, 
  UserSubscriptionState,
  SubscriptionStatus
} from '../types/subscription';
import { TIER_LIMITS, canExecuteAiPrompt } from '../utils/tierGuard';
import { toast } from 'sonner';

const STORAGE_KEY = 'bentotrade_sub_state_v5_5';

// Default trial: 7-Day evaluation period on Pro
const calculateTrialPeriod = () => {
  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    trialEndsAt: trialEnds.toISOString(),
    daysRemainingInTrial: 7
  };
};

const defaultTrial = calculateTrialPeriod();

const DEFAULT_SUB_STATE: UserSubscriptionState = {
  currentTier: 'pro',
  billingCycle: 'monthly',
  quotaUsed: 12,
  quotaTotal: 250,
  renewsAt: defaultTrial.trialEndsAt,
  status: 'trialing',
  trialEndsAt: defaultTrial.trialEndsAt,
  daysRemainingInTrial: defaultTrial.daysRemainingInTrial
};

export function useSubscription() {
  const [subState, setSubState] = useState<UserSubscriptionState>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.trialEndsAt) {
            const diff = new Date(parsed.trialEndsAt).getTime() - Date.now();
            parsed.daysRemainingInTrial = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            if (parsed.daysRemainingInTrial === 0 && parsed.status === 'trialing') {
              parsed.status = 'active';
            }
          }
          return parsed;
        }
      } catch (e) {
        // Fall back to default
      }
    }
    return DEFAULT_SUB_STATE;
  });

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state to local cache
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subState));
    }
  }, [subState]);

  // Load from Supabase user metadata or profile
  useEffect(() => {
    let isMounted = true;
    async function syncCloudSubscription() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !isMounted) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier, subscription_status, quota_used, quota_total, billing_cycle, created_at')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && isMounted) {
          const tier = (profile.subscription_tier as SubscriptionTier) || subState.currentTier;
          const limits = TIER_LIMITS[tier] || TIER_LIMITS.pro;

          // Compute trial remaining if account was recently created
          let trialDays = 7;
          let status: SubscriptionStatus = (profile.subscription_status as SubscriptionStatus) || 'trialing';
          if (profile.created_at) {
            const ageMs = Date.now() - new Date(profile.created_at).getTime();
            trialDays = Math.max(0, 7 - Math.floor(ageMs / (1000 * 60 * 60 * 24)));
            if (trialDays === 0 && status === 'trialing') {
              status = 'active';
            }
          }

          setSubState((prev) => ({
            ...prev,
            currentTier: tier,
            billingCycle: (profile.billing_cycle as BillingCycle) || prev.billingCycle,
            status,
            quotaUsed: profile.quota_used ?? prev.quotaUsed,
            quotaTotal: profile.quota_total ?? limits.maxAiRequestsPerMonth,
            daysRemainingInTrial: trialDays
          }));
        }
      } catch (err) {
        console.warn('Subscription sync fallback to local cache:', err);
      }
    }

    syncCloudSubscription();
    return () => {
      isMounted = false;
    };
  }, []);

  const openPricingModal = useCallback(() => setIsPricingModalOpen(true), []);
  const closePricingModal = useCallback(() => setIsPricingModalOpen(false), []);

  /**
   * Upgrades subscription tier with 7-day trial or immediate Stripe activation
   */
  const upgradePlan = useCallback(async (targetTier: SubscriptionTier, cycle: BillingCycle) => {
    setLoading(true);
    try {
      const newLimits = TIER_LIMITS[targetTier];
      const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      setSubState({
        currentTier: targetTier,
        billingCycle: cycle,
        quotaUsed: 0,
        quotaTotal: newLimits.maxAiRequestsPerMonth,
        renewsAt: renewalDate,
        status: 'active',
        daysRemainingInTrial: 0
      });

      // Persist to Supabase if authenticated
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        try {
          await supabase
            .from('user_profiles')
            .upsert({
              id: user.id,
              subscription_tier: targetTier,
              subscription_status: 'active',
              quota_used: 0,
              quota_total: newLimits.maxAiRequestsPerMonth,
              billing_cycle: cycle,
              updated_at: new Date().toISOString()
            });
        } catch (e) {
          console.warn('Error persisting subscription upgrade:', e);
        }
      }

      toast.success(
        `Successfully activated BentoTrade ${targetTier.toUpperCase()} (${cycle === 'annual' ? 'Annual Billing' : 'Monthly Billing'})!`
      );
      setIsPricingModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to process subscription update. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Consumes an AI token quota. Returns true if granted and consumed.
   */
  const consumeAiToken = useCallback(async (): Promise<boolean> => {
    if (!canExecuteAiPrompt(subState)) {
      toast.error(
        `Monthly AI review quota reached for ${subState.currentTier.toUpperCase()} tier. Upgrade for expanded capacity.`
      );
      setIsPricingModalOpen(true);
      return false;
    }

    if (subState.currentTier === 'ultra') {
      return true; // Unlimited
    }

    const nextUsed = subState.quotaUsed + 1;
    setSubState((prev) => ({
      ...prev,
      quotaUsed: nextUsed
    }));

    // Async sync with Supabase
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        try {
          await supabase
            .from('user_profiles')
            .update({ quota_used: nextUsed })
            .eq('id', user.id);
        } catch (e) {
          // Ignore background sync errors
        }
      }
    });

    return true;
  }, [subState]);

  return {
    subState,
    loading,
    isPricingModalOpen,
    openPricingModal,
    closePricingModal,
    upgradePlan,
    consumeAiToken
  };
}
