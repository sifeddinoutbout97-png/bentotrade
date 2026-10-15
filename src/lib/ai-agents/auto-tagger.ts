/**
 * BentoTrade v5.0 Premium AI Agent - Auto-Tagger Module
 * Background processing agent that evaluates trade metadata and generates monochromatic tag chips.
 */

import { Trade } from '@/types';

export interface CalendarEventForTagging {
  time?: string;
  event?: string;
  impact?: 'high' | 'medium' | 'low';
}

/**
 * Automatically evaluates trade metadata and generates a deduplicated tags array
 */
export function autoTagTrade(
  trade: Partial<Trade>,
  calendarEvents: CalendarEventForTagging[] = []
): string[] {
  const generatedTags: string[] = [];

  // Parse existing tags if present
  if (Array.isArray(trade.tags)) {
    trade.tags.forEach(t => {
      if (t && typeof t === 'string') generatedTags.push(t);
    });
  }

  const tradeTime = trade.trade_date || trade.created_at || '';
  const dateObj = tradeTime ? new Date(tradeTime) : new Date();

  // Rule 1: Time-based (#Opening_Drive)
  // Check if execution is within 15 minutes of US Market Open (09:30 - 09:45 AM EST)
  // Or if the local time is 09:30 - 09:45 or notes mention opening drive
  const hours = dateObj.getUTCHours(); // EST is UTC-4 / UTC-5
  const minutes = dateObj.getUTCMinutes();
  const notesLower = (trade.notes || '').toLowerCase();

  const isOpeningDriveTime = 
    (hours === 13 && minutes >= 30 && minutes <= 45) || // 09:30 - 09:45 EST (UTC 13:30)
    (hours === 14 && minutes >= 30 && minutes <= 45) || // 09:30 - 09:45 EDT (UTC 14:30)
    (dateObj.getHours() === 9 && dateObj.getMinutes() >= 30 && dateObj.getMinutes() <= 45) ||
    notesLower.includes('open') || notesLower.includes('opening drive') || notesLower.includes('09:30');

  if (isOpeningDriveTime) {
    generatedTags.push('#Opening_Drive');
  }

  // Rule 2: Macro-based (#Macro_Volatility)
  // Check if execution time coincides with Finnhub calendar high/medium impact event within 30 mins
  let isMacroVolatility = false;
  if (calendarEvents && calendarEvents.length > 0) {
    const tradeTimeMs = dateObj.getTime();
    for (const evt of calendarEvents) {
      if (evt.time && (evt.impact === 'high' || evt.impact === 'medium')) {
        const evtTimeMs = new Date(evt.time).getTime();
        const diffMinutes = Math.abs(tradeTimeMs - evtTimeMs) / (1000 * 60);
        if (diffMinutes <= 30) {
          isMacroVolatility = true;
          break;
        }
      }
    }
  }

  if (isMacroVolatility || notesLower.includes('macro') || notesLower.includes('fomc') || notesLower.includes('cpi') || notesLower.includes('ppi') || notesLower.includes('fed')) {
    generatedTags.push('#Macro_Volatility');
  }

  // Rule 3: Behavioral - Sub-Optimal R:R (#Sub_Optimal_RR)
  const rr = Number(trade.risk_reward_ratio);
  if (!isNaN(rr) && rr > 0 && rr < 1.0) {
    generatedTags.push('#Sub_Optimal_RR');
  } else if (trade.entry_price && trade.stop_loss && trade.exit_price) {
    const entry = Number(trade.entry_price);
    const stop = Number(trade.stop_loss);
    const exit = Number(trade.exit_price);
    const direction = trade.direction || 'long';
    const risk = Math.abs(direction === 'long' ? entry - stop : stop - entry);
    const reward = Math.abs(direction === 'long' ? exit - entry : entry - exit);
    if (risk > 0 && (reward / risk) < 1.0) {
      generatedTags.push('#Sub_Optimal_RR');
    }
  }

  // Rule 4: Behavioral - Size Escalation (#Size_Escalation)
  const positionSize = Number(trade.position_size) || 1;
  if (positionSize >= 2 || notesLower.includes('size escalation') || notesLower.includes('2x size')) {
    generatedTags.push('#Size_Escalation');
  }

  // Deduplicate and return clean array
  const uniqueTags = Array.from(new Set(generatedTags));
  return uniqueTags;
}
