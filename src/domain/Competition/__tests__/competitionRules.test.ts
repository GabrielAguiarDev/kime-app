import {
  countdownLabel,
  daysBetween,
  emptyWeekLimits,
  emptyWeekTargets,
  formatLocalDate,
  parseBrDate,
  pastChampionships,
  plannedMlByDate,
  plannedMlOn,
  planInForce,
  targetsToArray,
  upcomingChampionships,
  weightDelta,
} from '../competitionRules';
import type { Championship, WaterPlan } from '../competitionTypes';

const plan = (weekStart: string, targets: Partial<WaterPlan['targets']>, extra: Partial<WaterPlan> = {}): WaterPlan => ({
  id: `p-${weekStart}`,
  academyId: 'a1',
  weekStart,
  updatedAt: `${weekStart}T10:00:00Z`,
  targets: { ...emptyWeekTargets(), ...targets },
  limits: emptyWeekLimits(),
  ...extra,
});

const champ = (name: string, eventDate: string): Championship => ({
  id: name,
  academyId: 'a1',
  modalityId: 'mod-1',
  name,
  eventDate,
  location: '',
});

describe('water plan in force', () => {
  // 2026-11-02 is a Monday.
  const plans = [plan('2026-11-02', { 1: 3000, 3: 3500 }), plan('2026-11-16', { 1: 4000 })];

  it('uses the plan of the week, or the newest earlier one', () => {
    expect(planInForce(plans, '2026-11-04')?.weekStart).toBe('2026-11-02');
    expect(planInForce(plans, '2026-11-11')?.weekStart).toBe('2026-11-02');
    expect(planInForce(plans, '2026-11-17')?.weekStart).toBe('2026-11-16');
  });

  it('has no plan before the first week', () => {
    expect(planInForce(plans, '2026-11-01')).toBeNull();
    expect(plannedMlOn(plans, '2026-11-01')).toBeNull();
  });

  it('reads the target of the weekday (0 = Sunday)', () => {
    expect(plannedMlOn(plans, '2026-11-02')).toBe(3000); // Monday
    expect(plannedMlOn(plans, '2026-11-04')).toBe(3500); // Wednesday
    expect(plannedMlOn(plans, '2026-11-03')).toBeNull(); // Tuesday: automatic goal
    expect(plannedMlOn(plans, '2026-11-16')).toBe(4000);
    expect(plannedMlOn(plans, '2026-11-18')).toBeNull(); // the newer plan has no Wednesday
  });

  it('breaks ties between academies by the last edit', () => {
    const tie = [
      plan('2026-11-02', { 1: 3000 }, { id: 'old', updatedAt: '2026-11-02T08:00:00Z' }),
      plan('2026-11-02', { 1: 2000 }, { id: 'new', academyId: 'a2', updatedAt: '2026-11-03T08:00:00Z' }),
    ];
    expect(plannedMlOn(tie, '2026-11-02')).toBe(2000);
  });

  it('lists planned days ahead for the widget', () => {
    expect(plannedMlByDate(plans, '2026-11-02', 3)).toEqual({ '2026-11-02': 3000, '2026-11-04': 3500 });
    expect(plannedMlByDate(plans, '2026-11-15', 3)).toEqual({ '2026-11-16': 4000 });
  });

  it('sends Sunday first to the RPC', () => {
    expect(targetsToArray({ ...emptyWeekTargets(), 0: 1, 6: 7 })).toEqual([1, null, null, null, null, null, 7]);
  });
});

describe('championships', () => {
  const list = [champ('B', '2026-12-10'), champ('A', '2026-11-04'), champ('Old', '2026-10-01')];

  it('splits upcoming (nearest first) and past (latest first)', () => {
    expect(upcomingChampionships(list, '2026-11-04').map((c) => c.name)).toEqual(['A', 'B']);
    expect(pastChampionships(list, '2026-11-05').map((c) => c.name)).toEqual(['A', 'Old']);
  });

  it('counts days across months and DST', () => {
    expect(daysBetween('2026-11-04', '2026-11-04')).toBe(0);
    expect(daysBetween('2026-11-04', '2026-12-10')).toBe(36);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('labels the countdown', () => {
    expect(countdownLabel(0)).toBe('Hoje');
    expect(countdownLabel(1)).toBe('Amanhã');
    expect(countdownLabel(12)).toBe('Faltam 12 dias');
  });
});

describe('dates and weight', () => {
  it('parses DD/MM/AAAA', () => {
    expect(parseBrDate('10/12/2026')).toBe('2026-12-10');
    expect(parseBrDate('31/02/2026')).toBeNull();
    expect(parseBrDate('1/2/2026')).toBeNull();
  });

  it('formats a local date', () => {
    expect(formatLocalDate('2026-12-05')).toBe('5 dez 2026');
  });

  it('computes the change from the previous weigh-in', () => {
    expect(weightDelta([{ id: '1', loggedOn: '2026-11-01', weightKg: 80 }])).toBeNull();
    expect(
      weightDelta([
        { id: '1', loggedOn: '2026-11-01', weightKg: 80 },
        { id: '2', loggedOn: '2026-11-03', weightKg: 79.4 },
      ]),
    ).toBe(-0.6);
  });
});
