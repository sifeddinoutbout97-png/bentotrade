/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Journal } from '@/pages/Journal';
import { JournalHistory } from '@/pages/JournalHistory';
import { AiInsights } from '@/pages/AiInsights';
import { Analytics } from '@/pages/Analytics';
import Settings from '@/pages/Settings';
import { Login } from '@/pages/Login';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { MarketPulse } from '@/pages/MarketPulse';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/lib/auth';
import { TradeProvider } from '@/context/TradeContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Ghost, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { SystemBroadcastListener } from '@/components/SystemBroadcastListener';
import { SuspensionGuard } from '@/components/SuspensionGuard';

import { BentoCommandPalette } from '@/components/BentoCommandPalette';

const SystemWrapper = ({ children }: { children: React.ReactNode }) => {
  const { exitGhostMode, impersonatingUserId } = useAuth();

  return (
    <div className="min-h-screen flex flex-col relative">
      <SystemBroadcastListener />
      <BentoCommandPalette />
      {children}
      
      {/* Ghost Mode Global Banner */}
      {impersonatingUserId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="bg-zinc-900 border border-purple-500/30 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Ghost size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[1em] text-purple-400 opacity-80">Ghost Protocol active</span>
              <span className="text-xs font-bold">Trading Terminal: {impersonatingUserId.substring(0, 16).toUpperCase()}</span>
            </div>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exitGhostMode}
              className="h-8 rounded-lg hover:bg-white/5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white"
            >
              <LogOut size={12} className="mr-2" />
              Terminate Ghost
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isLoading } = useAuth();
  const isAuthLoading = loading ?? isLoading ?? false;

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading, isLoading } = useAuth();
  const isAuthLoading = loading ?? isLoading ?? false;

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isFullHeightPage = location.pathname === '/admin';

  return (
    <DashboardLayout fullHeight={isFullHeightPage}>
      {children}
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <TradeProvider>
            <SuspensionGuard>
              <SystemWrapper>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route 
                    path="/*" 
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/dashboard" element={<Navigate to="/" replace />} />
                            <Route path="/journal" element={<Journal />} />
                            <Route path="/journal-history" element={<JournalHistory />} />
                            <Route path="/ai-insights" element={<AiInsights />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/market-pulse" element={<MarketPulse />} />
                            <Route path="/pulse" element={<Navigate to="/market-pulse" replace />} />
                            <Route path="/ai-chat" element={<Navigate to="/ai-insights" replace />} />
                            <Route path="/chat" element={<Navigate to="/ai-insights" replace />} />
                            <Route path="/insights" element={<Navigate to="/ai-insights" replace />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/admin" element={
                              <AdminRoute>
                                <AdminDashboard />
                              </AdminRoute>
                            } />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </AppLayout>
                      </ProtectedRoute>
                    } 
                  />
                </Routes>
                <Toaster position="bottom-right" />
              </SystemWrapper>
            </SuspensionGuard>
          </TradeProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
