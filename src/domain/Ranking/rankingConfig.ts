export interface RankingConfig {
  attendanceWeight: number;
  hydrationWeight: number;
  eligibility: { minEligibleDays: number };
  score: { min: number; max: number };
  /** Complete days of the window, split into weeks of 7 days counted back from yesterday. */
  rollingDays: number;
}

/** Product tuning; all score calculations live in rankingRules. */
export const RANKING_CONFIG = {
  attendanceWeight: 0.7,
  hydrationWeight: 0.3,
  eligibility: { minEligibleDays: 7 },
  score: { min: 0, max: 100 },
  rollingDays: 28,
} as const satisfies RankingConfig;
