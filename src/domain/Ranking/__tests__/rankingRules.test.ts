import { addDays } from '@domain/Classes/classesRules';

import { RANKING_CONFIG, type RankingConfig } from '../rankingConfig';
import {
  calculateRanking as calculateModalityRanking,
  rankingPeriod,
  visibleRanking,
  weeklyPresence,
  type AttendanceFact,
  type HydrationFact,
  type RankingFacts,
} from '../rankingRules';

// Day 1 … 28 = the period; day 29 = today (open).
const day = (n: number) => addDays('2026-11-01', n - 1);
const water = (count: number, done = true, start = 1): HydrationFact[] =>
  Array.from({ length: count }, (_, i) => ({ day: day(start + i), done, known: true, eligible: true }));
/** 28 eligible days; `classesOn` = days (1-based) with one confirmed class. */
const days = (classesOn: number[] = [], count = 28, start = 1): AttendanceFact[] =>
  Array.from({ length: count }, (_, i) => ({ day: day(start + i), classes: classesOn.includes(start + i) ? 1 : 0 }));
/** Two classes in each of the four weeks (weeks counted back from day 28: 22–28, 15–21, 8–14, 1–7). */
const FULL = [1, 3, 8, 10, 15, 17, 22, 24];
const facts = (overrides: Partial<RankingFacts> = {}): RankingFacts => ({
  modalityId: 'mt', userId: 'a', fullName: 'Ana', avatarPath: null, today: day(29), periodFrom: day(1), periodTo: day(28),
  weeklyGoal: 2, attendance: days(FULL), hydration: water(28), ...overrides,
});
const calculateRanking = (rows: RankingFacts[], config?: RankingConfig) => calculateModalityRanking(rows, 'mt', config);
const result = (overrides: Partial<RankingFacts> = {}) => calculateRanking([facts(overrides)])[0]!;

describe('ranking formula', () => {
  it('uses the last 28 complete days', () => {
    expect(rankingPeriod('2026-11-04')).toEqual({ from: '2026-10-07', to: '2026-11-03' });
  });

  it('centralizes the weights: 70% presence, 30% water, no penalties', () => {
    expect(RANKING_CONFIG.attendanceWeight).toBe(0.7);
    expect(RANKING_CONFIG.hydrationWeight).toBe(0.3);
    expect(RANKING_CONFIG).not.toHaveProperty('penalties');
  });

  it('scores 100 with the weekly goal met every week and every water goal met', () => {
    expect(result().rankingScore).toBe(100);
  });

  it('presence = mean of the weeks, each capped at 100%', () => {
    // Week 22–28: 4 classes (capped at 100%); 15–21: 1 (50%); 8–14: 0; 1–7: 2 (100%) → 62.5%.
    const r = result({ attendance: days([1, 3, 15, 22, 23, 24, 25]), hydration: [] });
    expect(r.attendanceRate).toBeCloseTo(0.625);
    expect(r.rankingScore).toBeCloseTo(43.75);
  });

  it('extra classes in one week do not make up for another week', () => {
    expect(result({ attendance: days([22, 23, 24, 25, 26, 27]), hydration: [] }).attendanceRate).toBeCloseTo(0.25);
  });

  it('uses the student weekly goal', () => {
    expect(result({ weeklyGoal: 4 }).attendanceRate).toBeCloseTo(0.5);
    expect(result({ weeklyGoal: 1 }).attendanceRate).toBe(1);
  });

  it('prorates the goal of a week with fewer eligible days (linked mid-week)', () => {
    // Only days 25–28 eligible (4 days of the last week): goal 2 × 4/7; one class = 87.5%.
    expect(weeklyPresence(days([25], 4, 25), day(28), 2).rate).toBeCloseTo(0.875);
  });

  it('counts only eligible days inside the period', () => {
    const f = facts({ attendance: [...days(FULL), { day: '2026-10-01', classes: 3 }, { day: day(29), classes: 1 }] });
    expect(calculateRanking([f])[0]!.confirmedClasses).toBe(8);
  });

  it('has no presence without eligible days', () => {
    const r = result({ attendance: [] });
    expect(r.attendanceRate).toBe(0);
    expect(r.rankingScore).toBe(30);
  });

  it('water = days the student met their own goal, never the volume', () => {
    // Alternate days: never 7 in a row, so no freeze.
    const r = result({ hydration: water(28).map((d, i) => ({ ...d, done: i % 2 === 0 })) });
    expect(r.hydrationRate).toBe(0.5);
    expect(r.rankingScore).toBe(85);
  });

  it('ignores days without a known goal and days outside the period', () => {
    const r = result({ hydration: [{ ...water(1)[0]!, known: false, done: false }, ...water(2, false, 29)] });
    expect(r.eligibleHydrationDays).toBe(0);
  });

  it('a frozen water day leaves the denominator: no points added nor taken', () => {
    // 7 days met → one freeze → day 8 missed is covered.
    const r = result({ hydration: [...water(7), ...water(1, false, 8), ...water(2, true, 9)] });
    expect(r.protectedDays).toBe(1);
    expect(r.eligibleHydrationDays).toBe(9);
    expect(r.hydrationRate).toBe(1);
  });

  it('a missed day with the freezes used up counts as not met', () => {
    const r = result({ hydration: water(3, false) });
    expect(r.protectedDays).toBe(0);
    expect(r.hydrationRate).toBe(0);
  });

  it('the same water history gives the same water rate in every modality', () => {
    const hydration = [...water(7), ...water(1, false, 8)];
    const mt = calculateModalityRanking([facts({ hydration })], 'mt')[0]!;
    const bjj = calculateModalityRanking([facts({ hydration, modalityId: 'bjj', attendance: days([1]) })], 'bjj')[0]!;
    expect(mt.hydrationRate).toBe(bjj.hydrationRate);
    expect(mt.attendanceRate).not.toBe(bjj.attendanceRate);
  });

  it('qualifies after 7 eligible days, without a position before', () => {
    const newcomer = result({ attendance: days([28], 6, 23), hydration: [] });
    expect(newcomer.status).toBe('qualifying');
    expect(newcomer.daysToQualify).toBe(1);
    expect(newcomer.position).toBeNull();
    expect(result({ attendance: days([], 7, 22) }).status).toBe('ranked');
  });

  it('qualifying students come after ranked ones even with a higher score', () => {
    const entries = calculateRanking([
      facts({ userId: 'new', attendance: days(FULL.filter((d) => d >= 23), 6, 23) }),
      facts({ userId: 'old', hydration: [] }),
    ]);
    expect(entries.map((e) => e.userId)).toEqual(['old', 'new']);
    expect(entries.map((e) => e.position)).toEqual([1, null]);
  });

  it('breaks ties by confirmed classes in the period, then water rate, then a stable id', () => {
    const more = facts({ userId: 'z', attendance: days([...FULL, 2, 9]) });
    const water75 = { hydration: [...water(21), ...water(7, false, 22)] };
    const entries = calculateRanking([
      facts({ userId: 'b' }),
      facts({ userId: 'a' }),
      more,
      facts({ userId: 'w', weeklyGoal: 1, attendance: days([1, 8, 15, 22]), ...water75 }),
    ]);
    expect(entries.map((e) => e.userId)).toEqual(['z', 'a', 'b', 'w']);
  });

  it('rejects facts of another modality', () => {
    expect(() => calculateModalityRanking([facts({ modalityId: 'bjj' })], 'mt')).toThrow('modalidade solicitada');
  });

  it('does not mutate its input', () => {
    const f = facts();
    const copy = JSON.parse(JSON.stringify(f));
    calculateRanking([f]);
    expect(f).toEqual(copy);
  });

  it('shows the viewer even beyond the top twenty', () => {
    const entries = calculateRanking(
      Array.from({ length: 25 }, (_, i) => facts({ userId: `u${String(i).padStart(2, '0')}`, weeklyGoal: i + 1 })),
    );
    const { rows, own } = visibleRanking(entries, 'u24');
    expect(rows).toHaveLength(20);
    expect(own?.userId).toBe('u24');
  });
});
