import {
  BUILT_IN_PRESETS,
  elapsed,
  events,
  eventsBetween,
  formatClock,
  isValidConfig,
  parseDuration,
  pause,
  resume,
  seekTo,
  startClock,
  stateAt,
  timeline,
  totalMs,
  type TimerConfig,
} from '../timerRules';

const boxe: TimerConfig = { rounds: 3, roundSeconds: 180, restSeconds: 60, warningSeconds: 10 };

describe('timeline and state', () => {
  const segs = timeline(boxe, 10);

  it('prep, rounds and rests between them (none after the last)', () => {
    expect(segs.map((s) => `${s.phase}${s.round}`)).toEqual(['prep1', 'round1', 'rest1', 'round2', 'rest2', 'round3']);
    expect(totalMs(segs)).toBe((10 + 180 * 3 + 60 * 2) * 1000);
  });

  it('state at an instant', () => {
    expect(stateAt(boxe, segs, 0)).toMatchObject({ phase: 'prep', remainingMs: 10_000, warning: false });
    expect(stateAt(boxe, segs, 10_000)).toMatchObject({ phase: 'round', round: 1, remainingMs: 180_000 });
    expect(stateAt(boxe, segs, 185_000)).toMatchObject({ phase: 'round', round: 1, remainingMs: 5_000, warning: true });
    expect(stateAt(boxe, segs, 190_000)).toMatchObject({ phase: 'rest', round: 1, remainingMs: 60_000 });
    expect(stateAt(boxe, segs, totalMs(segs))).toMatchObject({ phase: 'done', segmentIndex: -1 });
  });

  it('no rest: rounds back to back', () => {
    const s = timeline({ ...boxe, restSeconds: 0 }, 0);
    expect(s.map((x) => x.phase)).toEqual(['round', 'round', 'round']);
  });
});

describe('sounds', () => {
  const segs = timeline({ rounds: 2, roundSeconds: 60, restSeconds: 30, warningSeconds: 10 }, 5);
  const all = events({ rounds: 2, roundSeconds: 60, restSeconds: 30, warningSeconds: 10 }, segs);

  it('bell at each round start, clapper before the end of rounds and rests, triple bell at round end', () => {
    expect(all.map((e) => `${e.atMs / 1000}:${e.sound}`)).toEqual([
      '5:roundStart',
      '55:warning',
      '65:roundEnd',
      '85:warning',
      '95:roundStart',
      '145:warning',
      '155:roundEnd',
    ]);
  });

  it('a tick plays only what it crossed (a long gap plays every sound once)', () => {
    expect(eventsBetween(all, 4_900, 5_000).map((e) => e.sound)).toEqual(['roundStart']);
    expect(eventsBetween(all, 5_000, 5_250)).toEqual([]);
    expect(eventsBetween(all, 50_000, 100_000)).toHaveLength(4);
  });
});

describe('clock', () => {
  it('pauses and resumes from the clock', () => {
    let c = startClock(1_000);
    expect(elapsed(c, 6_000)).toBe(5_000);
    c = pause(c, 6_000);
    expect(elapsed(c, 60_000)).toBe(5_000);
    c = resume(c, 60_000);
    expect(elapsed(c, 61_000)).toBe(6_000);
  });

  it('skips to a segment', () => {
    const segs = timeline(boxe, 10);
    const c = seekTo(startClock(0), segs, 2, 3_000);
    expect(elapsed(c, 3_000)).toBe(segs[2]!.startMs);
  });
});

describe('formatting and validation', () => {
  it('formats and parses', () => {
    expect(formatClock(185_000)).toBe('3:05');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(0)).toBe('0:00');
    expect(parseDuration('3:00')).toBe(180);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('3:75')).toBeNull();
  });

  it('built-in presets are valid; the warning must be shorter than the round', () => {
    expect(BUILT_IN_PRESETS.every(isValidConfig)).toBe(true);
    expect(isValidConfig({ ...boxe, warningSeconds: 180 })).toBe(false);
  });
});
