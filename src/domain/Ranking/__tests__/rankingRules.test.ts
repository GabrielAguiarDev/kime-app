import { addMonths, championsByMonth, monthLabel, monthStart, visibleRanking, type RankingEntry } from '../rankingRules';

const entry = (position: number, userId: string): RankingEntry => ({
  position,
  userId,
  fullName: userId,
  avatarPath: null,
  classes: 30 - position,
});

describe('ranking rules', () => {
  it('handles months', () => {
    expect(monthStart('2026-11-17')).toBe('2026-11-01');
    expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(monthLabel('2026-03-01')).toBe('Março de 2026');
  });

  it('shows the top and the viewer when further down', () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry(i + 1, `u${i + 1}`));
    expect(visibleRanking(entries, 'u25', 20).own?.userId).toBe('u25');
    expect(visibleRanking(entries, 'u3', 20).own).toBeNull();
    expect(visibleRanking(entries, 'nobody', 20).rows).toHaveLength(20);
  });

  it('groups champions by month, ties together', () => {
    const groups = championsByMonth([
      { month: '2026-09-01', userId: 'a', fullName: 'A', avatarPath: null, classes: 10 },
      { month: '2026-10-01', userId: 'b', fullName: 'B', avatarPath: null, classes: 12 },
      { month: '2026-10-01', userId: 'c', fullName: 'C', avatarPath: null, classes: 12 },
    ]);
    expect(groups.map((g) => [g.month, g.champions.map((c) => c.userId)])).toEqual([
      ['2026-10-01', ['b', 'c']],
      ['2026-09-01', ['a']],
    ]);
  });
});
