import { addDays } from '@domain/Classes/classesRules';

import { RANKING_CONFIG, type RankingConfig } from '../rankingConfig';
import { calculateRanking as calculateModalityRanking, rankingPeriod, visibleRanking, type RankingFacts, type HydrationFact } from '../rankingRules';

const day = (n: number) => addDays('2026-11-01', n - 1);
const water = (count: number, done = true, start = 1): HydrationFact[] => Array.from({ length: count }, (_, i) => ({ day: day(start + i), done, known: true, eligible: true }));
const facts = (overrides: Partial<RankingFacts> = {}): RankingFacts => ({
  modalityId: 'mt', userId: 'a', fullName: 'Ana', avatarPath: null, today: day(29), periodFrom: day(1), periodTo: day(28),
  attendance: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, day: day(i + 1), done: true })),
  hydration: water(10), ...overrides,
});
const calculateRanking = (rows: RankingFacts[], config?: RankingConfig) => calculateModalityRanking(rows, 'mt', config);
const result = (overrides: Partial<RankingFacts> = {}) => calculateRanking([facts(overrides)])[0]!;

describe('continuous competitive ranking', () => {
  it('uses a moving interval, without resetting at the month boundary', () => {
    expect(rankingPeriod('2026-11-04')).toEqual({ from: '2026-10-07', to: '2026-11-03' });
    expect(rankingPeriod('2026-11-04', 7)).toEqual({ from: '2026-10-28', to: '2026-11-03' });
  });
  it('awards 100 for all expected classes and hydration goals completed', () => expect(result().rankingScore).toBe(100));
  it('reduces performance and adds five points of penalty for a required absence', () => {
    const f = facts(); f.attendance[0]!.done = false;
    const r = calculateRanking([f])[0]!;
    expect(r.attendanceRate).toBe(0.9); expect(r.penaltyPoints).toBe(5); expect(r.rankingScore).toBe(89);
  });
  it('deduplicates class occurrences', () => {
    const f = facts(); f.attendance.push({ ...f.attendance[0]! });
    expect(calculateRanking([f])[0]!.eligibleClasses).toBe(10);
  });
  it('does not fabricate attendance when the server has no expected classes', () => {
    const r = result({ attendance: [] }); expect(r.attendanceRate).toBe(0); expect(r.unprotectedAttendanceFailures).toBe(0); expect(r.rankingScore).toBe(40);
  });
  it('does not score classes outside the period, including before enrolment facts', () => {
    const f = facts(); f.attendance.push({ id: 'old', day: '2026-10-01', done: false });
    expect(calculateRanking([f])[0]!.penaltyPoints).toBe(0);
  });
  it('does not count today or future classes', () => {
    expect(result({ attendance: [{ id: 'open', day: day(29), done: false }, { id: 'future', day: day(30), done: true }] }).eligibleClasses).toBe(0);
  });
  it('has no litres or target size in score inputs; equal completion gives equal recognition', () => {
    const entries = calculateRanking([facts({ userId: 'small-goal' }), facts({ userId: 'large-goal' })]);
    expect(entries[0]!.rankingScore).toBe(entries[1]!.rankingScore);
  });
  it('does not give extra points for surplus water or duplicated daily facts', () => {
    const f = facts(); f.hydration.push(...water(10)); expect(calculateRanking([f])[0]!.rankingScore).toBe(100);
    expect(calculateRanking([f])[0]!.hydrationGoalsAchieved).toBe(10);
  });
  it('penalizes an unprotected water failure, without treating it as complete', () => {
    const r = result({ hydration: [{ ...water(1)[0]!, done: false }] });
    expect(r.unprotectedHydrationFailures).toBe(1); expect(r.hydrationGoalsAchieved).toBe(0); expect(r.penaltyPoints).toBe(5);
  });
  it('does not penalize the current hydration day', () => {
    expect(result({ hydration: water(1, false, 29) }).eligibleHydrationDays).toBe(0);
  });
  it('uses the historical completed outcome after a goal/weight change', () => {
    const historical = water(2); expect(result({ hydration: historical }).hydrationRate).toBe(1);
  });
  it('excludes days with no valid goal', () => {
    expect(result({ hydration: [{ ...water(1)[0]!, known: false, done: false }] }).unprotectedHydrationFailures).toBe(0);
  });
  it('excludes noneligible membership days from penalties and qualifying days', () => {
    const r = result({ attendance: [], hydration: water(10, false).map((d) => ({ ...d, eligible: false })) });
    expect(r.eligibleDays).toBe(0); expect(r.penaltyPoints).toBe(0);
  });
  it('protects one missed water day after seven completed days', () => {
    const r = result({ hydration: [...water(7), ...water(1, false, 8)] });
    expect(r.protectedFailures).toBe(1); expect(r.penaltyPoints).toBe(0); expect(r.hydrationRate).toBe(7 / 8);
  });
  it('does not award completed activity points for a frozen day', () => {
    const r = result({ hydration: [...water(7), ...water(1, false, 8)] });
    expect(r.hydrationGoalsAchieved).toBe(7); expect(r.completedDays).toBe(10); expect(r.performanceScore).toBe(95);
  });
  it('does not consume a freeze twice for duplicated facts', () => {
    const r = result({ hydration: [...water(7), ...water(1, false, 8), ...water(1, false, 8)] });
    expect(r.protectedFailures).toBe(1);
  });
  it('penalizes the next failure when the water freeze is exhausted', () => {
    const r = result({ hydration: [...water(7), ...water(2, false, 8)] });
    expect(r.protectedFailures).toBe(1); expect(r.unprotectedHydrationFailures).toBe(1);
  });
  it('does not use a water freeze to protect a class absence on the same day', () => {
    const r = result({ attendance: [{ id: 'a', day: day(8), done: false }], hydration: [...water(7), ...water(1, false, 8)] });
    expect(r.protectedFailures).toBe(1); expect(r.unprotectedAttendanceFailures).toBe(1); expect(r.penaltyPoints).toBe(5);
  });
  it('does not invent individual attendance freezes from weekly training freezes', () => expect(result({ attendance: [{ id: 'a', day: day(1), done: false }] }).unprotectedAttendanceFailures).toBe(1));
  it('calculates the requested 90/80 weighted performance as 86', () => {
    const f = facts(); f.attendance[0]!.done = false; f.hydration[0]!.done = false; f.hydration[1]!.done = false;
    expect(calculateRanking([f])[0]!.performanceScore).toBeCloseTo(86);
  });
  it('adds independent attendance and hydration penalties', () => {
    const r = result({ attendance: [{ id: 'a', day: day(1), done: false }], hydration: water(1, false) });
    expect(r.penaltyPoints).toBe(10);
  });
  it('clamps a deeply negative score to zero', () => expect(result({ hydration: water(28, false) }).rankingScore).toBe(0));
  it('never exceeds 100', () => expect(result({ hydration: water(28) }).rankingScore).toBeLessThanOrEqual(100));
  it('qualifies newcomers without assigning a competitive position', () => {
    const r = result({ attendance: [], hydration: water(1) });
    expect(r.status).toBe('qualifying'); expect(r.position).toBeNull(); expect(r.daysToQualify).toBe(6);
  });
  it('counts distinct eligible days, not a class and water twice', () => expect(result().eligibleDays).toBe(10));
  it('allows competition at seven real eligible days', () => expect(result({ attendance: [], hydration: water(7) }).position).toBe(1));
  it('sorts qualifying students after competitors even when their score is higher', () => {
    const f = facts(); f.hydration = water(10, false);
    const list = calculateRanking([f, facts({ userId: 'new', attendance: [{ id: 'a', day: day(1), done: true }], hydration: water(1) })]);
    expect(list[0]!.userId).toBe('a'); expect(list[1]!.position).toBeNull();
  });
  it('breaks exact ties by stable identity', () => expect(calculateRanking([facts({ userId: 'b' }), facts({ userId: 'a' })]).map((r) => r.userId)).toEqual(['a', 'b']));
  it('breaks score ties with attendance then hydration rates', () => {
    const a = facts({ userId: 'a', attendance: [], hydration: water(10) });
    const b = facts({ userId: 'b', hydration: water(10, false) });
    // Different performance here demonstrates attendance ordering at zero final scores.
    a.hydration = water(10, false); b.attendance[0]!.done = false;
    expect(calculateRanking([a, b])[0]!.userId).toBe('b');
  });
  it('breaks equal scores/rates with completed days', () => {
    expect(calculateRanking([facts({ userId: 'a' }), facts({ userId: 'b', hydration: water(11) })])[0]!.userId).toBe('b');
  });
  it('excludes old penalties but retains preperiod history for existing freezes', () => {
    const r = result({ periodFrom: day(8), hydration: [...water(7), ...water(1, false, 8)] });
    expect(r.protectedFailures).toBe(1); expect(r.penaltyPoints).toBe(0);
  });
  it('does not import penalties from another month into a custom interval', () => {
    expect(result({ hydration: [{ day: '2026-10-01', known: true, eligible: true, done: false }, ...water(10)] }).penaltyPoints).toBe(0);
  });
  it('allows recovery through legitimate completion/correction', () => {
    const f = facts(); f.attendance[0]!.done = false;
    const before = calculateRanking([f])[0]!.rankingScore;
    f.attendance[0]!.done = true; expect(calculateRanking([f])[0]!.rankingScore).toBeGreaterThan(before);
  });
  it('recalculates deterministically without mutating input or consuming freezes', () => {
    const f = facts({ hydration: [...water(7), ...water(2, false, 8)] });
    const original = JSON.stringify(f); const first = calculateRanking([f]);
    for (let i = 0; i < 5; i++) expect(calculateRanking([f])).toEqual(first);
    expect(JSON.stringify(f)).toBe(original);
  });
  it('breaks zero-score attendance ties by hydration rate', () => {
    const list = calculateRanking([
      facts({ userId: 'a', attendance: [], hydration: water(10, false) }),
      facts({ userId: 'b', attendance: [], hydration: [...water(10, false), ...water(1, true, 11)] }),
    ]);
    expect(list.map((r) => r.rankingScore)).toEqual([0, 0]);
    expect(list[0]!.userId).toBe('b');
  });
  it('uses configurable penalties and classification threshold', () => {
    const f = facts({ attendance: [], hydration: [...water(1, false), ...water(2, true, 2)] });
    const r = calculateRanking([f], {
      ...RANKING_CONFIG,
      penalties: { missedClass: 2, missedHydrationGoal: 3 },
      eligibility: { minEligibleDays: 3 },
    })[0]!;
    expect(r.penaltyPoints).toBe(3);
    expect(r.status).toBe('ranked');
  });
  it('shows the viewer even beyond the top twenty', () => {
    const entries = calculateRanking(Array.from({ length: 30 }, (_, i) => facts({ userId: `u${String(i).padStart(2, '0')}` })));
    expect(visibleRanking(entries, 'u25').own?.userId).toBe('u25');
    expect(visibleRanking(entries, 'u01').own).toBeNull();
  });
  it('rejects facts from another modality rather than filtering a global score', () => {
    expect(() => calculateModalityRanking([facts({ modalityId: 'bjj' })], 'mt')).toThrow('modalidade solicitada');
    expect(() => calculateModalityRanking([], '')).toThrow('modalidade solicitada');
  });
  it('shares one frozen water day across modalities without mutating history', () => {
    const history = [...water(7), ...water(1, false, 8)];
    const before = JSON.stringify(history);
    const mt = calculateModalityRanking([facts({ hydration: history })], 'mt')[0]!;
    const bjj = calculateModalityRanking([facts({ modalityId: 'bjj', attendance: [], hydration: history })], 'bjj')[0]!;
    expect(mt.protectedFailures).toBe(1); expect(bjj.protectedFailures).toBe(1);
    expect(mt.hydrationRate).toBe(bjj.hydrationRate);
    expect(JSON.stringify(history)).toBe(before);
  });
  it('keeps modality-specific eligibility separate from global freeze history', () => {
    const history = [...water(7), ...water(1, false, 8)];
    const mt = calculateModalityRanking([facts({ hydration: history })], 'mt')[0]!;
    const bjj = calculateModalityRanking([facts({ modalityId: 'bjj', attendance: [], hydration: history.map((d) => ({ ...d, eligible: d.day >= day(8) })) })], 'bjj')[0]!;
    expect(mt.hydrationRate).toBe(7 / 8); expect(bjj.hydrationRate).toBe(0);
    expect(bjj.protectedFailures).toBe(1); expect(bjj.status).toBe('qualifying');
  });
  it('a missed class in one modality has no effect on another ranking', () => {
    const mt = facts(); mt.attendance[0]!.done = false;
    const bjj = facts({ modalityId: 'bjj' });
    expect(calculateModalityRanking([mt], 'mt')[0]!.penaltyPoints).toBe(5);
    expect(calculateModalityRanking([bjj], 'bjj')[0]!.rankingScore).toBe(100);
  });
  it('centralizes weights and penalties', () => {
    expect(RANKING_CONFIG.attendanceWeight + RANKING_CONFIG.hydrationWeight).toBe(1);
    expect(RANKING_CONFIG.eligibility.minEligibleDays).toBe(7);
  });
});
