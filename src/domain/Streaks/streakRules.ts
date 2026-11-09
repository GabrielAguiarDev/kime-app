import { waterDayState } from '@domain/Water/waterGoal';
import { addDays, weekStart } from '@domain/Classes/classesRules';
import type { LocalDate } from '@domain/Classes/classesTypes';

/**
 * Streaks ("disciplina") with freezes, computed from history only: the same
 * history gives the same result on every device, nothing is stored.
 *
 * Walking the periods (days or weeks) from the first completed one:
 *  - completed: the streak grows; every `earnEvery` completed periods of the
 *    running streak earn a freeze (at most `maxFreezes` kept);
 *  - missed with a freeze in stock (and a streak to protect): the freeze is
 *    spent, the period is "frozen" and the streak keeps its value;
 *  - missed without a freeze: the streak goes back to 0;
 *  - the CURRENT period never breaks anything while it is not completed
 *    (there is still time).
 */

export type PeriodState = 'done' | 'frozen' | 'missed' | 'open';

export interface StreakRule {
  earnEvery: number;
  maxFreezes: number;
}

/** Water: one freeze per 7 days in a row, at most 2 kept. */
export const WATER_STREAK_RULE: StreakRule = { earnEvery: 7, maxFreezes: 2 };
/** Training: one freeze per 4 weeks in a row, at most 2 kept. */
export const TRAINING_STREAK_RULE: StreakRule = { earnEvery: 4, maxFreezes: 2 };

export interface Streak {
  /** Periods in the running streak (frozen ones do not count). */
  current: number;
  /** Longest streak ever. */
  record: number;
  /** Freezes in stock. */
  freezes: number;
  /** The current period is already completed (flame lit). */
  currentDone: boolean;
  /** State of each period, oldest first, from the first completed one to the current. */
  periods: { key: LocalDate; state: PeriodState }[];
}

/**
 * @param keys every period from the first one to consider up to the current one, in order
 * @param done the completed periods
 */
export function computeStreak(keys: LocalDate[], done: Set<LocalDate>, rule: StreakRule): Streak {
  let current = 0;
  let record = 0;
  let freezes = 0;
  const periods: Streak['periods'] = [];
  const first = keys.findIndex((k) => done.has(k));
  const last = keys.length - 1;

  if (first >= 0) {
    for (let i = first; i <= last; i++) {
      const key = keys[i]!;
      if (done.has(key)) {
        current += 1;
        record = Math.max(record, current);
        if (current % rule.earnEvery === 0) freezes = Math.min(rule.maxFreezes, freezes + 1);
        periods.push({ key, state: 'done' });
      } else if (i === last) {
        periods.push({ key, state: 'open' });
      } else if (current > 0 && freezes > 0) {
        freezes -= 1;
        periods.push({ key, state: 'frozen' });
      } else {
        current = 0;
        periods.push({ key, state: 'missed' });
      }
    }
  }

  const lastKey = keys[last];
  return { current, record, freezes, currentDone: !!lastKey && done.has(lastKey), periods };
}

/** Every date from `from` to `to` (inclusive). */
export function dayRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Every Monday from the week of `from` to the week of `to`. */
export function weekRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const end = weekStart(to);
  for (let w = weekStart(from); w <= end; w = addDays(w, 7)) out.push(w);
  return out;
}

export interface WaterDayTotal {
  day: LocalDate;
  totalMl: number;
  /** Goal of that day; null = unknown (no weight): the day cannot count. */
  goalMl: number | null;
  isLimit?: boolean;
}

/** Water streak: a day counts when its total reaches its goal. */
export function waterStreak(days: WaterDayTotal[], today: LocalDate): Streak {
  const done = new Set(days.filter((d) => waterDayState(d.totalMl, d.goalMl, d.isLimit) === 'done').map((d) => d.day));
  const first = days.reduce<LocalDate | null>((min, d) => (min === null || d.day < min ? d.day : min), null);
  return computeStreak(first && first <= today ? dayRange(first, today) : [today], done, WATER_STREAK_RULE);
}

/** Training streak: a week (Monday–Sunday) counts with at least one confirmed class. */
export function trainingStreak(confirmedDates: LocalDate[], today: LocalDate): Streak {
  const done = new Set(confirmedDates.map(weekStart));
  const first = confirmedDates.reduce<LocalDate | null>((min, d) => (min === null || d < min ? d : min), null);
  return computeStreak(first && first <= today ? weekRange(first, today) : [weekStart(today)], done, TRAINING_STREAK_RULE);
}

/**
 * Merges the server's per-day totals with the device's (logs not synced yet,
 * the widget): per day, the larger total wins; the goal comes from the server
 * row, else from `goalFor`.
 */
export function mergeWaterDays(
  server: WaterDayTotal[],
  local: { day: LocalDate; totalMl: number }[],
  goalFor: (day: LocalDate) => number | null,
  isLimitFor: (day: LocalDate) => boolean = () => false,
): WaterDayTotal[] {
  const byDay = new Map<LocalDate, WaterDayTotal>();
  for (const d of server) byDay.set(d.day, { ...d });
  for (const d of local) {
    const row = byDay.get(d.day);
    if (row) row.totalMl = Math.max(row.totalMl, d.totalMl);
    else byDay.set(d.day, { day: d.day, totalMl: d.totalMl, goalMl: goalFor(d.day), isLimit: isLimitFor(d.day) });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** "1 dia", "12 dias", "1 semana", "3 semanas". */
export function streakUnit(count: number, unit: 'day' | 'week'): string {
  if (unit === 'day') return count === 1 ? 'dia' : 'dias';
  return count === 1 ? 'semana' : 'semanas';
}
