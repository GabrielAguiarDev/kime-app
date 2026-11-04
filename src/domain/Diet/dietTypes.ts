import type { LocalDate } from '@domain/Classes/classesTypes';

/** One meal of a competitor's diet day, written by staff. */
export interface DietMeal {
  id: string;
  academyId: string;
  planDate: LocalDate;
  position: number;
  name: string;
  /** `HH:MM`, or null when the professor left the time out. */
  mealTime: string | null;
  description: string;
}

export interface DietMealInput {
  name: string;
  /** `HH:MM` or null. */
  mealTime: string | null;
  description: string;
}
