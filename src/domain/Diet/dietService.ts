import type { LocalDate } from '@domain/Classes/classesTypes';
import { toAppError } from '@infra/supabase';

import { dietApi as api, type DietDayRowApi } from './dietApi';
import { toMealTime } from './dietRules';
import type { DietMeal, DietMealInput } from './dietTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

function toMeals(day: DietDayRowApi): DietMeal[] {
  return day.meals.map((m) => ({
    id: m.id,
    academyId: day.academy_id,
    planDate: day.plan_date,
    position: m.position,
    name: m.name,
    mealTime: toMealTime(m.meal_time),
    description: m.description,
  }));
}

export const dietService = {
  /** Every meal of the athlete between two dates (inclusive). */
  listMeals: (athleteId: string, from: LocalDate, to: LocalDate): Promise<DietMeal[]> =>
    call(async () => (await api.listDays(athleteId, from, to)).flatMap(toMeals)),
  saveMeal: (academyId: string, athleteId: string, date: LocalDate, mealId: string | null, input: DietMealInput) =>
    call(() =>
      api.saveMeal(academyId, athleteId, date, mealId, input.name.trim(), input.mealTime, input.description.trim()),
    ),
  deleteMeal: (id: string) => call(() => api.deleteMeal(id)),
  copyDay: (academyId: string, athleteId: string, from: LocalDate, to: LocalDate) =>
    call(() => api.copyDay(academyId, athleteId, from, to)),
};
