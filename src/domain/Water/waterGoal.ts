/**
 * Daily water goal. The formula lives here and only here.
 *
 * Automatic goal: 35 ml per kg of body weight (spec 4.3).
 * When the professor's weekly plan has a target for today (competitors), it
 * replaces the automatic goal (`plannedMl`).
 */
export const ML_PER_KG = 35;

export function autoDailyGoalMl(weightKg: number | null | undefined): number | null {
  if (!weightKg || weightKg <= 0) return null;
  return Math.round(weightKg * ML_PER_KG);
}

export interface DailyGoalInput {
  weightKg: number | null | undefined;
  /** Professor's plan for today (competitors). */
  plannedMl?: number | null;
}

export interface DailyGoal {
  goalMl: number | null;
  source: 'plan' | 'auto' | null;
}

export function dailyGoal({ weightKg, plannedMl }: DailyGoalInput): DailyGoal {
  if (plannedMl && plannedMl > 0) return { goalMl: plannedMl, source: 'plan' };
  const auto = autoDailyGoalMl(weightKg);
  return auto === null ? { goalMl: null, source: null } : { goalMl: auto, source: 'auto' };
}

/** Goal of a date from a published widget config: the plan's when there is one, else the automatic one. */
export function goalOnDate(config: { goalMl: number | null; goalsByDate?: Record<string, number> }, date: string): number | null {
  return config.goalsByDate?.[date] ?? config.goalMl;
}
