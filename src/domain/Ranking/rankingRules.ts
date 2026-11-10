import { addDays, weekStart } from '@domain/Classes/classesRules';

import { RANKING_CONFIG, type RankingConfig } from './rankingConfig';

/**
 * One eligible day of the student in the modality (academy and modality links both active):
 * confirmed classes and the classes the modality's grid has that day.
 */
export interface AttendanceFact { day: string; classes: number; scheduled: number }
export interface HydrationFact { day: string; known: boolean; done: boolean; eligible: boolean }
export interface RankingFacts {
  modalityId: string;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  today: string;
  periodFrom: string;
  periodTo: string;
  /** Eligible days of the period with the confirmed classes of the modality that day. */
  attendance: AttendanceFact[];
  /** Water days of the period. */
  hydration: HydrationFact[];
  /** Mondays of the student's frozen Disciplina weeks: their 7 days leave presence and water. */
  frozenWeeks?: string[];
}
export interface RankingEntry {
  modalityId: string;
  position: number | null;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  rankingScore: number;
  /** Mean of the weekly presence (confirmed ÷ classes in the grid, at most 100 % per week). */
  attendanceRate: number;
  hydrationRate: number;
  confirmedClasses: number;
  /** Classes of the modality's grid on the eligible days of the window. */
  scheduledClasses: number;
  /** Weeks of the window with at least one eligible day. */
  weeks: number;
  hydrationGoalsAchieved: number;
  /** Water days in the denominator (known goal, eligible, outside frozen weeks). */
  eligibleHydrationDays: number;
  /** Eligible days inside frozen Disciplina weeks: out of presence and water. */
  protectedDays: number;
  eligibleDays: number;
  daysToQualify: number;
  status: 'ranked' | 'qualifying';
  /** Position in the previous day's calculation (null: not ranked then, or unknown). */
  previousPosition?: number | null;
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
 * Weekly presence (user decision 2026-11-10: the modality's grid, no weekly goal): the period
 * is split into weeks of 7 days counted back from its last day. Each week counts confirmed ÷
 * the classes of the grid on its eligible days, at most 100 % (a student linked mid-week is
 * only asked for the classes after the link). A week without classes in the grid is left
 * out. The presence is the mean of the weeks that count.
 */
export function weeklyPresence(attendance: AttendanceFact[], periodTo: string) {
  const weeks = new Map<number, { classes: number; scheduled: number }>();
  for (const a of attendance) {
    const week = Math.floor(dayDiff(a.day, periodTo) / 7);
    const w = weeks.get(week) ?? { classes: 0, scheduled: 0 };
    w.classes += a.classes;
    w.scheduled += a.scheduled;
    weeks.set(week, w);
  }
  const rated = [...weeks.values()].filter((w) => w.scheduled > 0);
  if (!rated.length) return { rate: 0, weeks: weeks.size };
  const sum = rated.reduce((n, w) => n + Math.min(1, w.classes / w.scheduled), 0);
  return { rate: sum / rated.length, weeks: weeks.size };
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
    // A frozen Disciplina week leaves the count: no points added nor taken.
    const frozenWeeks = new Set(f.frozenWeeks ?? []);
    const counted = (day: string) => !frozenWeeks.has(weekStart(day));
    // Defensive deduplication in addition to the database query.
    const eligible = [...new Map(f.attendance.filter((a) => inPeriod(a.day)).map((a) => [a.day, a])).values()];
    const attendance = eligible.filter((a) => counted(a.day));
    const protectedDays = eligible.length - attendance.length;
    const water = [...new Map(f.hydration.map((d) => [d.day, d])).values()]
      .filter((d) => inPeriod(d.day) && d.known && d.eligible && counted(d.day));
    const hydrationGoalsAchieved = water.filter((d) => d.done).length;
    const hydrationRate = water.length ? hydrationGoalsAchieved / water.length : 0;
    const presence = weeklyPresence(attendance, f.periodTo);
    const confirmedClasses = attendance.reduce((n, a) => n + a.classes, 0);
    const scheduledClasses = attendance.reduce((n, a) => n + a.scheduled, 0);
    // Qualification counts every eligible day, frozen or not.
    const eligibleDays = eligible.length;
    const score = (presence.rate * config.attendanceWeight + hydrationRate * config.hydrationWeight) * config.score.max;
    const daysToQualify = Math.max(0, config.eligibility.minEligibleDays - eligibleDays);
    return {
      modalityId, userId: f.userId, fullName: f.fullName, avatarPath: f.avatarPath, position: null,
      rankingScore: Math.max(config.score.min, Math.min(config.score.max, score)),
      attendanceRate: presence.rate, hydrationRate, confirmedClasses, scheduledClasses, weeks: presence.weeks,
      hydrationGoalsAchieved, eligibleHydrationDays: water.length, protectedDays,
      eligibleDays, daysToQualify, status: daysToQualify ? 'qualifying' : 'ranked', previousPosition: null,
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

export type RankingTrend = 'up' | 'down' | null;

/** Versus the previous day's calculation; nothing when unchanged or not ranked on both days. */
export function rankingTrend(e: Pick<RankingEntry, 'position' | 'previousPosition'>): RankingTrend {
  if (e.position == null || e.previousPosition == null || e.position === e.previousPosition) return null;
  return e.position < e.previousPosition ? 'up' : 'down';
}

/** Places that get a medal (gold, silver, bronze) instead of the number. */
export const MEDAL_PLACES = 3;

/**
 * Ranking screen sections: the ranked list up to `top`, the viewer's ranked
 * row when below `top`, and the students still qualifying (never mixed with
 * the ranked ones), closest to qualifying first.
 */
export function rankingSections(entries: RankingEntry[], viewerId: string | undefined, top = RANKING_TOP) {
  const ranked = entries
    .filter((e) => e.status === 'ranked' && e.position != null)
    .sort((a, b) => a.position! - b.position!);
  const qualifying = entries
    .filter((e) => e.status !== 'ranked' || e.position == null)
    .sort((a, b) => a.daysToQualify - b.daysToQualify || a.fullName.localeCompare(b.fullName, 'pt-BR'));
  const list = ranked.slice(0, top);
  const own = entries.find((e) => e.userId === viewerId) ?? null;
  const ownBelow = own && ranked.indexOf(own) >= top ? own : null;
  return { list, ownBelow, qualifying, own };
}

/** Retained for attendance summaries outside the competitive ranking. */
export function classesLabel(n: number): string { return `${n} ${n === 1 ? 'aula' : 'aulas'}`; }
