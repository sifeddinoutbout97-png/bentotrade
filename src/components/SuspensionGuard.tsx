import React from 'react';
import { useAuth } from '@/lib/auth';
import { ShieldAlert, LogOut, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

export const SuspensionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin, signOut, loading } = useAuth();

  // If we're loading, or there's no user, or user is an admin, or user is not suspended - show children
  if (loading || !user || isAdmin || profile?.status !== 'suspended') {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0c0c0c] flex items-center justify-center p-6 overflow-hidden">
      {/* Brutalist Background Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-500/20 via-transparent to-transparent" />
        <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-zinc-900 border border-red-500/30 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]"
      >
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-full bg-red-500"
          />
        </div>

        <div className="flex flex-col items-center text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 border border-dashed border-red-500/20 rounded-full"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3">
                <ShieldAlert className="text-red-500" />
                ACCOUNT_RESTRICTED_PROTOCOL
              </h1>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            </div>
            
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-medium">
              Your access to the <span className="text-white font-bold">BentoTrade Terminal</span> has been revoked by <span className="text-red-400 underline decoration-red-500/30 underline-offset-4">System Administration</span>. 
              Unauthorized access attempts are logged and reported.
            </p>
          </div>

          <div className="w-full p-6 rounded-2xl bg-zinc-800/50 border border-white/5 space-y-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Status Report</p>
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest">
              <span className="text-zinc-500">Restriction Level</span>
              <span className="text-red-500">Critical / Tier-1</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-widest">
              <span className="text-zinc-500">Protocol</span>
              <span className="text-white font-mono">{user?.id?.substring(0, 16).toUpperCase()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = 'mailto:support@bentotrade.ai'}
              className="flex-1 bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white h-12 rounded-xl uppercase text-[10px] font-black tracking-widest border-2"
            >
              Contact Support
            </Button>
            <Button 
              onClick={() => signOut()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl uppercase text-[10px] font-black tracking-widest shadow-lg shadow-red-600/20 border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Terminate Session
            </Button>
          </div>
          
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] pt-4">
            Security Core v3.5.0-BETA
          </p>
        </div>
      </motion.div>
    </div>
  );
};
