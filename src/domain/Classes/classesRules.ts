import type { Belt } from '@components';

import type { BeltGoal, ClassSchedule, LocalDate, Weekday } from './classesTypes';

// ----------------------------------------------------------------- dates ---
// Local dates are plain `YYYY-MM-DD` strings in the academy timezone (the
// server tells "today"); math is done in UTC so the device timezone never
// shifts a day.

function toUtc(date: LocalDate): Date {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function weekdayOf(date: LocalDate): Weekday {
  return toUtc(date).getUTCDay() as Weekday;
}

/** Monday of the week (weeks run Monday–Sunday). */
export function weekStart(date: LocalDate): LocalDate {
  const dow = weekdayOf(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  0: { short: 'Dom', long: 'Domingo' },
  1: { short: 'Seg', long: 'Segunda' },
  2: { short: 'Ter', long: 'Terça' },
  3: { short: 'Qua', long: 'Quarta' },
  4: { short: 'Qui', long: 'Quinta' },
  5: { short: 'Sex', long: 'Sexta' },
  6: { short: 'Sáb', long: 'Sábado' },
};

/** Monday first, as the week is shown in the app. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** `HH:MM` 24h. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

// --------------------------------------------------------------- streak ---

/**
 * Weekly streak: consecutive weeks with at least one CONFIRMED class. The
 * current week does not break the streak while it has no class yet (the
 * student may still train this week): counting starts at the current week if
 * it has a class, otherwise at the previous one.
 */
export function weeklyStreak(confirmedDates: LocalDate[], today: LocalDate): number {
  const weeks = new Set(confirmedDates.map(weekStart));
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

// ----------------------------------------------------------- milestones ---

/** 10, 25, 50, 100, then every 100. */
export function isClassMilestone(total: number): boolean {
  return total === 10 || total === 25 || total === 50 || (total >= 100 && total % 100 === 0);
}

/** Highest milestone reached when the total went from `previous` to `current`, if any. */
export function milestoneCrossed(previous: number, current: number): number | null {
  for (let n = current; n > previous; n--) {
    if (isClassMilestone(n)) return n;
  }
  return null;
}

// -------------------------------------------------------- belt progress ---

export interface BeltProgress {
  /** The belt being worked toward; null when there is no next goal. */
  next: BeltGoal | null;
  done: number;
  required: number;
}

/**
 * Next belt = the goal right after the current belt in the academy order
 * (the first goal when the member has no belt yet). Progress counts confirmed
 * classes since the last graduation.
 */
export function beltProgress(goals: BeltGoal[], current: Belt | null, sinceBelt: number): BeltProgress {
  const ordered = [...goals].sort((a, b) => a.position - b.position);
  const index = current ? ordered.findIndex((g) => g.belt === current) : -1;
  const next = ordered[index + 1] ?? null;
  return { next, done: Math.min(sinceBelt, next?.classesRequired ?? sinceBelt), required: next?.classesRequired ?? 0 };
}

/** Classes per node of the graduation trail (11.2): "Aulas 21–30". */
export const TRAIL_BLOCK = 10;

export type TrailNodeState = 'done' | 'current' | 'future';

export interface TrailNode {
  /** 1-based class numbers covered by the node. */
  from: number;
  to: number;
  state: TrailNodeState;
  /** Classes done inside this node. */
  doneInNode: number;
}

/** Splits the classes required for the next belt into blocks of TRAIL_BLOCK. */
export function trailNodes(required: number, done: number, block = TRAIL_BLOCK): TrailNode[] {
  const nodes: TrailNode[] = [];
  for (let from = 1; from <= required; from += block) {
    const to = Math.min(from + block - 1, required);
    const doneInNode = Math.max(0, Math.min(done - (from - 1), to - from + 1));
    const state: TrailNodeState = done >= to ? 'done' : done >= from - 1 ? 'current' : 'future';
    nodes.push({ from, to, state, doneInNode });
  }
  return nodes;
}

// ----------------------------------------------------------- modalities ---

/** Suggestions when creating an academy; the academy keeps its own list. */
export const SUGGESTED_MODALITIES = ['Jiu-Jitsu', 'No-Gi', 'Muay Thai', 'Judô', 'Boxe', 'MMA', 'Wrestling', 'Karatê'];

/** Case-insensitive, trimmed comparison for modality names. */
export function sameModality(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

// -------------------------------------------------------------- classes ---

export function sortByTime(schedules: ClassSchedule[]): ClassSchedule[] {
  return [...schedules].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Active classes of the academy-local `date`, by start time. */
export function classesOn(schedules: ClassSchedule[], date: LocalDate): ClassSchedule[] {
  const dow = weekdayOf(date);
  return sortByTime(schedules.filter((s) => s.active && s.weekday === dow));
}
