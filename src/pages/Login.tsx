/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, ArrowLeft, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BTLogo } from '@/components/ui/BTLogo';
import { useAuth } from '@/lib/auth';

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  const navigate = useNavigate();
  const { signInWithGoogle, user } = useAuth();

  // If already authenticated via Supabase, route straight to dashboard
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    if (mode === 'signin') {
      if (!password) {
        // Fallback to magic link if password is not supplied
        handleMagicLink();
        return;
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Supabase signIn error:', error);
          throw error;
        }

        if (data.session) {
          toast.success('Terminal session established');
          navigate('/', { replace: true });
        }
      } catch (error: any) {
        console.error('Sign-in failed:', error);
        toast.error(error.message || 'Authentication failed. Please verify credentials.');
      } finally {
        setLoading(false);
      }
    } else {
      // Create Account (Sign up)
      if (!password || password.length < 6) {
        toast.error('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          console.error('Supabase signUp error:', error);
          throw error;
        }

        if (data.session) {
          toast.success('Account created and session authenticated.');
          navigate('/', { replace: true });
        } else {
          setMailSent(true);
          toast.success('Confirmation email dispatched.');
        }
      } catch (error: any) {
        console.error('Account creation failed:', error);
        toast.error(error.message || 'Account creation failed');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Please specify an email address first.');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('Supabase signInWithOtp error:', error);
        throw error;
      }

      setMailSent(true);
      toast.success('Access link dispatched to your email.');
    } catch (error: any) {
      console.error('Magic link dispatch error:', error);
      toast.error(error.message || 'Failed to dispatch magic link.');
    } finally {
      setLoading(false);
    }
  };

  if (mailSent) {
    return (
      <div className="min-h-screen h-screen w-full bg-[#050505] text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
            <Mail className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              DISPATCH_STATUS // SENT
            </div>
            <h1 className="text-xl font-mono uppercase tracking-widest text-zinc-100 font-light">
              Check Your Inbox
            </h1>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              An authentication dispatch has been transmitted to <span className="text-zinc-200 font-medium">{email}</span>. Click the link to complete verification.
            </p>
          </div>
          <button 
            onClick={() => setMailSent(false)}
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors mx-auto"
          >
            <ArrowLeft size={13} />
            Return to authentication
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen w-full bg-[#050505] text-zinc-100 grid grid-cols-1 lg:grid-cols-2 overflow-hidden selection:bg-zinc-800 selection:text-white">
      {/* 1. Left Column: Marketing & Institutional Telemetry Showcase (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 relative bg-zinc-950 border-r border-white/[0.05] overflow-hidden">
        {/* Faint Dark Emerald Radial Gradient */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_65%_at_15%_10%,rgba(16,185,129,0.07),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_85%_90%,rgba(16,185,129,0.03),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,rgba(5,5,5,0.8)_100%)]" />

        {/* Brand / Logo Top */}
        <div className="flex items-center gap-3 relative z-10">
          <BTLogo size="md" />
          <div>
            <div className="text-xs font-mono font-semibold tracking-wider text-white flex items-center gap-2">
              BENTOTRADE <span className="text-zinc-600 font-normal">v5 PRO</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              QUANTITATIVE EXECUTION TERMINAL
            </div>
          </div>
        </div>

        {/* Center: Value Proposition & Core Engine Pillars */}
        <div className="space-y-7 relative z-10 my-auto max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] font-mono tracking-widest text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse" />
              SYSTEM_READY // REVISION_5.0
            </div>
            <h1 className="text-2xl xl:text-3xl font-mono uppercase tracking-widest text-zinc-100 leading-snug font-light">
              Institutional edge, calibrated for the retail tape.
            </h1>
            <p className="text-xs text-zinc-500 font-mono tracking-wide leading-relaxed">
              Professional execution telemetry, variance decomposition, and post-trade mathematical diagnostics built for disciplined operators.
            </p>
          </div>

          {/* 3 Minimal Feature Points */}
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <span className="text-[10px] font-mono text-zinc-600 mt-0.5">01</span>
              <div className="space-y-0.5">
                <div className="text-xs font-mono text-zinc-300 font-medium">AI Performance Engine</div>
                <div className="text-[11px] font-mono text-zinc-500">Active execution calibration & expectancy tracking.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <span className="text-[10px] font-mono text-zinc-600 mt-0.5">02</span>
              <div className="space-y-0.5">
                <div className="text-xs font-mono text-zinc-300 font-medium">Advanced Telemetry</div>
                <div className="text-[11px] font-mono text-zinc-500">MFE/MAE excursion analysis and Monte Carlo diagnostics.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <span className="text-[10px] font-mono text-zinc-600 mt-0.5">03</span>
              <div className="space-y-0.5">
                <div className="text-xs font-mono text-zinc-300 font-medium">Risk Architecture</div>
                <div className="text-[11px] font-mono text-zinc-500">Automated fractional Kelly position sizing.</div>
              </div>
            </div>
          </div>

          {/* Plan Preview (Abonnement) */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-zinc-500 uppercase">
              <span>Available Tiers</span>
              <span className="text-[10px] text-zinc-600">TRANSPARENT LICENSING</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Free Tier */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-zinc-200">V5 Core</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.08]">STANDARD</span>
                </div>
                <div className="text-sm font-mono text-zinc-300 font-medium">Free</div>
                <div className="text-[10px] font-mono text-zinc-600 line-clamp-1">Full journal & core stats</div>
              </div>

              {/* Pro Tier */}
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-emerald-400">Ultra Institutional</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PRO</span>
                </div>
                <div className="text-sm font-mono text-zinc-100 font-medium">
                  $99 <span className="text-[10px] text-zinc-500 font-normal">/ mo</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 line-clamp-1">Full MFE/MAE & Monte Carlo</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Terminal Watermark at Bottom */}
        <div className="flex items-center gap-2 text-[11px] font-mono tracking-widest text-zinc-500 pt-6 border-t border-white/[0.05] relative z-10">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
          <span>● SYSTEM OPERATIONAL // LATENCY 14MS // NYC-EQUINIX-NY4</span>
        </div>
      </div>

      {/* 2. Right Column: Authentication Panel */}
      <div className="bg-[#050505] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 relative overflow-y-auto min-h-screen">
        {/* Mobile Header / Top Bar */}
        <div className="flex items-center justify-between w-full">
          <div className="lg:hidden flex items-center gap-2.5">
            <BTLogo size="sm" />
            <div className="text-xs font-mono font-semibold tracking-wider text-white">
              BENTOTRADE <span className="text-zinc-600 font-normal">v5</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase ml-auto">
            TERMINAL_GATEWAY // AUTH
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-8 space-y-6">
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
              {mode === 'signin' ? 'SECURE_ACCESS_PORTAL' : 'INITIALIZE_OPERATOR'}
            </div>
            <h2 className="text-xl sm:text-2xl font-mono uppercase tracking-widest text-zinc-100 font-light">
              {mode === 'signin' ? 'Terminal Sign In' : 'Create Desk Account'}
            </h2>
            <p className="text-xs text-zinc-500 font-mono tracking-wide leading-relaxed">
              {mode === 'signin' 
                ? 'Authenticate your operator credentials to mount your workspace.' 
                : 'Configure a dedicated journal instance with quantitative metrics.'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Google OAuth via Supabase */}
            <Button 
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-11 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/20 rounded-lg font-mono text-xs tracking-wider transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] flex items-center justify-center"
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            {/* Subtle Divider */}
            <div className="relative py-1 flex items-center">
              <div className="flex-grow border-t border-white/[0.06]"></div>
              <span className="flex-shrink mx-3 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                OR EMAIL CREDENTIALS
              </span>
              <div className="flex-grow border-t border-white/[0.06]"></div>
            </div>

            {/* Credential Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                  Operator Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-600" />
                  <Input
                    type="email"
                    placeholder="trader@desk.terminal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-white/[0.03] border border-white/10 text-white placeholder-zinc-600 focus:border-zinc-500 rounded-lg pl-10 font-mono text-xs tracking-wide shadow-none focus-visible:ring-0 focus-visible:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                    Password {mode === 'signin' && <span className="text-zinc-600">(optional for OTP)</span>}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={loading || !email}
                      className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                    >
                      Send Magic Link
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-600" />
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-white/[0.03] border border-white/10 text-white placeholder-zinc-600 focus:border-zinc-500 rounded-lg pl-10 font-mono text-xs tracking-wide shadow-none focus-visible:ring-0 focus-visible:border-zinc-400"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-white/10 hover:bg-white/15 text-zinc-100 border border-white/10 tracking-widest text-xs uppercase font-mono font-medium rounded-lg transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-ping" />
                    AUTHENTICATING...
                  </span>
                ) : (
                  <>
                    <span>{mode === 'signin' ? 'Sign In To Terminal' : 'Create Desk Account'}</span>
                    <ArrowRight size={14} className="text-zinc-400" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle Sign In / Create Account */}
            <div className="pt-2 text-center text-xs font-mono">
              <span className="text-zinc-500">
                {mode === 'signin' ? "Need desk authorization? " : "Already registered on terminal? "}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-zinc-400 hover:text-zinc-200 underline underline-offset-4 tracking-wider transition-colors"
              >
                {mode === 'signin' ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Security / System Details */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-zinc-600 tracking-wider gap-2 pt-6 border-t border-white/[0.04] w-full">
          <span>ENCRYPTED VIA SUPABASE RLS // TLS 1.3</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-zinc-400 transition-colors cursor-pointer">TERMS</span>
            <span>//</span>
            <span className="hover:text-zinc-400 transition-colors cursor-pointer">PRIVACY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
