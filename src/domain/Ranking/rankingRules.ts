import { addDays } from '@domain/Classes/classesRules';
import { computeStreak, WATER_STREAK_RULE } from '@domain/Streaks/streakRules';

import { RANKING_CONFIG, type RankingConfig } from './rankingConfig';

/** One eligible day of the student in the modality (academy and modality links both active). */
export interface AttendanceFact { day: string; classes: number }
export interface HydrationFact { day: string; known: boolean; done: boolean; eligible: boolean }
export interface RankingFacts {
  modalityId: string;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  today: string;
  periodFrom: string;
  periodTo: string;
  /** Confirmed classes per week that count as 100 % (student override or the modality's goal). */
  weeklyGoal: number;
  /** Eligible days of the period with the confirmed classes of the modality that day. */
  attendance: AttendanceFact[];
  /** Entire known history, including before periodFrom, for the water freezes. */
  hydration: HydrationFact[];
}
export interface RankingEntry {
  modalityId: string;
  position: number | null;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  rankingScore: number;
  /** Mean of the weekly presence (confirmed ÷ weekly goal, at most 100 % per week). */
  attendanceRate: number;
  hydrationRate: number;
  confirmedClasses: number;
  weeklyGoal: number;
  /** Weeks of the window with at least one eligible day. */
  weeks: number;
  hydrationGoalsAchieved: number;
  /** Water days in the denominator (known goal, eligible, not covered by a freeze). */
  eligibleHydrationDays: number;
  /** Missed water days covered by a freeze: out of the denominator. */
  protectedDays: number;
  eligibleDays: number;
  daysToQualify: number;
  status: 'ranked' | 'qualifying';
}

/** Inclusive, complete days only; the current day is deliberately left open. */
export function rankingPeriod(today: string, days: number = RANKING_CONFIG.rollingDays) {
  return { from: addDays(today, -days), to: addDays(today, -1) };
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Weekly presence: the period is split into weeks of 7 days counted back from
 * its last day. Each week with eligible days counts confirmed ÷ goal, at most
 * 100 %, with the goal prorated by the eligible days of that week (a student
 * linked mid-week is not asked for a whole week). The presence is the mean of
 * those weeks.
 */
export function weeklyPresence(attendance: AttendanceFact[], periodTo: string, weeklyGoal: number) {
  const weeks = new Map<number, { days: number; classes: number }>();
  for (const a of attendance) {
    const week = Math.floor(dayDiff(a.day, periodTo) / 7);
    const w = weeks.get(week) ?? { days: 0, classes: 0 };
    w.days += 1;
    w.classes += a.classes;
    weeks.set(week, w);
  }
  if (!weeks.size || weeklyGoal <= 0) return { rate: 0, weeks: weeks.size };
  let sum = 0;
  for (const w of weeks.values()) sum += Math.min(1, w.classes / ((weeklyGoal * w.days) / 7));
  return { rate: sum / weeks.size, weeks: weeks.size };
}

/** The single score implementation. Inputs are authorized, server-derived facts;
 * no score/freeze is persisted or writable by the client. No penalties.
 */
export function calculateRanking(facts: RankingFacts[], modalityId: string, config: RankingConfig = RANKING_CONFIG): RankingEntry[] {
  if (!modalityId || facts.some((f) => f.modalityId !== modalityId)) {
    throw new Error('Os fatos do ranking devem pertencer à modalidade solicitada.');
  }
  const entries = facts.map((f): RankingEntry => {
    const inPeriod = (day: string) => day >= f.periodFrom && day <= f.periodTo && day < f.today;
    // Defensive deduplication in addition to the database query.
    const attendance = [...new Map(f.attendance.filter((a) => inPeriod(a.day)).map((a) => [a.day, a])).values()];
    const history = [...new Map(f.hydration.filter((d) => d.day < f.today).map((d) => [d.day, d])).values()]
      .sort((a, b) => a.day.localeCompare(b.day));
    // Reuse the existing automatic daily water freeze rule. The final key is
    // open, so every historical failure is evaluated as a closed period.
    const done = new Set(history.filter((d) => d.known && d.done).map((d) => d.day));
    const streak = computeStreak([...history.map((d) => d.day), f.today], done, WATER_STREAK_RULE);
    const frozen = new Set(streak.periods.filter((p) => p.state === 'frozen').map((p) => p.key));
    const waterDays = history.filter((d) => inPeriod(d.day) && d.known && d.eligible);
    // A day covered by a freeze leaves the denominator: no points added nor taken.
    const water = waterDays.filter((d) => d.done || !frozen.has(d.day));
    const protectedDays = waterDays.length - water.length;
    const hydrationGoalsAchieved = water.filter((d) => d.done).length;
    const hydrationRate = water.length ? hydrationGoalsAchieved / water.length : 0;
    const presence = weeklyPresence(attendance, f.periodTo, f.weeklyGoal);
    const confirmedClasses = attendance.reduce((n, a) => n + a.classes, 0);
    const eligibleDays = attendance.length;
    const score = (presence.rate * config.attendanceWeight + hydrationRate * config.hydrationWeight) * config.score.max;
    const daysToQualify = Math.max(0, config.eligibility.minEligibleDays - eligibleDays);
    return {
      modalityId, userId: f.userId, fullName: f.fullName, avatarPath: f.avatarPath, position: null,
      rankingScore: Math.max(config.score.min, Math.min(config.score.max, score)),
      attendanceRate: presence.rate, hydrationRate, confirmedClasses, weeklyGoal: f.weeklyGoal, weeks: presence.weeks,
      hydrationGoalsAchieved, eligibleHydrationDays: water.length, protectedDays,
      eligibleDays, daysToQualify, status: daysToQualify ? 'qualifying' : 'ranked',
    };
  });
  // Tie-break: score, confirmed classes in the period, water rate, then a stable id.
  entries.sort((a, b) =>
    Number(a.status === 'qualifying') - Number(b.status === 'qualifying') ||
    b.rankingScore - a.rankingScore || b.confirmedClasses - a.confirmedClasses ||
    b.hydrationRate - a.hydrationRate ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  let position = 0;
  return entries.map((entry) => ({ ...entry, position: entry.status === 'ranked' ? ++position : null }));
}

export const RANKING_TOP = 20;
export function visibleRanking(entries: RankingEntry[], viewerId: string | undefined, top = RANKING_TOP) {
  const rows = entries.slice(0, top);
  const own = entries.find((e) => e.userId === viewerId) ?? null;
  return { rows, own: own && !rows.includes(own) ? own : null };
}

/** Retained for attendance summaries outside the competitive ranking. */
export function classesLabel(n: number): string { return `${n} ${n === 1 ? 'aula' : 'aulas'}`; }
