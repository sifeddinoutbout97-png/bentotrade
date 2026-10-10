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
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { BTLogo } from '@/components/ui/BTLogo';
import { useAuth } from '@/lib/auth';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

export const Login = () => {
  const [email, setEmail] = useState('');
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
      // Supabase OAuth initiates redirect or returns session
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setMailSent(true);
      toast.success('Magic link sent to your email!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (mailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa]">
        <div className="w-full max-w-[400px] p-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-white border border-[#e5e7eb] rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-sm">
            ✉️
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#37352f]">Check your inbox</h1>
            <p className="text-[#6b7280] text-[15px] leading-relaxed">
              We've sent a magic link to <span className="font-semibold text-[#37352f]">{email}</span>. 
              Click the link in the email to sign in instantly.
            </p>
          </div>
          <button 
            onClick={() => setMailSent(false)}
            className="flex items-center gap-2 text-sm font-medium text-[#37352f] hover:underline mx-auto transition-all"
          >
            <ArrowLeft size={14} />
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa]">
      <div className="w-full max-w-[400px] p-8 space-y-10 animate-in fade-in duration-700">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <BTLogo size="lg" />
          </div>
          <h1 className="text-[28px] font-bold text-[#37352f] tracking-tight">
            Sign in to BentoTrade
          </h1>
          <p className="text-[#6b7280] text-[15px]">
            Your minimal, AI-powered trading journal.
          </p>
        </div>

        <div className="space-y-4">
          {/* Continue with Google via Supabase */}
          <Button 
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-11 bg-white border-[#e5e7eb] hover:bg-[#fbfbfa] text-[#37352f] rounded-[8px] font-medium transition-all shadow-none"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-[#e5e7eb]"></div>
            <span className="flex-shrink mx-4 text-[11px] font-bold text-[#6b7280] uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-[#e5e7eb]"></div>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#6b7280]/50" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white border-[#e5e7eb] pl-10 focus-visible:ring-0 focus-visible:border-[#37352f] transition-all rounded-[8px]"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-[#37352f] hover:bg-[#37352f]/90 text-white rounded-[8px] font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Sending link...' : (
                <>
                  <Send size={16} />
                  Send Magic Link
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#6b7280] px-4 leading-relaxed">
          By continuing, you agree to BentoTrade's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};
