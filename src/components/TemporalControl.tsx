import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateControllerProps {
  selectedDate: string;
  toDate?: string;
  onDateChange: (from: string, to: string) => void;
}

export const TemporalControl: React.FC<DateControllerProps> = ({ selectedDate, toDate, onDateChange }) => {
  const [currentMonth, setCurrentMonth] = React.useState(new Date(selectedDate));
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatYMD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(today);
  const tomorrowStr = formatYMD(tomorrow);

  const getThisWeekRange = React.useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: formatYMD(monday),
      to: formatYMD(sunday)
    };
  }, []);

  const weekRange = getThisWeekRange();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);

  const handleToday = () => {
    onDateChange(todayStr, todayStr);
  };

  const handleTomorrow = () => {
    onDateChange(tomorrowStr, tomorrowStr);
  };

  const handleThisWeek = () => {
    onDateChange(weekRange.from, weekRange.to);
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const monthName = currentMonth.toLocaleString('default', { month: 'long' });
  const year = currentMonth.getFullYear();

  const isToday = (day: number) => {
    const d = new Date(year, currentMonth.getMonth(), day);
    return d.toDateString() === today.toDateString();
  };

  const isSelected = (day: number) => {
    const d = new Date(year, currentMonth.getMonth(), day);
    return formatYMD(d) === selectedDate;
  };

  const activeMode = React.useMemo(() => {
    if (selectedDate === todayStr && (!toDate || toDate === todayStr)) return 'today';
    if (selectedDate === tomorrowStr && (!toDate || toDate === tomorrowStr)) return 'tomorrow';
    if (selectedDate === weekRange.from && toDate === weekRange.to) return 'week';
    return 'custom';
  }, [selectedDate, toDate, todayStr, tomorrowStr, weekRange]);

  return (
    <div className="space-y-4">
      {/* Segmented Control Quick Actions */}
      <div className="p-1 flex bg-zinc-100 dark:bg-white/5 rounded-xl border border-zinc-950/10 dark:border-white/10">
        {[
          { id: 'today', label: 'Today', onClick: handleToday },
          { id: 'tomorrow', label: 'Tomorrow', onClick: handleTomorrow },
          { id: 'week', label: 'This Week', onClick: handleThisWeek }
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={btn.onClick}
            className={cn(
              "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg relative",
              activeMode === btn.id
                ? "text-zinc-950 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            <span className="relative z-10">{btn.label}</span>
            {activeMode === btn.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-none rounded-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Calendar Grid - Collapsible */}
      <div className="rounded-2xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-950/5 dark:border-white/5 overflow-hidden">
        <button 
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className="w-full px-4 py-3 flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <CalendarIcon size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
              Temporal_Grid
            </span>
          </div>
          <ChevronLeft 
            size={12} 
            className={cn(
              "text-zinc-400 transition-transform duration-300",
              isCalendarOpen ? "rotate-90" : "-rotate-90"
            )} 
          />
        </button>

        <AnimatePresence>
          {isCalendarOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4"
            >
              <div className="flex items-center justify-between mb-4 pt-2">
                <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                  {monthName} {year}
                </h4>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg text-zinc-400 transition-all text-[10px]"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button 
                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg text-zinc-400 transition-all text-[10px]"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
                  <div key={`${d}-${index}`} className="text-[9px] font-black text-zinc-300 dark:text-zinc-600 mb-2">
                    {d}
                  </div>
                ))}
                {blanks.map(i => <div key={`b-${i}`} />)}
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      const d = new Date(year, currentMonth.getMonth(), day);
                      const ymd = formatYMD(d);
                      onDateChange(ymd, ymd);
                    }}
                    className={cn(
                      "relative group w-8 h-8 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center",
                      isSelected(day) 
                        ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.4)]" 
                        : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5",
                      isToday(day) && !isSelected(day) && "text-primary font-black"
                    )}
                  >
                    {day}
                    {isSelected(day) && (
                      <motion.div 
                        layoutId="day-glow"
                        className="absolute inset-0 rounded-lg bg-primary/20 blur-md -z-10"
                      />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
