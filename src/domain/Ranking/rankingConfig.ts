export interface RankingConfig {
  attendanceWeight: number;
  hydrationWeight: number;
  penalties: { missedClass: number; missedHydrationGoal: number };
  eligibility: { minEligibleDays: number };
  score: { min: number; max: number };
  rollingDays: number;
}

/** Product tuning; all score calculations live in rankingRules. */
export const RANKING_CONFIG = {
  attendanceWeight: 0.6,
  hydrationWeight: 0.4,
  penalties: { missedClass: 5, missedHydrationGoal: 5 },
  eligibility: { minEligibleDays: 7 },
  score: { min: 0, max: 100 },
  rollingDays: 28,
} as const satisfies RankingConfig;
