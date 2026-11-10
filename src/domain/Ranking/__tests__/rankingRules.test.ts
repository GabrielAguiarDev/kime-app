import { addDays } from '@domain/Classes/classesRules';

import { RANKING_CONFIG, type RankingConfig } from '../rankingConfig';
import {
  calculateRanking as calculateModalityRanking,
  rankingPeriod,
  rankingSections,
  rankingTrend,
  type RankingEntry,
  weeklyPresence,
  type AttendanceFact,
  type HydrationFact,
  type RankingFacts,
} from '../rankingRules';

// Day 1 … 28 = the period; day 29 = today (open).
const day = (n: number) => addDays('2026-11-01', n - 1);
const water = (count: number, done = true, start = 1): HydrationFact[] =>
  Array.from({ length: count }, (_, i) => ({ day: day(start + i), done, known: true, eligible: true }));
/** The modality's grid: one class on the 1st and 3rd day of each week (days 1, 3, 8, 10 …). */
const inGrid = (n: number) => [0, 2].includes((n - 1) % 7);
/** 28 eligible days; `classesOn` = days (1-based) with one confirmed class; `grid` = classes per grid day. */
const days = (classesOn: number[] = [], count = 28, start = 1, grid = 1): AttendanceFact[] =>
  Array.from({ length: count }, (_, i) => ({
    day: day(start + i),
    classes: classesOn.includes(start + i) ? 1 : 0,
    scheduled: inGrid(start + i) ? grid : 0,
  }));
/** Every class of the grid: two in each of the four weeks (weeks counted back from day 28: 22–28, 15–21, 8–14, 1–7). */
const FULL = [1, 3, 8, 10, 15, 17, 22, 24];
const facts = (overrides: Partial<RankingFacts> = {}): RankingFacts => ({
  modalityId: 'mt', userId: 'a', fullName: 'Ana', avatarPath: null, today: day(29), periodFrom: day(1), periodTo: day(28),
  attendance: days(FULL), hydration: water(28), ...overrides,
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

  it('scores 100 at every class of the grid and every water goal met', () => {
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

  it('measures presence against the classes of the grid', () => {
    // Two classes on each grid day: 4 a week; the same 2 classes a week = 50%.
    expect(result({ attendance: days(FULL, 28, 1, 2) }).attendanceRate).toBeCloseTo(0.5);
    expect(result({ attendance: days(FULL) }).scheduledClasses).toBe(8);
  });

  it('asks a student linked mid-week only for the classes after the link', () => {
    // Only days 24–28 eligible: one class in the grid (day 24), attended = 100%.
    expect(weeklyPresence(days([24], 5, 24), day(28)).rate).toBe(1);
  });

  it('leaves out a week without classes in the grid', () => {
    // Days 25–28 have no grid class: nothing to measure, no presence (and no penalty).
    expect(weeklyPresence(days([], 4, 25), day(28)).rate).toBe(0);
    const att = days(FULL).map((a) => (a.day >= day(22) ? { ...a, classes: 0, scheduled: 0 } : a));
    expect(weeklyPresence(att, day(28)).rate).toBe(1);
  });

  it('counts only eligible days inside the period', () => {
    const f = facts({ attendance: [...days(FULL), { day: '2026-10-01', classes: 3, scheduled: 1 }, { day: day(29), classes: 1, scheduled: 1 }] });
    expect(calculateRanking([f])[0]!.confirmedClasses).toBe(8);
  });

  it('has no presence without eligible days', () => {
    const r = result({ attendance: [] });
    expect(r.attendanceRate).toBe(0);
    expect(r.rankingScore).toBe(30);
  });

  it('water = days the student met their own goal, never the volume', () => {
    const r = result({ hydration: water(28).map((d, i) => ({ ...d, done: i % 2 === 0 })) });
    expect(r.hydrationRate).toBe(0.5);
    expect(r.rankingScore).toBe(85);
  });

  it('ignores days without a known goal and days outside the period', () => {
    const r = result({ hydration: [{ ...water(1)[0]!, known: false, done: false }, ...water(2, false, 29)] });
    expect(r.eligibleHydrationDays).toBe(0);
  });

  it('a missed water day counts as not met (no daily freeze)', () => {
    const r = result({ hydration: [...water(7), ...water(1, false, 8)] });
    expect(r.protectedDays).toBe(0);
    expect(r.hydrationRate).toBe(7 / 8);
  });

  it('a frozen Disciplina week takes its 7 days out of presence and water', () => {
    // Days 9–15 = Monday 2026-11-09 to Sunday 11-15: no class, no water, frozen.
    const frozen = (n: number) => n >= 9 && n <= 15;
    const attendance = days(FULL.filter((n) => !frozen(n)));
    const hydration = water(28).map((d, i) => ({ ...d, done: !frozen(i + 1) }));
    const r = result({ attendance, hydration, frozenWeeks: ['2026-11-09'] });
    expect(r.protectedDays).toBe(7);
    expect(r.eligibleHydrationDays).toBe(21);
    expect(r.hydrationRate).toBe(1);
    expect(r.scheduledClasses).toBe(6);
    expect(r.attendanceRate).toBe(1);
    expect(r.eligibleDays).toBe(28);
    // Without the freeze the same week costs points.
    expect(result({ attendance, hydration }).rankingScore).toBeLessThan(100);
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
      facts({ userId: 'w', attendance: days([1, 8, 15, 22]), ...water75 }),
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
      Array.from({ length: 25 }, (_, i) => facts({ userId: `u${String(i).padStart(2, '0')}` })),
    );
    const { list, ownBelow } = rankingSections(entries, 'u24');
    expect(list).toHaveLength(20);
    expect(ownBelow?.userId).toBe('u24');
  });
});

describe('ranking screen sections', () => {
  const entry = (userId: string, position: number | null, extra: Partial<RankingEntry> = {}) =>
    ({ userId, position, fullName: userId, status: position == null ? 'qualifying' : 'ranked', daysToQualify: 0, ...extra }) as RankingEntry;

  it('splits ranked and qualifying, never mixed', () => {
    const entries = [entry('a', 1), entry('b', 2), entry('c', 3), entry('d', 4), entry('q2', null, { daysToQualify: 5 }), entry('q1', null, { daysToQualify: 2 })];
    const s = rankingSections(entries, 'q2');
    expect(s.list.map((e) => e.userId)).toEqual(['a', 'b', 'c', 'd']);
    expect(s.qualifying.map((e) => e.userId)).toEqual(['q1', 'q2']);
    expect(s.own?.userId).toBe('q2');
    expect(s.ownBelow).toBeNull();
  });

  it('trend compares with the previous day', () => {
    expect(rankingTrend({ position: 4, previousPosition: 6 })).toBe('up');
    expect(rankingTrend({ position: 6, previousPosition: 4 })).toBe('down');
    expect(rankingTrend({ position: 4, previousPosition: 4 })).toBeNull();
    expect(rankingTrend({ position: 4, previousPosition: null })).toBeNull();
    expect(rankingTrend({ position: null, previousPosition: 2 })).toBeNull();
  });
});
