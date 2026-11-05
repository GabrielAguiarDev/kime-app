import { addDays } from '@domain/Classes/classesRules';
import { computeStreak, WATER_STREAK_RULE } from '@domain/Streaks/streakRules';

import { RANKING_CONFIG, type RankingConfig } from './rankingConfig';

export interface AttendanceFact { id: string; day: string; done: boolean }
export interface HydrationFact { day: string; known: boolean; done: boolean; eligible: boolean }
export interface RankingFacts {
  modalityId: string;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  today: string;
  periodFrom: string;
  periodTo: string;
  attendance: AttendanceFact[];
  /** Entire known history, including before periodFrom, for existing freezes. */
  hydration: HydrationFact[];
}
export interface RankingEntry {
  modalityId: string;
  position: number | null;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  performanceScore: number;
  penaltyPoints: number;
  rankingScore: number;
  attendanceRate: number;
  hydrationRate: number;
  validCheckIns: number;
  eligibleClasses: number;
  hydrationGoalsAchieved: number;
  eligibleHydrationDays: number;
  unprotectedAttendanceFailures: number;
  unprotectedHydrationFailures: number;
  protectedFailures: number;
  eligibleDays: number;
  completedDays: number;
  daysToQualify: number;
  status: 'ranked' | 'qualifying';
}

/** Inclusive, complete days only; the current day is deliberately left open. */
export function rankingPeriod(today: string, days: number = RANKING_CONFIG.rollingDays) {
  return { from: addDays(today, -days), to: addDays(today, -1) };
}

/** The single score implementation. Inputs are authorized, server-derived facts;
 * no score/freeze/penalty is persisted or writable by the client.
 */
export function calculateRanking(facts: RankingFacts[], modalityId: string, config: RankingConfig = RANKING_CONFIG): RankingEntry[] {
  if (!modalityId || facts.some((f) => f.modalityId !== modalityId)) {
    throw new Error('Os fatos do ranking devem pertencer à modalidade solicitada.');
  }
  const entries = facts.map((f): RankingEntry => {
    const inPeriod = (day: string) => day >= f.periodFrom && day <= f.periodTo && day < f.today;
    // Defensive deduplication in addition to the database constraints.
    const attendance = [...new Map(f.attendance.filter((a) => inPeriod(a.day)).map((a) => [a.id, a])).values()];
    const history = [...new Map(f.hydration.filter((d) => d.day < f.today).map((d) => [d.day, d])).values()]
      .sort((a, b) => a.day.localeCompare(b.day));
    // Reuse the existing automatic daily water freeze rule. The final key is
    // open, so every historical failure is evaluated as a closed period.
    const done = new Set(history.filter((d) => d.known && d.done).map((d) => d.day));
    const streak = computeStreak([...history.map((d) => d.day), f.today], done, WATER_STREAK_RULE);
    const frozen = new Set(streak.periods.filter((p) => p.state === 'frozen').map((p) => p.key));
    const water = history.filter((d) => inPeriod(d.day) && d.known && d.eligible);
    const validCheckIns = attendance.filter((a) => a.done).length;
    const hydrationGoalsAchieved = water.filter((d) => d.done).length;
    const protectedFailures = water.filter((d) => !d.done && frozen.has(d.day)).length;
    const unprotectedAttendanceFailures = attendance.length - validCheckIns;
    const unprotectedHydrationFailures = water.length - hydrationGoalsAchieved - protectedFailures;
    const attendanceRate = attendance.length ? validCheckIns / attendance.length : 0;
    const hydrationRate = water.length ? hydrationGoalsAchieved / water.length : 0;
    const eligibleDays = new Set([...attendance.map((a) => a.day), ...water.map((d) => d.day)]).size;
    const completedDays = new Set([...attendance.filter((a) => a.done).map((a) => a.day), ...water.filter((d) => d.done).map((d) => d.day)]).size;
    const performanceScore = (attendanceRate * config.attendanceWeight + hydrationRate * config.hydrationWeight) * config.score.max;
    const penaltyPoints = unprotectedAttendanceFailures * config.penalties.missedClass + unprotectedHydrationFailures * config.penalties.missedHydrationGoal;
    const daysToQualify = Math.max(0, config.eligibility.minEligibleDays - eligibleDays);
    return {
      modalityId, userId: f.userId, fullName: f.fullName, avatarPath: f.avatarPath, position: null,
      performanceScore, penaltyPoints,
      rankingScore: Math.max(config.score.min, Math.min(config.score.max, performanceScore - penaltyPoints)),
      attendanceRate, hydrationRate, validCheckIns, eligibleClasses: attendance.length,
      hydrationGoalsAchieved, eligibleHydrationDays: water.length,
      unprotectedAttendanceFailures, unprotectedHydrationFailures, protectedFailures,
      eligibleDays, completedDays, daysToQualify, status: daysToQualify ? 'qualifying' : 'ranked',
    };
  });
  entries.sort((a, b) =>
    Number(a.status === 'qualifying') - Number(b.status === 'qualifying') ||
    b.rankingScore - a.rankingScore || b.attendanceRate - a.attendanceRate ||
    b.hydrationRate - a.hydrationRate || b.completedDays - a.completedDays ||
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
