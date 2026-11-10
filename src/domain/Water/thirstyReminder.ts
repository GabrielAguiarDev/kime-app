import { addDays } from '@domain/Classes/classesRules';
import { zonedTime } from '@domain/Reminders/reminderRules';

import { localDate } from './waterRules';

/** Local hour (profile time zone) of the thirsty mascot — same as the widgets (WaterStore.thirstyHour). */
export const THIRSTY_HOUR = '18:00';

/**
 * "O Kimi está com sede." reminders at 18:00 (profile time zone) for today and the next
 * `days - 1` days, same rules as the widget's thirsty state:
 *  - today only when nothing was logged yet and 18:00 is still ahead;
 *  - never on a limit day of the water plan (competitors cutting weight).
 * A local notification cannot check the water at 18:00: the app re-plans whenever the
 * day's total changes, so logging in the app cancels today's.
 */
export function planThirstyReminders({
  now,
  timeZone,
  todayTotalMl,
  limitsByDate,
  days,
}: {
  now: Date;
  timeZone: string;
  todayTotalMl: number;
  limitsByDate: Record<string, boolean>;
  days: number;
}): Date[] {
  const today = localDate(now, timeZone);
  const result: Date[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    if (limitsByDate[date]) continue;
    if (i === 0 && todayTotalMl > 0) continue;
    const at = zonedTime(date, THIRSTY_HOUR, timeZone);
    if (at.getTime() > now.getTime()) result.push(at);
  }
  return result;
}
