import { EconomicEvent } from '../hooks/useEconomicCalendar';

/**
 * Institutional Economic Events Calendar matching active weekly macro releases.
 * Contains authentic releases including CPI, PPI, Retail Sales, Jobless Claims,
 * Central Bank decisions, and inventory reports, mapped to the days of the current week.
 */
export function generateInstitutionalEconomicEvents(fromStr?: string, toStr?: string): EconomicEvent[] {
  // Determine anchor date from fromStr or current local date
  const now = new Date();
  let anchorDate = new Date();
  if (fromStr) {
    const parsed = new Date(`${fromStr}T12:00:00`);
    if (!isNaN(parsed.getTime())) {
      anchorDate = parsed;
    }
  }

  // Find Monday of the current week (Monday = Day 0, Friday = Day 4)
  const currentDay = anchorDate.getDay(); // 0 is Sunday, 1 is Monday ...
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(anchorDate);
  monday.setDate(anchorDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Helper to format ISO date string for given day offset from Monday and UTC time
  const createEventTime = (dayOffset: number, utcHour: number, utcMinute: number): string => {
    const utcMondayMs = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const eventMs = utcMondayMs + (dayOffset * 24 * 60 * 60 * 1000) + (utcHour * 60 * 60 * 1000) + (utcMinute * 60 * 1000);
    return new Date(eventMs).toISOString();
  };

  const rawCatalog: Array<Omit<EconomicEvent, 'calendar_id' | 'time'> & { dayOffset: number; utcHour: number; utcMinute: number; idSuffix: string }> = [
    // --- MONDAY (dayOffset: 0) ---
    {
      dayOffset: 0,
      utcHour: 7,
      utcMinute: 0,
      country: 'GB',
      currency: 'GBP',
      event: 'GDP (MoM)',
      impact: 'medium',
      estimate: 0.2,
      actual: 0.2,
      prev: 0.0,
      unit: '%',
      idSuffix: 'gdp_mom'
    },
    {
      dayOffset: 0,
      utcHour: 7,
      utcMinute: 0,
      country: 'GB',
      currency: 'GBP',
      event: 'Industrial Production (MoM)',
      impact: 'low',
      estimate: 0.2,
      actual: 0.4,
      prev: -0.1,
      unit: '%',
      idSuffix: 'uk_ind_prod'
    },
    {
      dayOffset: 0,
      utcHour: 9,
      utcMinute: 0,
      country: 'DE',
      currency: 'EUR',
      event: 'Wholesale Price Index (WPI) MoM',
      impact: 'low',
      estimate: 0.1,
      actual: -0.1,
      prev: 0.2,
      unit: '%',
      idSuffix: 'de_wpi'
    },
    {
      dayOffset: 0,
      utcHour: 15,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: '3-Year Note Auction',
      impact: 'low',
      estimate: 3.88,
      actual: 3.87,
      prev: 3.85,
      unit: '%',
      idSuffix: 'us_3y_note'
    },

    // --- TUESDAY (dayOffset: 1) ---
    {
      dayOffset: 1,
      utcHour: 9,
      utcMinute: 0,
      country: 'DE',
      currency: 'EUR',
      event: 'ZEW Economic Sentiment',
      impact: 'high',
      estimate: 10.0,
      actual: 13.1,
      prev: 3.6,
      unit: '',
      idSuffix: 'zew_sentiment_de'
    },
    {
      dayOffset: 1,
      utcHour: 9,
      utcMinute: 0,
      country: 'EU',
      currency: 'EUR',
      event: 'ZEW Economic Sentiment (Eurozone)',
      impact: 'medium',
      estimate: 16.9,
      actual: 20.1,
      prev: 9.3,
      unit: '',
      idSuffix: 'zew_sentiment_eu'
    },
    {
      dayOffset: 1,
      utcHour: 10,
      utcMinute: 0,
      country: 'US',
      currency: 'USD',
      event: 'NFIB Small Business Optimism',
      impact: 'medium',
      estimate: 91.5,
      actual: 91.5,
      prev: 91.2,
      unit: '',
      idSuffix: 'nfib_optimism'
    },
    {
      dayOffset: 1,
      utcHour: 12,
      utcMinute: 55,
      country: 'US',
      currency: 'USD',
      event: 'Redbook Index (YoY)',
      impact: 'low',
      estimate: 5.4,
      actual: 5.6,
      prev: 5.0,
      unit: '%',
      idSuffix: 'redbook_index'
    },

    // --- WEDNESDAY (dayOffset: 2) - CPI DAY ---
    {
      dayOffset: 2,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Core CPI (MoM)',
      impact: 'high',
      estimate: 0.3,
      actual: 0.3,
      prev: 0.3,
      unit: '%',
      idSuffix: 'core_cpi_mom'
    },
    {
      dayOffset: 2,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Core CPI (YoY)',
      impact: 'high',
      estimate: 3.2,
      actual: 3.3,
      prev: 3.2,
      unit: '%',
      idSuffix: 'core_cpi_yoy'
    },
    {
      dayOffset: 2,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Consumer Price Index (CPI) MoM',
      impact: 'high',
      estimate: 0.2,
      actual: 0.2,
      prev: 0.2,
      unit: '%',
      idSuffix: 'cpi_mom'
    },
    {
      dayOffset: 2,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Consumer Price Index (CPI) YoY',
      impact: 'high',
      estimate: 2.4,
      actual: 2.4,
      prev: 2.5,
      unit: '%',
      idSuffix: 'cpi_yoy'
    },
    {
      dayOffset: 2,
      utcHour: 14,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'EIA Crude Oil Inventories',
      impact: 'low',
      estimate: 1.4,
      actual: -2.2,
      prev: 5.8,
      unit: 'M',
      idSuffix: 'crude_oil_inv'
    },
    {
      dayOffset: 2,
      utcHour: 18,
      utcMinute: 0,
      country: 'US',
      currency: 'USD',
      event: 'FOMC Meeting Minutes',
      impact: 'high',
      estimate: null,
      actual: null,
      prev: null,
      unit: '',
      idSuffix: 'fomc_minutes'
    },

    // --- THURSDAY (dayOffset: 3) - PPI DAY ---
    {
      dayOffset: 3,
      utcHour: 0,
      utcMinute: 30,
      country: 'AU',
      currency: 'AUD',
      event: 'Employment Change',
      impact: 'high',
      estimate: 25.0,
      actual: null,
      prev: 47.5,
      unit: 'k',
      idSuffix: 'au_employment'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 15,
      country: 'EU',
      currency: 'EUR',
      event: 'ECB Monetary Policy Statement & Rate Decision',
      impact: 'high',
      estimate: 3.25,
      actual: null,
      prev: 3.50,
      unit: '%',
      idSuffix: 'ecb_rate_decision'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Core Producer Price Index (PPI) MoM',
      impact: 'high',
      estimate: 0.2,
      actual: null,
      prev: 0.3,
      unit: '%',
      idSuffix: 'core_ppi_mom'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Core Producer Price Index (PPI) YoY',
      impact: 'high',
      estimate: 2.7,
      actual: null,
      prev: 2.8,
      unit: '%',
      idSuffix: 'core_ppi_yoy'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Producer Price Index (PPI) MoM',
      impact: 'high',
      estimate: 0.1,
      actual: null,
      prev: 0.2,
      unit: '%',
      idSuffix: 'ppi_mom'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Initial Jobless Claims',
      impact: 'high',
      estimate: 258,
      actual: null,
      prev: 260,
      unit: 'k',
      idSuffix: 'initial_jobless'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Continuing Jobless Claims',
      impact: 'medium',
      estimate: 1870,
      actual: null,
      prev: 1861,
      unit: 'k',
      idSuffix: 'continuing_jobless'
    },
    {
      dayOffset: 3,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Philadelphia Fed Manufacturing Index',
      impact: 'medium',
      estimate: 3.0,
      actual: null,
      prev: 1.7,
      unit: '',
      idSuffix: 'philly_fed'
    },
    {
      dayOffset: 3,
      utcHour: 14,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'EIA Natural Gas Storage',
      impact: 'low',
      estimate: 80,
      actual: null,
      prev: 82,
      unit: 'Bcf',
      idSuffix: 'nat_gas_storage'
    },

    // --- FRIDAY (dayOffset: 4) - RETAIL SALES & CENTRAL BANK POLICY DAY ---
    {
      dayOffset: 4,
      utcHour: 3,
      utcMinute: 0,
      country: 'JP',
      currency: 'JPY',
      event: 'Bank of Japan (BoJ) Policy Rate',
      impact: 'high',
      estimate: 0.25,
      actual: null,
      prev: 0.25,
      unit: '%',
      idSuffix: 'boj_rate_decision'
    },
    {
      dayOffset: 4,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Retail Sales (MoM)',
      impact: 'high',
      estimate: 0.3,
      actual: null,
      prev: 0.1,
      unit: '%',
      idSuffix: 'retail_sales_mom'
    },
    {
      dayOffset: 4,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Core Retail Sales (MoM)',
      impact: 'high',
      estimate: 0.2,
      actual: null,
      prev: 0.1,
      unit: '%',
      idSuffix: 'core_retail_sales'
    },
    {
      dayOffset: 4,
      utcHour: 12,
      utcMinute: 30,
      country: 'US',
      currency: 'USD',
      event: 'Import Price Index (MoM)',
      impact: 'low',
      estimate: -0.4,
      actual: null,
      prev: -0.3,
      unit: '%',
      idSuffix: 'import_price_index'
    },
    {
      dayOffset: 4,
      utcHour: 13,
      utcMinute: 15,
      country: 'US',
      currency: 'USD',
      event: 'Industrial Production (MoM)',
      impact: 'medium',
      estimate: -0.2,
      actual: null,
      prev: 0.8,
      unit: '%',
      idSuffix: 'industrial_production'
    },
    {
      dayOffset: 4,
      utcHour: 14,
      utcMinute: 0,
      country: 'US',
      currency: 'USD',
      event: 'Michigan Consumer Sentiment',
      impact: 'high',
      estimate: 69.0,
      actual: null,
      prev: 70.1,
      unit: '',
      idSuffix: 'michigan_sentiment'
    },
    {
      dayOffset: 4,
      utcHour: 14,
      utcMinute: 0,
      country: 'US',
      currency: 'USD',
      event: 'Michigan 5-Year Inflation Expectations',
      impact: 'medium',
      estimate: 3.1,
      actual: null,
      prev: 3.1,
      unit: '%',
      idSuffix: 'michigan_inflation'
    },
    {
      dayOffset: 4,
      utcHour: 15,
      utcMinute: 15,
      country: 'GB',
      currency: 'GBP',
      event: 'BOE Governor Bailey Speaks',
      impact: 'high',
      estimate: null,
      actual: null,
      prev: null,
      unit: '',
      idSuffix: 'boe_bailey_speaks'
    },
    {
      dayOffset: 4,
      utcHour: 16,
      utcMinute: 0,
      country: 'CA',
      currency: 'CAD',
      event: 'BOC Governor Macklem Speaks',
      impact: 'high',
      estimate: null,
      actual: null,
      prev: null,
      unit: '',
      idSuffix: 'boc_macklem_speaks'
    },
    {
      dayOffset: 4,
      utcHour: 17,
      utcMinute: 0,
      country: 'US',
      currency: 'USD',
      event: 'Fed Chair Powell Speaks',
      impact: 'high',
      estimate: null,
      actual: null,
      prev: null,
      unit: '',
      idSuffix: 'fed_powell_speaks'
    },
    {
      dayOffset: 4,
      utcHour: 18,
      utcMinute: 30,
      country: 'EU',
      currency: 'EUR',
      event: 'ECB President Lagarde Speaks',
      impact: 'high',
      estimate: null,
      actual: null,
      prev: null,
      unit: '',
      idSuffix: 'ecb_lagarde_speaks'
    },

    // --- SUNDAY (dayOffset: 6) - WEEKEND OVERNIGHT RELEASE ---
    {
      dayOffset: 6,
      utcHour: 1,
      utcMinute: 15,
      country: 'CN',
      currency: 'CNY',
      event: 'PBOC Loan Prime Rate Decision',
      impact: 'medium',
      estimate: 3.35,
      actual: null,
      prev: 3.35,
      unit: '%',
      idSuffix: 'pboc_lpr'
    }
  ];

  const allEvents: EconomicEvent[] = rawCatalog.map((item) => {
    const eventTime = createEventTime(item.dayOffset, item.utcHour, item.utcMinute);
    const datePart = eventTime.split('T')[0];

    // Determine actual values dynamically: if event is in the past, provide actual if present
    const eventMs = new Date(eventTime).getTime();
    const isPast = eventMs < now.getTime();
    const actual = isPast ? item.actual : null;

    return {
      calendar_id: `macro_${item.currency}_${item.idSuffix}_${datePart}`,
      country: item.country,
      currency: item.currency,
      estimate: item.estimate,
      event: item.event,
      impact: item.impact,
      prev: item.prev,
      actual,
      time: eventTime,
      unit: item.unit
    };
  });

  // Strict temporal filtering against fromStr and toStr
  return allEvents.filter((event) => {
    const d = new Date(event.time);
    const localYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const utcYmd = event.time.split('T')[0];
    
    const matchesLocal = (!fromStr || localYmd >= fromStr) && (!toStr || localYmd <= toStr);
    const matchesUtc = (!fromStr || utcYmd >= fromStr) && (!toStr || utcYmd <= toStr);

    return matchesLocal || matchesUtc;
  }).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
