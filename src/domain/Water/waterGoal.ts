/**
 * Daily water goal. The formula lives here and only here.
 *
 * Automatic goal: 35 ml per kg of body weight (spec 4.3).
 * Phase 4: when a professor's weekly plan has a target for today, it replaces
 * the automatic goal (`plannedMl`).
 */
export const ML_PER_KG = 35;

export function autoDailyGoalMl(weightKg: number | null | undefined): number | null {
  if (!weightKg || weightKg <= 0) return null;
  return Math.round(weightKg * ML_PER_KG);
}

export interface DailyGoalInput {
  weightKg: number | null | undefined;
  /** Professor's plan for today (phase 4). */
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
