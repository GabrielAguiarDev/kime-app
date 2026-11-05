import {
  addDays,
  beltColorNeedsOutline,
  beltName,
  beltNeedsDarkText,
  sameBeltLook,
  isBeltColorKey,
  beltProgress,
  beltsOf,
  checkinStreak,
  classesOn,
  isClassMilestone,
  latestBelt,
  milestoneCrossed,
  trainedModalities,
  trailNodes,
  weekStart,
  weekdayOf,
  weeklyStreak,
} from '../classesRules';
import type { BeltColorKey, ClassSchedule, Modality, ModalityBelt, ModalityStats } from '../classesTypes';

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

  describe('week turn (Sunday → Monday)', () => {
    // Weeks of 10-26, 11-02 and 11-09. Sunday 11-08 closes the week of 11-02.
    const history = ['2026-11-01', '2026-11-08']; // Sundays: weeks of 10-26 and 11-02
    it('Sunday and the next Monday are different weeks', () => {
      expect(weeklyStreak(['2026-11-08', '2026-11-09'], '2026-11-09')).toBe(2);
    });
    it('on Sunday the current week still counts', () => {
      expect(weeklyStreak(history, '2026-11-08')).toBe(2);
    });
    it('on Monday the streak survives while the new week has no class yet', () => {
      expect(weeklyStreak(history, '2026-11-09')).toBe(2);
    });
    it('a whole week without a confirmed class zeroes the streak at the next Monday', () => {
      // Last class on Sunday 11-08; the week of 11-09 passes empty.
      expect(weeklyStreak(history, '2026-11-15')).toBe(2); // Sunday: week of 11-09 not over yet
      expect(weeklyStreak(history, '2026-11-16')).toBe(0); // Monday: week of 11-09 had nothing
    });
  });

  describe('only confirmed check-ins count', () => {
    it('a week with only pending or rejected check-ins breaks the streak', () => {
      const checkins = [
        { classDate: '2026-11-03', status: 'confirmed' as const },
        { classDate: '2026-10-28', status: 'pending' as const },
        { classDate: '2026-10-27', status: 'rejected' as const },
        { classDate: '2026-10-21', status: 'confirmed' as const },
      ];
      expect(checkinStreak(checkins, today)).toBe(1);
    });
    it('no confirmed check-in means no streak', () => {
      expect(checkinStreak([{ classDate: '2026-11-03', status: 'pending' }], today)).toBe(0);
    });
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

const belt = (
  id: string,
  modalityId: string,
  position: number,
  classesRequired: number | null,
  primary: BeltColorKey = 'blue',
): ModalityBelt => ({ id, modalityId, primary, tip: null, position, classesRequired });

describe('beltProgress', () => {
  const goals: ModalityBelt[] = [
    belt('b', 'bjj', 1, 120),
    belt('w', 'bjj', 0, 10, 'white'),
    belt('p', 'bjj', 2, 150, 'purple'),
  ];
  it('aims at the belt after the current one', () => {
    expect(beltProgress(goals, 'b', 40)).toEqual({ next: goals[2], done: 40, required: 150 });
  });
  it('aims at the first belt when the student has none', () => {
    expect(beltProgress(goals, null, 4)).toEqual({ next: goals[1], done: 4, required: 10 });
  });
  it('has no next belt at the last one', () => {
    expect(beltProgress(goals, 'p', 10)).toEqual({ next: null, done: 0, required: 0 });
  });
  it('caps progress at the requirement', () => {
    expect(beltProgress(goals, 'w', 130).done).toBe(120);
  });
  it('a next belt without a number of classes (old data) has required 0', () => {
    const odd = [belt('w', 'bjj', 0, null, 'white'), belt('x', 'bjj', 1, 40)];
    expect(beltProgress(odd, null, 5)).toEqual({ next: odd[0], done: 0, required: 0 });
  });
  it('treats an unknown current belt as none and handles an empty list', () => {
    expect(beltProgress(goals, 'ghost', 0).next?.id).toBe('w');
    expect(beltProgress([], null, 5)).toEqual({ next: null, done: 0, required: 0 });
  });
  it('does not mutate the input order', () => {
    const copy = [...goals];
    beltProgress(goals, null, 0);
    expect(goals).toEqual(copy);
  });
});

describe('beltsOf', () => {
  it('filters one modality and orders by position', () => {
    const all = [belt('x2', 'mt', 2, 5), belt('b1', 'bjj', 1, 5), belt('x1', 'mt', 1, 5)];
    expect(beltsOf(all, 'mt').map((b) => b.id)).toEqual(['x1', 'x2']);
    expect(beltsOf(all, 'none')).toEqual([]);
  });
});

describe('trainedModalities', () => {
  const mods: Modality[] = [
    { id: 'bjj', name: 'Jiu-Jitsu', position: 0, usesBelts: true, weeklyClassGoal: 2 },
    { id: 'mt', name: 'Muay Thai', position: 1, usesBelts: false, weeklyClassGoal: 2 },
  ];
  const stat = (modalityId: string, over: Partial<ModalityStats> = {}): ModalityStats => ({
    membershipId: 'm', userId: 'u', modalityId, beltId: null, beltAwardedAt: null,
    confirmedTotal: 0, confirmedSinceBelt: 0, ...over,
  });
  it('falls back to every modality when none was trained', () => {
    expect(trainedModalities(mods, [])).toEqual(mods);
    expect(trainedModalities(mods, [stat('bjj'), stat('mt')])).toEqual(mods);
  });
  it('keeps only modalities with confirmed classes', () => {
    expect(trainedModalities(mods, [stat('mt', { confirmedTotal: 3 })]).map((m) => m.id)).toEqual(['mt']);
  });
  it('counts a belt alone as trained', () => {
    expect(trainedModalities(mods, [stat('bjj', { beltId: 'b' })]).map((m) => m.id)).toEqual(['bjj']);
  });
  it('ignores stats of unknown modalities', () => {
    expect(trainedModalities(mods, [stat('ghost', { confirmedTotal: 9 })])).toEqual(mods);
  });
});

describe('latestBelt', () => {
  const belts = [belt('b1', 'bjj', 1, 5), belt('b2', 'mt', 1, 5)];
  const stat = (modalityId: string, beltId: string | null, beltAwardedAt: string | null): ModalityStats => ({
    membershipId: 'm', userId: 'u', modalityId, beltId, beltAwardedAt, confirmedTotal: 0, confirmedSinceBelt: 0,
  });
  it('picks the most recently awarded belt across modalities', () => {
    const stats = [stat('bjj', 'b1', '2026-01-01T00:00:00Z'), stat('mt', 'b2', '2026-06-01T00:00:00Z')];
    expect(latestBelt(stats, belts)?.id).toBe('b2');
  });
  it('is null without belts, without dates or when the belt is unknown', () => {
    expect(latestBelt([], belts)).toBeNull();
    expect(latestBelt([stat('bjj', null, null)], belts)).toBeNull();
    expect(latestBelt([stat('bjj', 'b1', null)], belts)).toBeNull();
    expect(latestBelt([stat('bjj', 'ghost', '2026-01-01T00:00:00Z')], belts)).toBeNull();
  });
});

describe('belt colors', () => {
  it('derives the feminine name, with the tip', () => {
    expect(beltName({ primary: 'red', tip: null })).toBe('Vermelha');
    expect(beltName({ primary: 'red', tip: 'black' })).toBe('Vermelha/ponta preta');
    expect(beltName({ primary: 'white', tip: 'yellow' })).toBe('Branca/ponta amarela');
  });
  it('compares combinations', () => {
    expect(sameBeltLook({ primary: 'red', tip: null }, { primary: 'red', tip: null })).toBe(true);
    expect(sameBeltLook({ primary: 'red', tip: 'black' }, { primary: 'red', tip: null })).toBe(false);
  });
  it('knows the palette keys', () => {
    expect(isBeltColorKey('red')).toBe(true);
    expect(isBeltColorKey('coral')).toBe(false);
    expect(isBeltColorKey(null)).toBe(false);
  });
  it('outlines white and black, dark text on light belts', () => {
    expect(beltColorNeedsOutline('white')).toBe(true);
    expect(beltColorNeedsOutline('black')).toBe(true);
    expect(beltColorNeedsOutline('blue')).toBe(false);
    expect(beltNeedsDarkText({ primary: 'yellow', tip: null })).toBe(true);
    expect(beltNeedsDarkText({ primary: 'blue', tip: 'black' })).toBe(false);
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
    id, academyId: 'a', weekday, startTime, modalityId: 'bjj', modality: 'Jiu-Jitsu', active,
  });
  it('returns active classes of that weekday by time', () => {
    const list = [s('late', 3, '19:00'), s('early', 3, '07:00'), s('off', 3, '12:00', false), s('thu', 4, '07:00')];
    expect(classesOn(list, '2026-11-04').map((c) => c.id)).toEqual(['early', 'late']);
  });
});
