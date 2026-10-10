import { EconomicEvent } from '../hooks/useEconomicCalendar';

/**
 * Institutional Mock Economic Events for Macro / Calendar fallbacks
 * Generated relative to current date so it always displays current & upcoming catalysts
 */
export function generateInstitutionalEconomicEvents(fromStr?: string, toStr?: string): EconomicEvent[] {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  const mockTemplates = [
    {
      country: 'US',
      currency: 'USD',
      event: 'Fed Interest Rate Decision',
      impact: 'high',
      estimate: 5.25,
      actual: 5.25,
      prev: 5.50,
      unit: '%',
      offsetHours: -2
    },
    {
      country: 'US',
      currency: 'USD',
      event: 'Core CPI (YoY)',
      impact: 'high',
      estimate: 3.2,
      actual: 3.1,
      prev: 3.3,
      unit: '%',
      offsetHours: 1
    },
    {
      country: 'US',
      currency: 'USD',
      event: 'Non-Farm Payrolls',
      impact: 'high',
      estimate: 175,
      actual: null,
      prev: 182,
      unit: 'k',
      offsetHours: 4
    },
    {
      country: 'US',
      currency: 'USD',
      event: 'ISM Manufacturing PMI',
      impact: 'medium',
      estimate: 49.5,
      actual: null,
      prev: 48.7,
      unit: '',
      offsetHours: 8
    },
    {
      country: 'EU',
      currency: 'EUR',
      event: 'ECB Monetary Policy Statement',
      impact: 'high',
      estimate: 3.75,
      actual: 3.75,
      prev: 4.00,
      unit: '%',
      offsetHours: 12
    },
    {
      country: 'GB',
      currency: 'GBP',
      event: 'GDP (MoM)',
      impact: 'medium',
      estimate: 0.2,
      actual: null,
      prev: 0.0,
      unit: '%',
      offsetHours: 18
    },
    {
      country: 'JP',
      currency: 'JPY',
      event: 'BoJ Policy Rate',
      impact: 'high',
      estimate: 0.25,
      actual: null,
      prev: 0.10,
      unit: '%',
      offsetHours: 26
    },
    {
      country: 'US',
      currency: 'USD',
      event: 'Initial Jobless Claims',
      impact: 'medium',
      estimate: 215,
      actual: null,
      prev: 218,
      unit: 'k',
      offsetHours: 32
    },
    {
      country: 'EU',
      currency: 'EUR',
      event: 'Harmonised Index of Consumer Prices (YoY)',
      impact: 'high',
      estimate: 2.2,
      actual: null,
      prev: 2.4,
      unit: '%',
      offsetHours: 40
    },
    {
      country: 'US',
      currency: 'USD',
      event: 'Crude Oil Inventories',
      impact: 'low',
      estimate: -1.2,
      actual: null,
      prev: 1.8,
      unit: 'M',
      offsetHours: 48
    },
    {
      country: 'AU',
      currency: 'AUD',
      event: 'RBA Interest Rate Decision',
      impact: 'high',
      estimate: 4.35,
      actual: null,
      prev: 4.35,
      unit: '%',
      offsetHours: 60
    },
    {
      country: 'CA',
      currency: 'CAD',
      event: 'Employment Change',
      impact: 'medium',
      estimate: 25.0,
      actual: null,
      prev: 18.5,
      unit: 'k',
      offsetHours: 72
    }
  ];

  return mockTemplates.map((item, index) => {
    const eventTime = new Date(now + item.offsetHours * oneHour).toISOString();
    return {
      calendar_id: `macro_${item.currency}_${item.event.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${index}`,
      country: item.country,
      currency: item.currency,
      estimate: item.estimate,
      event: item.event,
      impact: item.impact,
      prev: item.prev,
      actual: item.actual,
      time: eventTime,
      unit: item.unit
    };
  });
}
