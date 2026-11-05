import {
  computeStreak,
  dayRange,
  mergeWaterDays,
  trainingStreak,
  waterStreak,
  weekRange,
  type StreakRule,
} from '../streakRules';

const rule: StreakRule = { earnEvery: 3, maxFreezes: 2 };
const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${String(i).padStart(2, '0')}`);

describe('computeStreak', () => {
  it('counts consecutive periods and keeps the record', () => {
    const k = keys(6);
    const done = new Set([k[0]!, k[1]!, k[3]!, k[4]!]);
    const s = computeStreak(k, done, rule);
    // k2 missed (no freeze yet: 2 < 3) → reset; k3, k4 done; k5 open.
    expect(s.current).toBe(2);
    expect(s.record).toBe(2);
    expect(s.periods.map((p) => p.state)).toEqual(['done', 'done', 'missed', 'done', 'done', 'open']);
    expect(s.currentDone).toBe(false);
  });

  it('earns a freeze every N periods and spends it on a miss', () => {
    const k = keys(6);
    const done = new Set([k[0]!, k[1]!, k[2]!, k[4]!, k[5]!]);
    const s = computeStreak(k, done, rule);
    expect(s.periods.map((p) => p.state)).toEqual(['done', 'done', 'done', 'frozen', 'done', 'done']);
    expect(s.current).toBe(5);
    expect(s.freezes).toBe(0);
    expect(s.currentDone).toBe(true);
  });

  it('keeps at most maxFreezes', () => {
    const k = keys(12);
    const s = computeStreak(k, new Set(k), rule);
    expect(s.current).toBe(12);
    expect(s.freezes).toBe(2);
  });

  it('two misses in a row with one freeze break the streak', () => {
    const k = keys(7);
    const done = new Set([k[0]!, k[1]!, k[2]!, k[5]!]);
    const s = computeStreak(k, done, rule);
    expect(s.periods.map((p) => p.state)).toEqual(['done', 'done', 'done', 'frozen', 'missed', 'done', 'open']);
    expect(s.current).toBe(1);
    expect(s.record).toBe(3);
  });

  it('nothing done yet', () => {
    const s = computeStreak(keys(3), new Set(), rule);
    expect(s).toEqual({ current: 0, record: 0, freezes: 0, currentDone: false, periods: [] });
  });
});

describe('water and training', () => {
  it('a water day counts only when the goal of that day is reached', () => {
    const s = waterStreak(
      [
        { day: '2026-11-01', totalMl: 2500, goalMl: 2500 },
        { day: '2026-11-02', totalMl: 3000, goalMl: 3500 },
        { day: '2026-11-03', totalMl: 3000, goalMl: null },
        { day: '2026-11-04', totalMl: 2600, goalMl: 2500 },
      ],
      '2026-11-05',
    );
    expect(s.periods.map((p) => p.state)).toEqual(['done', 'missed', 'missed', 'done', 'open']);
    expect(s.current).toBe(1);
  });

  it('7 water days earn a freeze that covers the 8th', () => {
    const days = dayRange('2026-11-01', '2026-11-07').map((day) => ({ day, totalMl: 2000, goalMl: 2000 }));
    days.push({ day: '2026-11-09', totalMl: 2000, goalMl: 2000 });
    const s = waterStreak(days, '2026-11-09');
    expect(s.current).toBe(8);
    expect(s.periods[7]).toEqual({ key: '2026-11-08', state: 'frozen' });
  });

  it('training: the current week without a class does not break the streak', () => {
    // 2026-11-02 and 2026-11-09 are Mondays.
    const s = trainingStreak(['2026-10-28', '2026-11-04'], '2026-11-11');
    expect(s.current).toBe(2);
    expect(s.periods.map((p) => p.key)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(s.periods[2]!.state).toBe('open');
  });

  it('ranges', () => {
    expect(dayRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(weekRange('2026-11-04', '2026-11-16')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });

  it('merges server and device totals', () => {
    const merged = mergeWaterDays(
      [{ day: '2026-11-03', totalMl: 1000, goalMl: 2500 }],
      [
        { day: '2026-11-03', totalMl: 1500 },
        { day: '2026-11-04', totalMl: 500 },
      ],
      () => 3000,
    );
    expect(merged).toEqual([
      { day: '2026-11-03', totalMl: 1500, goalMl: 2500 },
      { day: '2026-11-04', totalMl: 500, goalMl: 3000, isLimit: false },
    ]);
  });
});

it('does not count a limit day above 100% in the water streak', () => {
  const days = [
    { day: '2026-11-01', totalMl: 1800, goalMl: 2000, isLimit: true },
    { day: '2026-11-02', totalMl: 2001, goalMl: 2000, isLimit: true },
  ];
  expect(waterStreak(days, '2026-11-03').periods.map((p) => p.state)).toEqual(['done', 'missed', 'open']);
});
