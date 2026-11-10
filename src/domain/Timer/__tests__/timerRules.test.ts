import {
  BUILT_IN_PRESETS,
  builtInFor,
  elapsed,
  events,
  eventsBetween,
  formatClock,
  nativePlan,
  orderPresets,
  presetForModality,
  presetSummary,
  isValidConfig,
  parseDuration,
  pause,
  resume,
  roundsDone,
  stepConfig,
  summaryLine,
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

describe('native plan', () => {
  const c: TimerConfig = { rounds: 2, roundSeconds: 60, restSeconds: 30, warningSeconds: 10 };
  const segs = timeline(c, 5);
  const evs = events(c, segs);

  it('only what is ahead, as absolute instants', () => {
    // 70 s in: inside the rest (65–95 s).
    const plan = nativePlan('Boxe', c, segs, evs, 70_000, 1_000_000, false);
    expect(plan.current).toEqual({ phase: 'rest', round: 1, remainingSeconds: 25, warning: false });
    expect(plan.phases.map((p) => [p.phase, p.startAtMs, p.endAtMs, p.warningAtMs])).toEqual([
      ['rest', 995_000, 1_025_000, 1_015_000],
      ['round', 1_025_000, 1_085_000, 1_075_000],
    ]);
    expect(plan.sounds.map((s) => [s.atMs, s.sound])).toEqual([
      [1_015_000, 'warning'],
      [1_025_000, 'roundStart'],
      [1_075_000, 'warning'],
      [1_085_000, 'roundEnd'],
    ]);
  });

  it('paused: nothing scheduled, the current state frozen', () => {
    const plan = nativePlan('Boxe', c, segs, evs, 10_000, 0, true);
    expect(plan).toMatchObject({ paused: true, phases: [], sounds: [], current: { phase: 'round', remainingSeconds: 55 } });
  });
});

describe('built-in presets per modality', () => {
  it('matches names ignoring case, accents and dashes', () => {
    expect(builtInFor('jiu jitsu')?.id).toBe('builtin:rola');
    expect(builtInFor('No-Gi')?.id).toBe('builtin:rola');
    expect(builtInFor('MUAY THAI')?.id).toBe('builtin:muay-thai');
    expect(builtInFor('Judô')).toBeUndefined();
  });
});

describe('user preset list', () => {
  const own = { id: 'u1', name: 'Muay thai', rounds: 4, roundSeconds: 120, restSeconds: 60, warningSeconds: 10, builtIn: false, personal: true };
  const list = [own, ...BUILT_IN_PRESETS];

  it('puts ordered ids first, the rest after in their place', () => {
    expect(orderPresets(list, ['builtin:mma', 'gone', 'u1']).map((p) => p.id)).toEqual([
      'builtin:mma',
      'u1',
      'builtin:boxe',
      'builtin:muay-thai',
      'builtin:rola',
    ]);
    expect(orderPresets(list, []).map((p) => p.id)).toEqual(list.map((p) => p.id));
  });

  it('finds the preset of a modality: made for it, else same name', () => {
    expect(presetForModality(list, 'Muay Thai')?.id).toBe('builtin:muay-thai');
    expect(presetForModality([own], 'Muay Thai')?.id).toBe('u1');
    expect(presetForModality(list, 'BJJ')?.id).toBe('builtin:rola');
    expect(presetForModality(list, 'Judô')).toBeUndefined();
  });

  it('summarizes a preset for the menu', () => {
    expect(presetSummary(BUILT_IN_PRESETS[1]!)).toBe('5 × 3:00 · descanso 2:00');
    expect(presetSummary({ rounds: 1, roundSeconds: 300, restSeconds: 0, warningSeconds: 0 })).toBe('1 × 5:00 · sem descanso');
  });
});

describe('stepper', () => {
  it('steps on the grid: rounds 1, round/rest 30 s, warning 5 s', () => {
    expect(stepConfig(boxe, 'rounds', 1)?.rounds).toBe(4);
    expect(stepConfig(boxe, 'roundSeconds', -1)?.roundSeconds).toBe(150);
    expect(stepConfig(boxe, 'restSeconds', 1)?.restSeconds).toBe(90);
    expect(stepConfig(boxe, 'warningSeconds', 1)?.warningSeconds).toBe(15);
  });

  it('snaps values off the grid', () => {
    const odd = { ...boxe, roundSeconds: 190 };
    expect(stepConfig(odd, 'roundSeconds', 1)?.roundSeconds).toBe(210);
    expect(stepConfig(odd, 'roundSeconds', -1)?.roundSeconds).toBe(180);
  });

  it('stops at the limits', () => {
    expect(stepConfig({ ...boxe, rounds: 1 }, 'rounds', -1)).toBeNull();
    expect(stepConfig({ ...boxe, rounds: 30 }, 'rounds', 1)).toBeNull();
    expect(stepConfig({ ...boxe, restSeconds: 0 }, 'restSeconds', -1)).toBeNull();
    expect(stepConfig({ ...boxe, warningSeconds: 0 }, 'warningSeconds', -1)).toBeNull();
    expect(stepConfig({ ...boxe, warningSeconds: 60 }, 'warningSeconds', 1)).toBeNull();
    expect(stepConfig({ ...boxe, roundSeconds: 30, warningSeconds: 0 }, 'roundSeconds', -1)).toBeNull();
  });

  it('a shorter round pulls the warning below it', () => {
    const c = stepConfig({ ...boxe, roundSeconds: 60, warningSeconds: 30 }, 'roundSeconds', -1);
    expect(c).toMatchObject({ roundSeconds: 30, warningSeconds: 25 });
  });
});

describe('summary and progress', () => {
  it('summary line', () => {
    expect(summaryLine({ rounds: 5, roundSeconds: 180, restSeconds: 120, warningSeconds: 10 })).toBe('5 rounds · descanso 2:00');
    expect(summaryLine({ rounds: 1, roundSeconds: 180, restSeconds: 0, warningSeconds: 0 })).toBe('1 round · sem descanso');
  });

  it('rounds done by phase', () => {
    const segs = timeline(boxe, 10);
    expect(roundsDone(stateAt(boxe, segs, 0))).toBe(0);
    expect(roundsDone(stateAt(boxe, segs, 11_000))).toBe(0);
    expect(roundsDone(stateAt(boxe, segs, (10 + 180 + 1) * 1000))).toBe(1);
    expect(roundsDone(stateAt(boxe, segs, totalMs(segs)))).toBe(3);
  });
});
