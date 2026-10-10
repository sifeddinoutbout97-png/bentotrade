import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Minus, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Crown, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { 
  SubscriptionTier, 
  BillingCycle, 
  SubscriptionPlan 
} from '../types/subscription';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  onSelectPlan: (tier: SubscriptionTier, cycle: BillingCycle) => Promise<void>;
  isLoading?: boolean;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 19,
    priceAnnual: 15,
    badge: 'Developing Traders',
    description: 'Essential journaling and post-trade analytics for building foundational discipline.',
    buttonText: 'Get Basic',
    features: [
      { title: '25 AI Trade Audits / Month', included: true },
      { title: 'Standard Trade & PnL Journal', included: true },
      { title: 'End-of-Day Quant Analytics', included: true },
      { title: 'Gemini Flash Engine Telemetry', included: true },
      { title: 'Interactive Candlestick Blueprint', included: false },
      { title: '10,000-Path Monte Carlo Engine', included: false },
      { title: 'Live Institutional QQQ Flow Corridors', included: false },
      { title: 'Zero-Latency Webhook Routing', included: false }
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceAnnual: 39,
    badge: 'MOST POPULAR',
    isPopular: true,
    description: 'High-speed quant analysis and real-time execution blueprints for active intraday traders.',
    buttonText: 'Start 7-Day Free Trial (Pro)',
    features: [
      { title: '250 AI Trade Audits / Month', included: true, highlighted: true },
      { title: 'Interactive Candlestick Execution Chart', included: true, highlighted: true },
      { title: '10,000-Path Monte Carlo Risk Simulation', included: true, highlighted: true },
      { title: 'Automated Real-Time Risk Alerts', included: true },
      { title: 'Execution Letter Grade Diagnostics (A+ to C)', included: true },
      { title: 'Full Historical Journal Virtualization', included: true },
      { title: 'Live Institutional QQQ Flow Corridors', included: false },
      { title: 'Zero-Latency Webhook Routing', included: false }
    ]
  },
  {
    id: 'ultra',
    name: 'Ultra',
    priceMonthly: 99,
    priceAnnual: 79,
    badge: 'INSTITUTIONAL',
    description: 'Uncapped compute power and order-flow correlations for professional funds and quant scalpers.',
    buttonText: 'Go Institutional Ultra',
    features: [
      { title: 'Unlimited AI Trade Reviews & Consultations', included: true, highlighted: true },
      { title: 'Gemini 1.5 Pro Deep Post-Mortems', included: true, highlighted: true },
      { title: 'Live Institutional QQQ Order Flow & Corridors', included: true, highlighted: true },
      { title: 'Zero-Latency Webhook Execution Ingestion', included: true },
      { title: 'Priority 24/7 Quantitative Terminal Uplink', included: true },
      { title: 'Custom Ruin Threshold & Volatility Envelopes', included: true },
      { title: 'Multi-Asset Correlation Matrix', included: true },
      { title: 'Dedicated Quant Engineering Desk', included: true }
    ]
  }
];

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onSelectPlan,
  isLoading = false
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    try {
      await onSelectPlan(tier, billingCycle);
    } finally {
      setSelectedTier(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200">
      {/* Background click to dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-6xl my-auto rounded-[2.5rem] bg-gray-950/95 border border-zinc-800 text-white shadow-2xl p-6 sm:p-8 md:p-10 relative overflow-hidden">
        {/* Ambient glow effects */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold uppercase tracking-widest">
            <Sparkles size={14} />
            <span>Institutional Terminal Licensing</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            Supercharge Your <span className="text-primary">Quantitative Edge</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 font-medium">
            Select a tier tailored to your execution frequency. All premium plans include a <strong>7-Day Free Institutional Trial</strong> with instant card setup via Stripe.
          </p>

          {/* Stripe 7-Day Free Trial Notice Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
            <ShieldCheck size={14} />
            <span>7-Day Free Trial Included • Cancel Anytime with 1-Click</span>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="pt-2 flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                  billingCycle === 'monthly'
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  billingCycle === 'annual'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <span>Annually</span>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-black/20 text-white">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3-Column Bento Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
            const isPro = plan.id === 'pro';
            const isUltra = plan.id === 'ultra';

            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative backdrop-blur-xl group",
                  // Card border styling based on tier
                  isPro 
                    ? "bg-gradient-to-b from-emerald-950/20 via-zinc-900/60 to-zinc-950/80 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 md:-translate-y-2" 
                    : isUltra 
                    ? "bg-gradient-to-b from-indigo-950/25 via-zinc-900/60 to-zinc-950/80 border border-indigo-500/40 shadow-xl shadow-indigo-500/10" 
                    : "bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700"
                )}
              >
                {/* Header Badge */}
                {plan.badge && (
                  <div className="mb-4 flex items-center justify-between">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      isPro 
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse" 
                        : isUltra 
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" 
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {plan.badge}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                        Active Plan
                      </span>
                    )}
                  </div>
                )}

                <div>
                  {/* Plan Name & Description */}
                  <h3 className="text-2xl font-black tracking-tight text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px] mb-6">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-6 pb-6 border-b border-white/5 font-mono">
                    <span className="text-4xl sm:text-5xl font-black text-white">
                      ${price}
                    </span>
                    <span className="text-xs text-zinc-400 uppercase tracking-wider font-sans">
                      / month
                    </span>
                    {billingCycle === 'annual' && (
                      <span className="text-[11px] text-zinc-400 ml-auto font-sans font-medium">
                        Billed annually (${price * 12}/yr)
                      </span>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs leading-relaxed">
                        {feat.included ? (
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            isPro ? "text-emerald-400" : isUltra ? "text-indigo-400" : "text-primary"
                          )}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-zinc-600 mt-0.5">
                            <X size={13} strokeWidth={2.5} />
                          </div>
                        )}
                        <span className={cn(
                          feat.included 
                            ? feat.highlighted 
                              ? "font-bold text-white" 
                              : "text-zinc-300 font-medium" 
                            : "text-zinc-600 line-through"
                        )}>
                          {feat.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Call-to-Action Button */}
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || isLoading}
                  className={cn(
                    "w-full h-12 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg",
                    isCurrent
                      ? "bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700"
                      : isPro
                      ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/25"
                      : isUltra
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 text-white shadow-indigo-500/25"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  )}
                >
                  {isLoading && selectedTier === plan.id ? (
                    <span className="animate-pulse">Authorizing Terminal...</span>
                  ) : isCurrent ? (
                    'Current Active Plan'
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>{plan.buttonText}</span>
                      <ArrowRight size={14} />
                    </span>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Security & Guarantee Footer */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Encrypted Stripe Checkout • Cancel Anytime with 1-Click</span>
          </div>
          <div>BentoTrade AI v5.5 Institutional Engine</div>
        </div>
      </div>
    </div>
  );
};
