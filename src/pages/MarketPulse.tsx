import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Calendar as CalendarIcon, Filter, Clock, Globe, RefreshCcw, AlertTriangle, Menu, X, ArrowUpRight } from 'lucide-react';
import { useEconomicCalendar, EconomicEvent } from '@/hooks/useEconomicCalendar';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/components/ThemeProvider';
import { TemporalControl } from '@/components/TemporalControl';
import { StrategicIntelligenceUnit } from '@/components/StrategicIntelligenceUnit';
import { MarketNewsFeed } from '@/components/MarketNewsFeed';
import { Card as ShadcnCard, CardHeader as ShadcnCardHeader, CardTitle as ShadcnCardTitle, CardContent as ShadcnCardContent } from '@/components/ui/card';

const ImpactIcon = ({ impact, isPassed }: { impact: string; isPassed?: boolean }) => {
  if (isPassed) {
    return <div className="w-2.5 h-2.5 rounded-full bg-zinc-400/50 dark:bg-zinc-600/50 grayscale mx-auto" />;
  }

  switch (impact.toLowerCase()) {
    case 'high':
      return <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] mx-auto" />;
    case 'medium':
      return <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.4)] mx-auto" />;
    case 'low':
      return <div className="w-3 h-3 rounded-full bg-yellow-500 mx-auto" />;
    default:
      return <div className="w-3 h-3 rounded-full bg-zinc-400 mx-auto" />;
  }
};

const valueColor = (actual: number | null, estimate: number | null, unit: string, isPassed?: boolean) => {
  if (actual === null || estimate === null) {
    return isPassed ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500';
  }
  
  if (actual > estimate) {
    return isPassed ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-emerald-500 dark:text-emerald-400';
  }
  if (actual < estimate) {
    return isPassed ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-rose-500 dark:text-rose-400';
  }
  return isPassed ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500';
};

const getEventTimeMs = (timeStr: string): number => {
  const parsed = new Date(timeStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

const formatCountdown = (eventMs: number, currentMs: number): string => {
  const diffMinutes = Math.round((eventMs - currentMs) / (60 * 1000));
  if (diffMinutes <= 0) return 'Due now';
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
};

const SkeletonRow = () => (
  <tr>
    <td colSpan={7} className="px-8 py-5">
      <div className="flex items-center gap-4 animate-pulse">
        <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="w-1/2 h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="w-1/4 h-3 bg-zinc-50 dark:bg-zinc-900 rounded" />
        </div>
        <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>
    </td>
  </tr>
);

export const MarketPulse = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  const { 
    events, 
    loading, 
    impactFilter, 
    setImpactFilter, 
    currencyFilter, 
    setCurrencyFilter,
    dateRange,
    setDateRange,
    refresh 
  } = useEconomicCalendar();
  const { theme } = useTheme();

  // Dynamic real-time clock tracking: updates every 15 seconds + on window focus
  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    
    updateTime();
    const interval = setInterval(updateTime, 15000);
    
    window.addEventListener('focus', updateTime);
    document.addEventListener('visibilitychange', updateTime);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', updateTime);
      document.removeEventListener('visibilitychange', updateTime);
    };
  }, []);

  // Compute Passed & Upcoming metrics and isolate the Next Active Catalyst
  const { passedCount, upcomingCount, nextActiveCatalystId } = useMemo(() => {
    let pCount = 0;
    let uCount = 0;
    let nextId: string | null = null;
    let minUpcomingDiff = Infinity;

    events.forEach((event) => {
      const eventMs = getEventTimeMs(event.time);
      if (eventMs < currentTime) {
        pCount++;
      } else {
        uCount++;
        const diff = eventMs - currentTime;
        if (diff < minUpcomingDiff) {
          minUpcomingDiff = diff;
          nextId = event.calendar_id;
        }
      }
    });

    return {
      passedCount: pCount,
      upcomingCount: uCount,
      nextActiveCatalystId: nextId
    };
  }, [events, currentTime]);
  
  const impactOptions = [
    { id: 'high', label: 'High Impact', color: 'bg-red-500' },
    { id: 'med', label: 'Medium Impact', color: 'bg-orange-500' },
    { id: 'low', label: 'Low Impact', color: 'bg-yellow-500' },
  ];

  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];

  const toggleImpact = (id: string) => {
    const next = impactFilter.includes(id) 
      ? impactFilter.filter(i => i !== id) 
      : [...impactFilter, id];
    setImpactFilter(next);
  };

  const toggleCurrency = (curr: string) => {
    const next = currencyFilter.includes(curr) 
      ? currencyFilter.filter(c => c !== curr) 
      : [...currencyFilter, curr];
    setCurrencyFilter(next);
  };

  const offsetMinutes = new Date().getTimezoneOffset();
  const offsetHours = -offsetMinutes / 60;
  const gmtDisplay = `GMT${offsetHours >= 0 ? '+' : ''}${offsetHours}`;

  if (!events && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <RefreshCcw className="w-12 h-12 text-zinc-400 animate-spin mx-auto" />
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Calibrating_Uplink...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-10 space-y-6 md:space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center border border-zinc-950/5 dark:border-white/5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all"
            aria-label="Open filter tray"
          >
            <Menu size={20} />
          </button>
          <div className="hidden sm:flex w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-[20px] bg-primary/10 items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
            <Zap size={24} className="text-primary md:hidden" />
            <Zap size={28} className="text-primary hidden md:block" />
          </div>
          <div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-zinc-950 dark:text-white flex items-center gap-2">
                MarketPulse <span className="text-primary font-black">v5.0 Pro</span>
              </h1>
              <div className="hidden sm:flex items-center gap-2">
                {!loading ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black text-zinc-500 border border-zinc-950/5 dark:border-white/5 uppercase tracking-widest">
                      {events.length} Events
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {upcomingCount} Upcoming
                    </span>
                    {passedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-zinc-100/60 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 text-[10px] font-bold border border-zinc-950/5 dark:border-white/5 uppercase tracking-widest">
                        {passedCount} Passed
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest">
                    <RefreshCcw size={10} className="animate-spin" />
                    Syncing
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] md:text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 md:gap-3 mt-1">
              <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"></span>
              </span>
              <span className="truncate">
                {dateRange.from === new Date().toISOString().split('T')[0] 
                  ? 'Real-Time Macro Telemetry & Catalyst Engine' 
                  : `Archive: ${new Date(dateRange.from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
              </span>
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => refresh()}
          className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-white/70 dark:bg-card border border-zinc-200 dark:border-white/5 rounded-xl md:rounded-2xl shadow-sm hover:bg-zinc-50 dark:hover:bg-accent/50 transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-950 dark:text-white backdrop-blur-xl"
        >
          <RefreshCcw size={12} className={cn("transition-transform duration-700 md:hidden", loading && "animate-spin")} />
          <RefreshCcw size={14} className={cn("transition-transform duration-700 hidden md:block", loading && "animate-spin")} />
          <span className="hidden sm:inline">Sync Uplink</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 md:gap-8 items-start">
        
        {/* Sidebar Column - Desktop */}
        <aside className="hidden lg:flex flex-col space-y-4 sticky top-10">
          <SidebarContent 
            impactOptions={impactOptions}
            currencyOptions={currencyOptions}
            impactFilter={impactFilter}
            toggleImpact={toggleImpact}
            currencyFilter={currencyFilter}
            toggleCurrency={toggleCurrency}
            dateRange={dateRange}
            setDateRange={setDateRange}
            gmtDisplay={gmtDisplay}
          />
        </aside>

        {/* Sidebar Mobile Drawer */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-[320px] bg-white dark:bg-zinc-950 z-[101] lg:hidden overflow-y-auto p-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Zap size={20} className="text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest text-zinc-950 dark:text-white">Settings_Tray</span>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <X size={20} className="text-zinc-500" />
                  </button>
                </div>
                <SidebarContent 
                  impactOptions={impactOptions}
                  currencyOptions={currencyOptions}
                  impactFilter={impactFilter}
                  toggleImpact={toggleImpact}
                  currencyFilter={currencyFilter}
                  toggleCurrency={toggleCurrency}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  gmtDisplay={gmtDisplay}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="space-y-6 md:space-y-8 flex-1 overflow-y-visible">
          <ShadcnCard className="rounded-[2rem] md:rounded-[2.5rem] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl backdrop-blur-[20px] relative overflow-hidden">
            {/* Live Pulse Indicator - Desktop only */}
            <div className="hidden md:flex absolute top-6 right-8 items-center gap-2 z-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">v5.0_Pro_Feed</span>
            </div>

            <div className="flex flex-col min-h-[500px] lg:min-h-screen overflow-x-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-hidden">
                <table className="w-full text-left table-fixed border-collapse">
                  <thead className="text-[10px] uppercase bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-500 font-black border-b border-zinc-950/5 dark:border-white/5 tracking-[0.2em] sticky top-0 z-20 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-5 w-[14%]">Time / Status</th>
                      <th className="px-4 py-5 w-[8%] text-center">Impact</th>
                      <th className="px-4 py-5 w-[9%]">Country</th>
                      <th className="px-4 py-5 w-[33%]">Event_Identifier</th>
                      <th className="px-4 py-5 w-[12%] text-right">Actual</th>
                      <th className="px-4 py-5 w-[12%] text-right">Forecast</th>
                      <th className="px-4 py-5 w-[12%] text-right">Prev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-zinc-950/5 dark:divide-white/5">
                    {loading ? (
                      Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)
                    ) : events.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-32 text-center text-zinc-500 italic">No events found.</td>
                      </tr>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {events.map((event, idx) => {
                          const eventMs = getEventTimeMs(event.time);
                          const isPassed = eventMs < currentTime;
                          const isUpcoming = !isPassed;
                          const isNextCatalyst = isUpcoming && event.calendar_id === nextActiveCatalystId;
                          const isHighImpact = (event.impact || '').toLowerCase() === 'high';
                          const countdownLabel = formatCountdown(eventMs, currentTime);

                          return (
                            <motion.tr 
                              key={`desk-${event.calendar_id || idx}-${idx}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={{ delay: idx * 0.02, duration: 0.3 }}
                              className={cn(
                                "transition-all group relative border-b border-zinc-950/5 dark:border-white/5",
                                // Passed events styling (dimmed, visually receded)
                                isPassed && "opacity-45 hover:opacity-75 bg-transparent",
                                // Upcoming events (full brightness)
                                isUpcoming && "opacity-100",
                                // Next Active Catalyst (subtle glowing left border & vibrant accent)
                                isNextCatalyst 
                                  ? "border-l-4 border-l-primary bg-primary/[0.04] dark:bg-primary/[0.08] shadow-[inset_0_0_24px_rgba(59,130,246,0.07)] ring-1 ring-primary/20" 
                                  : isHighImpact && !isPassed 
                                    ? "hover:bg-red-500/5 dark:hover:bg-red-500/5 bg-gradient-to-r hover:from-red-500/5 hover:to-transparent"
                                    : "hover:bg-zinc-50/50 dark:hover:bg-white/5"
                              )}
                            >
                              {/* Time & Real-Time Status Column */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-xs font-mono font-bold transition-colors",
                                      isPassed 
                                        ? "text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400/40" 
                                        : isNextCatalyst 
                                          ? "text-primary font-black drop-shadow-sm text-[13px]" 
                                          : "text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white"
                                    )}>
                                      {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    {isNextCatalyst && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[8px] font-black uppercase tracking-wider animate-pulse">
                                        <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                                        Next
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {isPassed ? (
                                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-zinc-200/50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500">
                                        Passed
                                      </span>
                                    ) : isNextCatalyst ? (
                                      <span className="text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                                        <span>Active</span>
                                        <span>• {countdownLabel}</span>
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        Upcoming
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Impact Dot Column */}
                              <td className="px-4 py-4 text-center">
                                <div className="flex justify-center">
                                  <ImpactIcon impact={event.impact} isPassed={isPassed} />
                                </div>
                              </td>

                              {/* Country Flag/Label */}
                              <td className="px-4 py-4">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all",
                                  isPassed 
                                    ? "bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 border-zinc-200/40 dark:border-white/5" 
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-950/5 dark:border-white/5"
                                )}>
                                  {event.country}
                                </span>
                              </td>

                              {/* Event Name & Identification */}
                              <td className="px-4 py-4">
                                <p className={cn(
                                  "text-[13px] tracking-tight leading-tight transition-all break-words",
                                  isPassed 
                                    ? "text-zinc-400 dark:text-zinc-500 font-medium" 
                                    : isNextCatalyst 
                                      ? "text-zinc-950 dark:text-white font-black group-hover:text-primary" 
                                      : isHighImpact 
                                        ? "text-rose-500 font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" 
                                        : "text-zinc-950 dark:text-white font-black group-hover:text-primary"
                                )}>
                                  {event.event}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                    ID: {event.calendar_id?.substring(0, 8) || 'SYSTEM_GEN'}
                                  </span>
                                  {isNextCatalyst && (
                                    <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                                      ⚡ ACTIVE CATALYST
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actual Value */}
                              <td className={cn(
                                "px-4 py-4 text-right text-sm font-black tabular-nums",
                                valueColor(event.actual, event.estimate, event.unit, isPassed)
                              )}>
                                {event.actual !== null ? `${event.actual.toLocaleString()}${event.unit || ''}` : '--'}
                              </td>

                              {/* Forecast Value */}
                              <td className={cn(
                                "px-4 py-4 text-right text-sm font-black tabular-nums",
                                isPassed ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"
                              )}>
                                {event.estimate !== null ? `${event.estimate.toLocaleString()}${event.unit || ''}` : '--'}
                              </td>

                              {/* Previous Value */}
                              <td className={cn(
                                "px-4 py-4 text-right text-sm font-black tabular-nums",
                                isPassed ? "text-zinc-400 dark:text-zinc-700" : "text-zinc-400 dark:text-zinc-600"
                              )}>
                                {event.prev !== null ? `${event.prev.toLocaleString()}${event.unit || ''}` : '--'}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden p-4 space-y-4">
                {loading ? (
                   Array(5).fill(0).map((_, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 animate-pulse space-y-3">
                      <div className="flex justify-between">
                        <div className="w-16 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="w-8 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>
                      <div className="w-3/4 h-5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>
                    </div>
                  ))
                ) : events.length === 0 ? (
                  <div className="py-12 text-center opacity-40">
                     <AlertTriangle size={32} className="mx-auto mb-2" />
                     <p className="text-xs font-black uppercase">No Events Found</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {events.map((event, idx) => {
                      const eventMs = getEventTimeMs(event.time);
                      const isPassed = eventMs < currentTime;
                      const isUpcoming = !isPassed;
                      const isNextCatalyst = isUpcoming && event.calendar_id === nextActiveCatalystId;
                      const isHighImpact = (event.impact || '').toLowerCase() === 'high';
                      const countdownLabel = formatCountdown(eventMs, currentTime);

                      return (
                        <motion.div 
                          key={`mob-${event.calendar_id || idx}-${idx}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={cn(
                            "p-4 rounded-3xl border transition-all space-y-3 relative overflow-hidden",
                            isPassed 
                              ? "opacity-45 bg-zinc-50/30 dark:bg-white/[0.02] border-zinc-200/50 dark:border-white/5" 
                              : isNextCatalyst 
                                ? "opacity-100 border-l-4 border-l-primary bg-primary/[0.05] dark:bg-primary/[0.08] border-zinc-950/10 dark:border-white/10 ring-1 ring-primary/30 shadow-md" 
                                : "opacity-100 border-zinc-950/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5",
                            isHighImpact && !isPassed && !isNextCatalyst && "border-red-500/20"
                          )}
                        >
                          {isHighImpact && !isPassed && (
                            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 blur-2xl rounded-full -mr-4 -mt-4 pointer-events-none" />
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[10px] font-mono font-bold",
                                isPassed 
                                  ? "text-zinc-400 dark:text-zinc-500 line-through" 
                                  : isNextCatalyst 
                                    ? "text-primary font-black" 
                                    : "text-zinc-700 dark:text-zinc-300"
                              )}>
                                {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[8px] font-black uppercase tracking-widest border border-zinc-950/5 dark:border-white/5">
                                {event.country}
                              </span>
                              {isPassed ? (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider bg-zinc-200/60 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500">
                                  PASSED
                                </span>
                              ) : isNextCatalyst ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[7px] font-black uppercase tracking-wider animate-pulse">
                                  <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                                  NEXT ({countdownLabel})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  UPCOMING
                                </span>
                              )}
                            </div>
                            <ImpactIcon impact={event.impact} isPassed={isPassed} />
                          </div>

                          <h3 className={cn(
                            "text-sm tracking-tight leading-tight",
                            isPassed 
                              ? "text-zinc-400 dark:text-zinc-500 font-medium" 
                              : isNextCatalyst 
                                ? "text-zinc-950 dark:text-white font-black" 
                                : isHighImpact 
                                  ? "text-rose-500 font-black" 
                                  : "text-zinc-950 dark:text-white font-black"
                          )}>
                            {event.event}
                          </h3>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-zinc-100/70 dark:bg-white/5 p-2 rounded-xl text-center">
                              <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Actual</div>
                              <div className={cn("text-xs font-black", valueColor(event.actual, event.estimate, event.unit, isPassed))}>
                                {event.actual !== null ? `${event.actual}${event.unit || ''}` : '--'}
                              </div>
                            </div>
                            <div className="bg-zinc-100/70 dark:bg-white/5 p-2 rounded-xl text-center">
                              <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Forecast</div>
                              <div className={cn("text-xs font-black", isPassed ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-500")}>
                                {event.estimate !== null ? `${event.estimate}${event.unit || ''}` : '--'}
                              </div>
                            </div>
                            <div className="bg-zinc-100/70 dark:bg-white/5 p-2 rounded-xl text-center">
                              <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Prev</div>
                              <div className={cn("text-xs font-black", isPassed ? "text-zinc-400 dark:text-zinc-700" : "text-zinc-400")}>
                                {event.prev !== null ? `${event.prev}${event.unit || ''}` : '--'}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </ShadcnCard>

          {/* STRATEGIC_INTELLIGENCE_UNIT v5.0 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <StrategicIntelligenceUnit events={events} currencyFilter={currencyFilter} />
          </motion.div>

          {/* LIVE FINNHUB MARKET WIRE NEWS FEED */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <MarketNewsFeed />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Sidebar Content Component for Reusability
const SidebarContent = ({ 
  impactOptions, 
  currencyOptions, 
  impactFilter, 
  toggleImpact, 
  currencyFilter, 
  toggleCurrency, 
  dateRange, 
  setDateRange, 
  gmtDisplay 
}: any) => (
  <>
    <ShadcnCard className="rounded-[2rem] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl backdrop-blur-[20px] overflow-hidden">
      <ShadcnCardHeader className="border-b border-zinc-950/5 dark:border-white/5 bg-zinc-50/20 dark:bg-white/5 p-5">
        <ShadcnCardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-[0.2em] text-zinc-400">
          <Filter className="w-3 h-3 text-primary" />
          Settings_Tray
        </ShadcnCardTitle>
      </ShadcnCardHeader>
      <ShadcnCardContent className="p-5 space-y-8">
        {/* Temporal Selection */}
        <div className="space-y-3">
          <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Temporal_Control</h4>
          <TemporalControl 
            selectedDate={dateRange.from}
            onDateChange={(from, to) => setDateRange({ from, to })}
          />
        </div>

        {/* Impact Filter */}
        <div className="space-y-3">
          <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Severity_Protocol</h4>
          <div className="space-y-2.5">
            {impactOptions.map((opt: any) => (
              <div key={opt.id} className="flex items-center space-x-3 group px-1">
                <Checkbox 
                  id={`impact-${opt.id}`} 
                  checked={impactFilter.includes(opt.id)}
                  onCheckedChange={() => toggleImpact(opt.id)}
                  className="w-4 h-4 rounded-md border-zinc-300 dark:border-white/10 data-[state=checked]:bg-primary"
                />
                <Label 
                  htmlFor={`impact-${opt.id}`}
                  className="flex items-center gap-2 text-[11px] font-black text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors cursor-pointer uppercase tracking-tight"
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", opt.color)} />
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Currency Filter */}
        <div className="space-y-3">
          <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Global_Corridors</h4>
          <div className="grid grid-cols-1 gap-2.5">
            {currencyOptions.map((curr: any) => (
              <div key={curr} className="flex items-center space-x-3 group px-1">
                <Checkbox 
                  id={`curr-${curr}`} 
                  checked={currencyFilter.includes(curr)}
                  onCheckedChange={() => toggleCurrency(curr)}
                  className="w-4 h-4 rounded-md border-zinc-300 dark:border-white/10 data-[state=checked]:bg-primary"
                />
                <Label 
                  htmlFor={`curr-${curr}`}
                  className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors cursor-pointer uppercase tracking-tight"
                >
                  {curr}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </ShadcnCardContent>
    </ShadcnCard>

    {/* System Info Bento */}
    <div className="p-8 rounded-[2rem] md:rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <Globe size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Zone_UTC</span>
          <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
            System synced to local {gmtDisplay}
          </span>
        </div>
      </div>
      <p className="text-xs md:text-sm text-zinc-500 font-medium leading-relaxed">
        All events are synchronized to your local GMT offset for maximum execution precision.
      </p>
    </div>

    {/* Market Sentiment / Heatmap Placeholder */}
    <div className="p-8 rounded-[2rem] md:rounded-[2.5rem] bg-white/40 dark:bg-zinc-900/40 border border-zinc-950/5 dark:border-white/5 backdrop-blur-xl space-y-6">
      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Market_Heatmap</h4>
      <div className="space-y-4">
        {[
          { pair: 'EUR/USD', strength: 65, color: 'bg-emerald-500' },
          { pair: 'GBP/USD', strength: 42, color: 'bg-rose-500' },
          { pair: 'USD/JPY', strength: 88, color: 'bg-emerald-500' },
        ].map(item => (
          <div key={item.pair} className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black tracking-tight">
              <span className="text-zinc-950 dark:text-white uppercase">{item.pair}</span>
              <span className={item.strength > 50 ? 'text-emerald-500' : 'text-rose-500'}>{item.strength}% Strength</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${item.strength}%` }}
                className={cn("h-full rounded-full", item.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);
