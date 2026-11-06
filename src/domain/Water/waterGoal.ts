/**
 * Daily water goal. The formula lives here and only here.
 *
 * Automatic goal: 35 ml per kg of body weight (spec 4.3).
 * When the professor's weekly plan has a target for today (competitors), it
 * replaces the personal goal and then the automatic goal (`plannedMl`).
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
  personalMl?: number | null;
}

export interface DailyGoal {
  goalMl: number | null;
  source: 'plan' | 'personal' | 'auto' | null;
}

export function dailyGoal({ weightKg, plannedMl, personalMl }: DailyGoalInput): DailyGoal {
  if (plannedMl && plannedMl > 0) return { goalMl: plannedMl, source: 'plan' };
  if (personalMl && Number.isInteger(personalMl) && personalMl > 0) return { goalMl: personalMl, source: 'personal' };
  const auto = autoDailyGoalMl(weightKg);
  return auto === null ? { goalMl: null, source: null } : { goalMl: auto, source: 'auto' };
}

/** Goal of a date from a published widget config: the plan's when there is one, else the personal/automatic fallback. */
export function goalOnDate(config: { goalMl: number | null; goalsByDate?: Record<string, number> }, date: string): number | null {
  return config.goalsByDate?.[date] ?? config.goalMl;
}

/** One rule for a daily goal or limit. Exact integer comparison avoids rounding at 90%. */
export function waterDayState(totalMl: number, targetMl: number | null | undefined, isLimit = false): 'unconfigured' | 'progress' | 'done' | 'over' {
  if (!targetMl || targetMl <= 0) return 'unconfigured';
  if (isLimit && totalMl > targetMl) return 'over';
  return (isLimit ? totalMl * 10 >= targetMl * 9 : totalMl >= targetMl) ? 'done' : 'progress';
}
