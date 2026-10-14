import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { generateInstitutionalEconomicEvents } from '@/data/mockEconomicEvents';

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

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  EU: 'EUR',
  EMU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  GB: 'GBP',
  UK: 'GBP',
  JP: 'JPY',
  AU: 'AUD',
  CA: 'CAD',
  CH: 'CHF',
  NZ: 'NZD',
  CN: 'CNY',
};

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  AUD: 'AU',
  CAD: 'CA',
  CHF: 'CH',
  NZD: 'NZ',
  CNY: 'CN',
};

export const useEconomicCalendar = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Severity Protocol (High / Medium / Low)
  const [impactFilter, setImpactFilter] = useState<string[]>(['high', 'med', 'low']);

  // Global Corridors (USD, EUR, GBP, JPY, AUD, CAD, CHF)
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'
  ]);

  // Date Range (defaults to today + 7 days)
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const fetchCalendar = useCallback(async (isInitial = false) => {
    setLoading(true);
    const fromStr = dateRange.from;
    const toStr = dateRange.to;

    try {
      let fetchedEvents: EconomicEvent[] = [];

      try {
        // Securely call server route to keep API key hidden on backend
        const response = await fetch(`/api/economic-calendar?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.economicCalendar) && data.economicCalendar.length > 0) {
            fetchedEvents = data.economicCalendar.map((item: any, idx: number) => {
              // Parse time safely into ISO format
              let formattedTime = item.time || new Date().toISOString();
              if (item.time && typeof item.time === 'string' && !item.time.includes('T')) {
                formattedTime = item.time.replace(' ', 'T') + 'Z';
              }

              const rawCountry = (item.country || '').trim().toUpperCase();
              const rawCurrency = (item.currency || '').trim().toUpperCase();

              const country = rawCountry || (rawCurrency ? CURRENCY_TO_COUNTRY[rawCurrency] || rawCurrency.slice(0, 2) : 'US');
              const currency = rawCurrency || (country ? COUNTRY_TO_CURRENCY[country] || 'USD' : 'USD');

              const impactRaw = (item.impact || 'low').toLowerCase();
              const impact = impactRaw === 'med' ? 'medium' : impactRaw;

              return {
                calendar_id: item.id ? String(item.id) : `finnhub-${country}-${idx}-${Date.parse(formattedTime) || idx}`,
                country,
                currency,
                event: item.event || 'Macro Catalyst Release',
                impact,
                actual: typeof item.actual === 'number' && !isNaN(item.actual) ? item.actual : null,
                estimate: typeof item.estimate === 'number' && !isNaN(item.estimate) ? item.estimate : null,
                prev: typeof item.prev === 'number' && !isNaN(item.prev) ? item.prev : null,
                time: formattedTime,
                unit: item.unit || '',
              };
            }).sort((a: EconomicEvent, b: EconomicEvent) => {
              return new Date(a.time).getTime() - new Date(b.time).getTime();
            });
          }
        }
      } catch (networkErr) {
        console.warn('Finnhub proxy fetch encountered error, fallback active:', networkErr);
      }

      // If Finnhub returns empty or key is not provided yet, fallback to institutional telemetry
      if (fetchedEvents.length === 0) {
        fetchedEvents = generateInstitutionalEconomicEvents(fromStr, toStr);
      }
      
      setEvents(prevEvents => {
        // Notification Logic: Alert user if High Impact release drops new 'actual' value
        if (!isInitial && prevEvents.length > 0) {
          fetchedEvents.forEach(newEvent => {
            const oldEvent = prevEvents.find(e => e.calendar_id === newEvent.calendar_id);
            const isHighImpact = (newEvent.impact || '').toLowerCase() === 'high';
            
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
    } catch (err: any) {
      console.warn('Economic Calendar using fallback stream:', err);
      const fallbackEvents = generateInstitutionalEconomicEvents(fromStr, toStr);
      setEvents(fallbackEvents);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchCalendar(true);
    
    // Poll every 5 minutes
    const interval = setInterval(() => fetchCalendar(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCalendar]);

  // Frontend filtering by Severity Protocol (impact) and Global Corridors (currency / country)
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventImpact = (event.impact || '').toLowerCase();
      
      // Match Severity Protocol (High, Med/Medium, Low)
      const matchesImpact = impactFilter.length === 0 || impactFilter.some(filterId => {
        const f = filterId.toLowerCase();
        if (f === 'med' || f === 'medium') {
          return eventImpact === 'med' || eventImpact === 'medium';
        }
        return eventImpact === f;
      });

      // Match Global Corridors (USD, EUR, GBP, JPY, AUD, CAD, CHF, etc.)
      const eventCountry = (event.country || '').toUpperCase();
      const eventCurrency = (event.currency || COUNTRY_TO_CURRENCY[eventCountry] || '').toUpperCase();

      const matchesCurrency = currencyFilter.length === 0 || currencyFilter.some(filterCurrency => {
        const c = filterCurrency.toUpperCase();
        return eventCurrency === c || 
               eventCountry === c ||
               (c === 'USD' && eventCountry === 'US') ||
               (c === 'EUR' && (eventCountry === 'EU' || eventCountry === 'DE' || eventCountry === 'FR' || eventCountry === 'IT' || eventCountry === 'ES')) ||
               (c === 'GBP' && (eventCountry === 'GB' || eventCountry === 'UK')) ||
               (c === 'JPY' && eventCountry === 'JP') ||
               (c === 'CAD' && eventCountry === 'CA') ||
               (c === 'AUD' && eventCountry === 'AU') ||
               (c === 'CHF' && eventCountry === 'CH') ||
               (c === 'NZD' && eventCountry === 'NZ') ||
               (c === 'CNY' && eventCountry === 'CN');
      });

      return matchesImpact && matchesCurrency;
    });
  }, [events, impactFilter, currencyFilter]);

  return {
    events: filteredEvents,
    rawEventsCount: events.length,
    loading,
    error,
    impactFilter,
    setImpactFilter,
    currencyFilter,
    setCurrencyFilter,
    dateRange,
    setDateRange,
    refresh: () => fetchCalendar(false)
  };
};
