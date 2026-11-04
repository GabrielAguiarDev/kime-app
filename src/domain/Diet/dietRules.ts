import type { LocalDate } from '@domain/Classes/classesTypes';

import type { DietMeal } from './dietTypes';

export const MEAL_NAME_MAX = 80;
export const MEAL_DESCRIPTION_MAX = 2000;

/** Usual meal names offered as shortcuts in the form. */
export const MEAL_SUGGESTIONS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

/** Meals of a day: by time (meals without a time last), then in the order they were added. */
export function mealsOn(meals: DietMeal[], date: LocalDate, academyId?: string): DietMeal[] {
  return meals
    .filter((m) => m.planDate === date && (!academyId || m.academyId === academyId))
    .sort(
      (a, b) =>
        (a.mealTime ?? '99:99').localeCompare(b.mealTime ?? '99:99') ||
        a.academyId.localeCompare(b.academyId) ||
        a.position - b.position,
    );
}

/** Dates that have at least one meal. */
export function daysWithMeals(meals: DietMeal[]): Set<LocalDate> {
  return new Set(meals.map((m) => m.planDate));
}

/** `07:30:00` (Postgres time) → `07:30`. */
export function toMealTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

/** "7h30", "12h". */
export function formatMealTime(time: string): string {
  const [h, m] = time.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
}

/** Typing help for `HH:MM`: digits only, colon added after the hour. */
export function maskTime(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
