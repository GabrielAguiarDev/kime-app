import { classesAdapter } from '../classesAdapter';
import {
  bestMonth,
  graduationSteps,
  modalityMilestones,
  monthlySeries,
  reportTotal,
  reportWeeklyAverage,
} from '../classReport';
import { durationLabel, monthShortLabel, monthYearLabel, weeklyAverage } from '../classesRules';
import type { ClassReport, ModalityBelt } from '../classesTypes';

const belt = (id: string, position: number, classesRequired: number): ModalityBelt => ({
  id,
  modalityId: 'bjj',
  primary: 'white',
  tip: null,
  position,
  classesRequired,
});
const BELTS = [belt('white', 1, 10), belt('blue', 2, 20), belt('purple', 3, 30)];

const report = (over: Partial<ClassReport> = {}): ClassReport => ({
  joinedAt: '2026-01-05T12:00:00Z',
  today: '2026-11-09',
  recentSince: '2026-08-09',
  enrollments: [],
  modalities: [
    { modalityId: 'bjj', total: 30, sinceBelt: 4, recent: 13 },
    { modalityId: 'muay', total: 12, sinceBelt: 12, recent: 0 },
  ],
  months: [
    { month: '2026-03-01', modalityId: 'bjj', classes: 8 },
    { month: '2026-03-01', modalityId: 'muay', classes: 4 },
    { month: '2026-10-01', modalityId: 'bjj', classes: 9 },
    { month: '2025-10-01', modalityId: 'bjj', classes: 1 },
  ],
  weeks: ['2026-10-19', '2026-10-26', '2026-11-02'],
  belts: [
    { modalityId: 'bjj', beltId: 'white', awardedAt: '2026-03-01T12:00:00Z', nextAwardedAt: '2026-08-01T12:00:00Z', classes: 16 },
    { modalityId: 'bjj', beltId: 'blue', awardedAt: '2026-08-01T12:00:00Z', nextAwardedAt: null, classes: 4 },
  ],
  milestones: [
    { modalityId: 'bjj', count: 25, date: '2026-09-10' },
    { modalityId: 'bjj', count: 10, date: '2026-03-20' },
  ],
  ...over,
});

describe('report numbers', () => {
  it('sums the totals of every modality or one', () => {
    expect(reportTotal(report(), null)).toBe(42);
    expect(reportTotal(report(), 'muay')).toBe(12);
  });
  it('averages the recent window per week', () => {
    // 13 classes in 93 days.
    expect(reportWeeklyAverage(report(), 'bjj')).toBe(1);
  });
  it('lists the last 12 months, the current one last', () => {
    const series = monthlySeries(report(), null);
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: '2025-12-01', classes: 0 });
    expect(series[11]).toEqual({ month: '2026-11-01', classes: 0 });
    expect(series.find((m) => m.month === '2026-03-01')?.classes).toBe(12);
    expect(monthlySeries(report(), 'bjj').find((m) => m.month === '2026-03-01')?.classes).toBe(8);
  });
  it('finds the best month across modalities', () => {
    expect(bestMonth(report())).toEqual({ month: '2026-03-01', classes: 12 });
    expect(bestMonth(report({ months: [] }))).toBeNull();
  });
  it('sorts the milestones', () => {
    expect(modalityMilestones(report(), 'bjj').map((m) => m.count)).toEqual([10, 25]);
  });
});

describe('graduationSteps', () => {
  it('marks done, current and future steps of the sequence', () => {
    const steps = graduationSteps(BELTS, report(), 'bjj');
    expect(steps.map((s) => [s.key, s.state])).toEqual([
      ['start', 'done'],
      ['white', 'done'],
      ['blue', 'current'],
      ['purple', 'future'],
    ]);
    // Fundamentos: 30 − (16 + 4) classes before the first belt.
    expect(steps[0]).toMatchObject({ classes: 10, to: '2026-03-01T12:00:00Z' });
    expect(steps[1]).toMatchObject({ classes: 16, from: '2026-03-01T12:00:00Z', to: '2026-08-01T12:00:00Z' });
    expect(steps[1]!.weeklyAverage).toBeCloseTo(0.7, 1);
    expect(steps[2]).toMatchObject({ classes: 4, goal: 30 });
    expect(steps[3]).toMatchObject({ goal: 30 });
  });
  it('starts in Fundamentos without a belt', () => {
    const steps = graduationSteps(BELTS, report({ belts: [] }), 'bjj');
    expect(steps[0]).toMatchObject({ key: 'start', state: 'current', classes: 30, goal: 10 });
    expect(steps.slice(1).every((s) => s.state === 'future')).toBe(true);
  });
  it('has no goal on the last belt', () => {
    const steps = graduationSteps(BELTS, report({ belts: [{ modalityId: 'bjj', beltId: 'purple', awardedAt: '2026-10-01T12:00:00Z', nextAwardedAt: null, classes: 3 }] }), 'bjj');
    expect(steps.at(-1)).toMatchObject({ state: 'current', goal: null });
    // A belt never awarded below the current one: done without numbers.
    expect(steps[1]).toMatchObject({ state: 'done', classes: null });
  });
});

describe('labels', () => {
  it('averages per week', () => {
    expect(weeklyAverage(26, 91)).toBe(2);
    expect(weeklyAverage(0, 91)).toBe(0);
  });
  it('formats months', () => {
    expect(monthYearLabel('2026-03-01')).toBe('mar 2026');
    expect(monthYearLabel('2026-03-15T15:00:00Z')).toBe('mar 2026');
    expect(monthShortLabel('2026-12-01')).toBe('dez');
  });
  it('formats durations', () => {
    expect(durationLabel('2026-03-15T15:00:00Z', '2026-03-16T15:00:00Z')).toBe('1 dia');
    expect(durationLabel('2026-03-15T15:00:00Z', '2026-08-20T15:00:00Z')).toBe('5 meses');
    expect(durationLabel('2025-01-10T15:00:00Z', '2026-04-10T15:00:00Z')).toBe('1 ano e 3 meses');
  });
});

describe('toClassReport', () => {
  it('maps the RPC JSON', () => {
    const r = classesAdapter.toClassReport({
      joined_at: '2026-01-05T12:00:00Z',
      today: '2026-11-09',
      recent_since: '2026-08-09',
      enrollments: [{ modality_id: 'bjj', status: 'active', is_competitor: true }],
      modalities: [{ modality_id: 'bjj', total: 30, since_belt: 4, recent: 13 }],
      months: [{ month: '2026-03-01', modality_id: 'bjj', classes: 8 }],
      weeks: ['2026-11-02'],
      belts: [{ modality_id: 'bjj', belt_id: 'white', awarded_at: '2026-03-01T12:00:00Z', next_awarded_at: null, classes: 4 }],
      milestones: [{ modality_id: 'bjj', count: 10, date: '2026-03-20' }],
    });
    expect(r?.enrollments).toEqual([{ modalityId: 'bjj', status: 'active', isCompetitor: true }]);
    expect(r?.modalities[0]).toEqual({ modalityId: 'bjj', total: 30, sinceBelt: 4, recent: 13 });
    expect(r?.belts[0]?.nextAwardedAt).toBeNull();
    expect(r?.milestones[0]).toEqual({ modalityId: 'bjj', count: 10, date: '2026-03-20' });
  });
  it('is null without access', () => {
    expect(classesAdapter.toClassReport(null)).toBeNull();
  });
});
