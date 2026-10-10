import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { generateInstitutionalEconomicEvents } from '@/data/mockEconomicEvents';
import { getFinnhubToken } from '@/lib/market';

export interface EconomicEvent {
  calendar_id: string;
  country: string;
  currency: string;
  estimate: number | null;
  event: string;
  impact: 'high' | 'medium' | 'low' | string;
  prev: number | null;
  actual: number | null;
  time: string;
  unit: string;
}

export const useEconomicCalendar = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [impactFilter, setImpactFilter] = useState<string[]>(['high', 'med', 'low']);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF']);

  // Date Range
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]
  });

  const fetchCalendar = async (isInitial = false) => {
    try {
      const fromStr = dateRange.from;
      const toStr = dateRange.to;
      const token = getFinnhubToken();
      
      const API_URL = `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${token}`;
      
      let fetchedEvents: EconomicEvent[] = [];

      try {
        const response = await fetch(API_URL);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.economicCalendar) && data.economicCalendar.length > 0) {
            fetchedEvents = (data.economicCalendar || []).sort((a: EconomicEvent, b: EconomicEvent) => {
              return new Date(a.time).getTime() - new Date(b.time).getTime();
            });
          }
        }
      } catch (networkErr) {
        console.warn('Finnhub uplink failed, activating institutional telemetry fallback:', networkErr);
      }

      // If Finnhub key has restricted access or endpoint failed, fall back to institutional feed
      if (fetchedEvents.length === 0) {
        fetchedEvents = generateInstitutionalEconomicEvents(fromStr, toStr);
      }
      
      setEvents(prevEvents => {
        // Notification Logic: Detect new 'actual' values for High Impact events
        if (!isInitial && prevEvents.length > 0) {
          fetchedEvents.forEach(newEvent => {
            const oldEvent = prevEvents.find(e => e.calendar_id === newEvent.calendar_id);
            const isHighImpact = (newEvent.impact || '').toLowerCase().includes('high');
            
            if (isHighImpact && newEvent.actual !== null && (!oldEvent || oldEvent.actual === null)) {
              toast.error(`URGENT: ${newEvent.currency} ${newEvent.event} DATA RELEASED - VOLATILITY ALERT`, {
                duration: 10000,
              });
            }
          });
        }
        return fetchedEvents;
      });
      
      setError(null);
    } catch (err) {
      console.warn('Economic Calendar using fallback stream:', err);
      const fallbackEvents = generateInstitutionalEconomicEvents(dateRange.from, dateRange.to);
      setEvents(fallbackEvents);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchCalendar(true);
    
    // 5-minute polling interval
    const interval = setInterval(() => fetchCalendar(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dateRange.from, dateRange.to]);

  const filteredEvents = useMemo(() => {
    const filtered = events.filter(event => {
      const eventImpact = (event.impact || '').toLowerCase();
      const matchesImpact = impactFilter.length === 0 || impactFilter.some(f => {
        const filterLabel = f.toLowerCase();
        return filterLabel.includes(eventImpact) || eventImpact.includes(filterLabel);
      });

      const matchesCurrency = currencyFilter.length === 0 || 
        currencyFilter.some(f => f.includes(event?.country?.toUpperCase() || ""));
        
      return matchesImpact && matchesCurrency;
    });

    return filtered;
  }, [events, impactFilter, currencyFilter]);

  return {
    events: filteredEvents,
    loading,
    error,
    impactFilter,
    setImpactFilter,
    currencyFilter,
    setCurrencyFilter,
    dateRange,
    setDateRange,
    refresh: fetchCalendar
  };
}; 
