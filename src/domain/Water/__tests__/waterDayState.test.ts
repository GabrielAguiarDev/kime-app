import { waterDayState } from '../waterGoal';

describe('water day goal and limit', () => {
  it('accepts 90%-100% for a limit and warns above it', () => {
    expect(waterDayState(1799, 2000, true)).toBe('progress');
    expect(waterDayState(1800, 2000, true)).toBe('done');
    expect(waterDayState(2000, 2000, true)).toBe('done');
    expect(waterDayState(2001, 2000, true)).toBe('over');
  });
  it('retains normal goal behavior', () => {
    expect(waterDayState(1999, 2000)).toBe('progress');
    expect(waterDayState(2001, 2000)).toBe('done');
    expect(waterDayState(100, null, true)).toBe('unconfigured');
  });
});
