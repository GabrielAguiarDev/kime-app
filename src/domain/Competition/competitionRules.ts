import { addDays, weekdayOf, weekStart } from '@domain/Classes/classesRules';
import type { LocalDate, Weekday } from '@domain/Classes/classesTypes';

import type { Championship, WaterPlan, WeekLimits, WeekTargets, WeightLog } from './competitionTypes';

export const WATER_PLAN_MIN_ML = 500;
export const WATER_PLAN_MAX_ML = 20000;

export function emptyWeekTargets(): WeekTargets {
  return { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
}

export function emptyWeekLimits(): WeekLimits {
  return { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
}

export function limitsToArray(limits: WeekLimits): boolean[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => limits[d]);
}

/** The array set_water_plan expects: index 0 = Sunday … 6 = Saturday. */
export function targetsToArray(targets: WeekTargets): (number | null)[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => targets[d]);
}

export function isValidPlanTarget(ml: number): boolean {
  return Number.isInteger(ml) && ml >= WATER_PLAN_MIN_ML && ml <= WATER_PLAN_MAX_ML;
}

/**
 * The plan in force on a date: the newest plan whose week started on or before
 * that date's week. Between academies (an athlete competing for two), the most
 * recent week wins, then the last edited.
 */
export function planInForce(plans: WaterPlan[], date: LocalDate): WaterPlan | null {
  const week = weekStart(date);
  let best: WaterPlan | null = null;
  for (const plan of plans) {
    if (plan.weekStart > week) continue;
    if (
      !best ||
      plan.weekStart > best.weekStart ||
      (plan.weekStart === best.weekStart && plan.updatedAt > best.updatedAt)
    ) {
      best = plan;
    }
  }
  return best;
}

/** Staff target for a date, or null (automatic goal). */
export function plannedIsLimitOn(plans: WaterPlan[], date: LocalDate): boolean {
  const plan = planInForce(plans, date);
  return !!plan?.targets[weekdayOf(date)] && !!plan.limits[weekdayOf(date)];
}

export function plannedLimitsByDate(plans: WaterPlan[], from: LocalDate, days: number): Record<LocalDate, boolean> {
  const out: Record<LocalDate, boolean> = {};
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (plannedIsLimitOn(plans, date)) out[date] = true;
  }
  return out;
}

export function plannedMlOn(plans: WaterPlan[], date: LocalDate): number | null {
  return planInForce(plans, date)?.targets[weekdayOf(date)] ?? null;
}

/** Planned ml for `days` dates from `from` (widget: the goal still changes at midnight without the app). */
export function plannedMlByDate(plans: WaterPlan[], from: LocalDate, days: number): Record<LocalDate, number> {
  const out: Record<LocalDate, number> = {};
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const ml = plannedMlOn(plans, date);
    if (ml !== null) out[date] = ml;
  }
  return out;
}

/** Whole days between two local dates (b − a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Championships from today on, nearest first. */
export function upcomingChampionships(list: Championship[], today: LocalDate): Championship[] {
  return list
    .filter((c) => c.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.name.localeCompare(b.name));
}

/** Past championships, most recent first. */
export function pastChampionships(list: Championship[], today: LocalDate): Championship[] {
  return list
    .filter((c) => c.eventDate < today)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.name.localeCompare(b.name));
}

/** "Hoje", "Amanhã", "Faltam 12 dias". */
export function countdownLabel(days: number): string {
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Faltam ${days} dias`;
}

/** Newest first. */
export function sortWeights(logs: WeightLog[]): WeightLog[] {
  return [...logs].sort((a, b) => b.loggedOn.localeCompare(a.loggedOn));
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

/** Years with weigh-ins, newest first ("2026", "2025"). */
export function weightYears(logs: WeightLog[]): string[] {
  return [...new Set(logs.map((l) => l.loggedOn.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
}

/** Months (1–12) of `year` with weigh-ins, newest first. */
export function weightMonths(logs: WeightLog[], year: string): number[] {
  const months = logs.filter((l) => l.loggedOn.startsWith(`${year}-`)).map((l) => Number(l.loggedOn.slice(5, 7)));
  return [...new Set(months)].sort((a, b) => b - a);
}

/** Weigh-ins of a year and, optionally, a month (null = all), newest first. */
export function filterWeights(logs: WeightLog[], year: string | null, month: number | null): WeightLog[] {
  const prefix = year ? (month ? `${year}-${String(month).padStart(2, '0')}-` : `${year}-`) : '';
  return sortWeights(logs.filter((l) => l.loggedOn.startsWith(prefix)));
}

/** Change from the previous weigh-in (kg, one decimal), or null with fewer than two. */
export function weightDelta(logs: WeightLog[]): number | null {
  const [latest, previous] = sortWeights(logs);
  if (!latest || !previous) return null;
  return Math.round((latest.weightKg - previous.weightKg) * 10) / 10;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "15 dez 2026" (no time zone shift: the date is already local). */
export function formatLocalDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** "12/11" for short lists. */
export function formatShortDate(date: LocalDate): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/** "79,5" */
export function formatKg(kg: number): string {
  return kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** `DD/MM/AAAA` → LocalDate, or null. */
export function parseBrDate(text: string): LocalDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** LocalDate → `DD/MM/AAAA`. */
export function toBrDate(date: LocalDate): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
