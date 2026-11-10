import { mergeWaterDays } from '../waterHistory';

describe('mergeWaterDays', () => {
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
