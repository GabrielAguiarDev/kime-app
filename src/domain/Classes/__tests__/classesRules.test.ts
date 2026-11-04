import {
  addDays,
  beltProgress,
  classesOn,
  isClassMilestone,
  milestoneCrossed,
  trailNodes,
  weekStart,
  weekdayOf,
  weeklyStreak,
} from '../classesRules';
import type { BeltGoal, ClassSchedule } from '../classesTypes';

describe('dates', () => {
  it('works on plain local dates across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekdayOf('2026-11-04')).toBe(3); // Wednesday
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // Monday
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday belongs to the same week
  });
});

describe('weeklyStreak', () => {
  const today = '2026-11-04'; // Wednesday, week of 11-02
  it('counts consecutive weeks with a confirmed class', () => {
    expect(weeklyStreak(['2026-11-03', '2026-10-28', '2026-10-20'], today)).toBe(3);
  });
  it('does not break while the current week has no class yet', () => {
    expect(weeklyStreak(['2026-10-28', '2026-10-21'], today)).toBe(2);
  });
  it('breaks on a week without classes', () => {
    expect(weeklyStreak(['2026-11-02', '2026-10-21'], today)).toBe(1);
    expect(weeklyStreak(['2026-10-14'], today)).toBe(0);
  });
  it('counts several classes in the same week once', () => {
    expect(weeklyStreak(['2026-11-02', '2026-11-03', '2026-11-04'], today)).toBe(1);
  });
});

describe('milestones', () => {
  it('are 10, 25, 50, 100 and every 100 after', () => {
    expect([10, 25, 50, 100, 200, 300].every(isClassMilestone)).toBe(true);
    expect([1, 9, 11, 75, 150, 250].some(isClassMilestone)).toBe(false);
  });
  it('reports the highest milestone crossed', () => {
    expect(milestoneCrossed(9, 10)).toBe(10);
    expect(milestoneCrossed(8, 27)).toBe(25);
    expect(milestoneCrossed(10, 11)).toBeNull();
    expect(milestoneCrossed(10, 10)).toBeNull();
  });
});

describe('beltProgress', () => {
  const goals: BeltGoal[] = [
    { id: 'b', belt: 'blue', position: 1, classesRequired: 120 },
    { id: 'w', belt: 'white', position: 0, classesRequired: 1 },
    { id: 'p', belt: 'purple', position: 2, classesRequired: 150 },
  ];
  it('aims at the goal after the current belt', () => {
    expect(beltProgress(goals, 'blue', 40)).toEqual({ next: goals[2], done: 40, required: 150 });
  });
  it('aims at the first goal without a belt', () => {
    expect(beltProgress(goals, null, 0).next?.belt).toBe('white');
  });
  it('has no next goal at the last belt', () => {
    expect(beltProgress(goals, 'purple', 10).next).toBeNull();
  });
  it('caps progress at the requirement', () => {
    expect(beltProgress(goals, 'white', 130).done).toBe(120);
  });
});

describe('trailNodes', () => {
  it('splits the goal in blocks of 10 with states', () => {
    const nodes = trailNodes(30, 14);
    expect(nodes.map((n) => [n.from, n.to, n.state, n.doneInNode])).toEqual([
      [1, 10, 'done', 10],
      [11, 20, 'current', 4],
      [21, 30, 'future', 0],
    ]);
  });
  it('keeps a short last block and marks the next block current at a boundary', () => {
    expect(trailNodes(25, 20).map((n) => [n.from, n.to, n.state])).toEqual([
      [1, 10, 'done'],
      [11, 20, 'done'],
      [21, 25, 'current'],
    ]);
  });
});

describe('classesOn', () => {
  const s = (id: string, weekday: ClassSchedule['weekday'], startTime: string, active = true): ClassSchedule => ({
    id, academyId: 'a', weekday, startTime, modality: 'Jiu-Jitsu', active,
  });
  it('returns active classes of that weekday by time', () => {
    const list = [s('late', 3, '19:00'), s('early', 3, '07:00'), s('off', 3, '12:00', false), s('thu', 4, '07:00')];
    expect(classesOn(list, '2026-11-04').map((c) => c.id)).toEqual(['early', 'late']);
  });
});
