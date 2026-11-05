/**
 * Round timer ("timer de rounds"): pure engine. Time is always derived from the
 * clock (start instant + pauses), never from counting ticks, so it stays right
 * after the app was in the background, the screen locked or JS was throttled.
 *
 * Sequence: preparation → round 1 → rest → round 2 → … → last round → done.
 * Sounds: bell at the start of each round, triple bell at its end, clapper
 * `warningSeconds` before the end of a round (and of a rest: the next round is
 * coming).
 */

export interface TimerConfig {
  rounds: number;
  roundSeconds: number;
  /** 0 = rounds back to back. */
  restSeconds: number;
  /** Clapper this many seconds before the end of each round / rest; 0 = none. */
  warningSeconds: number;
}

export interface TimerPreset extends TimerConfig {
  /** Built-in presets have a fixed id (`builtin:*`); the academy's ones the row id. */
  id: string;
  name: string;
  builtIn: boolean;
  /** Academy preset of a modality (Início / presence "Timer" opens it). */
  modalityId?: string | null;
  /** Built-in only: the modality names it is made for. */
  forModalities?: string[];
}

/** "Prepare-se" before the first round. */
export const PREP_SECONDS = 10;

export const LIMITS = {
  rounds: { min: 1, max: 30 },
  roundSeconds: { min: 10, max: 60 * 60 },
  restSeconds: { min: 0, max: 30 * 60 },
  warningSeconds: { min: 0, max: 60 },
} as const;

/** Ready-made presets (typical amateur/competition formats). */
export const BUILT_IN_PRESETS: TimerPreset[] = [
  { id: 'builtin:boxe', name: 'Boxe', rounds: 3, roundSeconds: 180, restSeconds: 60, warningSeconds: 10, builtIn: true, forModalities: ['Boxe', 'Boxing'] },
  { id: 'builtin:muay-thai', name: 'Muay Thai', rounds: 5, roundSeconds: 180, restSeconds: 120, warningSeconds: 10, builtIn: true, forModalities: ['Muay Thai'] },
  { id: 'builtin:mma', name: 'MMA', rounds: 3, roundSeconds: 300, restSeconds: 60, warningSeconds: 10, builtIn: true, forModalities: ['MMA'] },
  {
    id: 'builtin:rola',
    name: 'Rola de jiu-jitsu',
    rounds: 6,
    roundSeconds: 300,
    restSeconds: 60,
    warningSeconds: 30,
    builtIn: true,
    forModalities: ['Jiu-Jitsu', 'Jiu Jitsu', 'Jiujitsu', 'BJJ', 'No-Gi', 'No Gi'],
  },
];

const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

/** Built-in presets made for a modality name ("Jiu-Jitsu" → the rola preset). */
export function builtInFor(modalityName: string): TimerPreset | undefined {
  const target = normalizeName(modalityName);
  return BUILT_IN_PRESETS.find((p) => p.forModalities?.some((m) => normalizeName(m) === target));
}

/**
 * The built-in presets to offer: only those of modalities the academy has.
 * An academy whose modalities match none (Judô, Karatê…) gets all of them.
 */
export function builtInsForAcademy(modalityNames: string[]): TimerPreset[] {
  const ids = new Set(modalityNames.map((n) => builtInFor(n)?.id).filter((id): id is string => !!id));
  const matching = BUILT_IN_PRESETS.filter((p) => ids.has(p.id));
  return matching.length > 0 ? matching : BUILT_IN_PRESETS;
}

export type TimerPhase = 'prep' | 'round' | 'rest' | 'done';

export interface Segment {
  phase: Exclude<TimerPhase, 'done'>;
  /** 1-based round this segment belongs to (rest = the round just finished). */
  round: number;
  startMs: number;
  endMs: number;
}

export function isValidConfig(c: TimerConfig): boolean {
  const ok = (v: number, l: { min: number; max: number }) => Number.isInteger(v) && v >= l.min && v <= l.max;
  return (
    ok(c.rounds, LIMITS.rounds) &&
    ok(c.roundSeconds, LIMITS.roundSeconds) &&
    ok(c.restSeconds, LIMITS.restSeconds) &&
    ok(c.warningSeconds, LIMITS.warningSeconds) &&
    c.warningSeconds < c.roundSeconds
  );
}

export function timeline(c: TimerConfig, prepSeconds = PREP_SECONDS): Segment[] {
  const out: Segment[] = [];
  let t = 0;
  if (prepSeconds > 0) {
    out.push({ phase: 'prep', round: 1, startMs: 0, endMs: prepSeconds * 1000 });
    t = prepSeconds * 1000;
  }
  for (let r = 1; r <= c.rounds; r++) {
    out.push({ phase: 'round', round: r, startMs: t, endMs: t + c.roundSeconds * 1000 });
    t += c.roundSeconds * 1000;
    if (r < c.rounds && c.restSeconds > 0) {
      out.push({ phase: 'rest', round: r, startMs: t, endMs: t + c.restSeconds * 1000 });
      t += c.restSeconds * 1000;
    }
  }
  return out;
}

export function totalMs(segments: Segment[]): number {
  return segments.length ? segments[segments.length - 1]!.endMs : 0;
}

export interface TimerState {
  phase: TimerPhase;
  round: number;
  rounds: number;
  /** Left in the current segment. */
  remainingMs: number;
  /** In the last `warningSeconds` of a round or rest. */
  warning: boolean;
  /** Index in the timeline; -1 when done. */
  segmentIndex: number;
}

export function stateAt(c: TimerConfig, segments: Segment[], elapsedMs: number): TimerState {
  const index = segments.findIndex((s) => elapsedMs < s.endMs);
  if (index < 0) return { phase: 'done', round: c.rounds, rounds: c.rounds, remainingMs: 0, warning: false, segmentIndex: -1 };
  const s = segments[index]!;
  const remainingMs = s.endMs - Math.max(elapsedMs, s.startMs);
  const warning = s.phase !== 'prep' && c.warningSeconds > 0 && remainingMs <= c.warningSeconds * 1000;
  return { phase: s.phase, round: s.round, rounds: c.rounds, remainingMs, warning, segmentIndex: index };
}

export type TimerSound = 'roundStart' | 'roundEnd' | 'warning';

export interface TimerEvent {
  atMs: number;
  sound: TimerSound;
}

/** Every sound of the session, in order. */
export function events(c: TimerConfig, segments: Segment[]): TimerEvent[] {
  const out: TimerEvent[] = [];
  for (const s of segments) {
    const length = s.endMs - s.startMs;
    if (s.phase === 'round') out.push({ atMs: s.startMs, sound: 'roundStart' });
    if (s.phase !== 'prep' && c.warningSeconds > 0 && c.warningSeconds * 1000 < length) {
      out.push({ atMs: s.endMs - c.warningSeconds * 1000, sound: 'warning' });
    }
    if (s.phase === 'round') out.push({ atMs: s.endMs, sound: 'roundEnd' });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** Sounds whose instant falls in (fromMs, toMs]: played on each tick. */
export function eventsBetween(all: TimerEvent[], fromMs: number, toMs: number): TimerEvent[] {
  return all.filter((e) => e.atMs > fromMs && e.atMs <= toMs);
}

/** Running clock: elapsed = (pausedAt ?? now) − startedAt − pausedTotal. */
export interface TimerClock {
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
}

export function startClock(now: number): TimerClock {
  return { startedAt: now, pausedAt: null, pausedTotalMs: 0 };
}

export function elapsed(clock: TimerClock, now: number): number {
  return (clock.pausedAt ?? now) - clock.startedAt - clock.pausedTotalMs;
}

export function pause(clock: TimerClock, now: number): TimerClock {
  return clock.pausedAt === null ? { ...clock, pausedAt: now } : clock;
}

export function resume(clock: TimerClock, now: number): TimerClock {
  return clock.pausedAt === null ? clock : { ...clock, pausedAt: null, pausedTotalMs: clock.pausedTotalMs + (now - clock.pausedAt) };
}

/** Jump to the start of segment `index` (skip / previous) keeping the clock running. */
export function seekTo(clock: TimerClock, segments: Segment[], index: number, now: number): TimerClock {
  const target = segments[Math.max(0, Math.min(index, segments.length - 1))]!.startMs;
  const current = elapsed(clock, now);
  return { ...clock, startedAt: clock.startedAt + (current - target) };
}

/** 185000 → "3:05"; 59000 → "0:59"; rounds up so 0:00 only shows at the end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "3 × 3:00 · descanso 1:00" */
export function describeConfig(c: TimerConfig): string {
  const rest = c.restSeconds > 0 ? ` · descanso ${formatClock(c.restSeconds * 1000)}` : ' · sem descanso';
  return `${c.rounds} × ${formatClock(c.roundSeconds * 1000)}${rest}`;
}

/** `M:SS` or `MM:SS` (or plain seconds) → seconds; null when invalid. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (/^\d{1,4}$/.test(t)) return Number(t);
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Plan for the native engine (modules/kimi-widget RoundTimerEngine / RoundTimerService): epoch ms. */
export interface NativeTimerPlan {
  title: string;
  rounds: number;
  paused: boolean;
  current: { phase: TimerPhase; round: number; remainingSeconds: number; warning: boolean };
  phases: { phase: Segment['phase']; round: number; startAtMs: number; endAtMs: number; warningAtMs: number | null }[];
  sounds: { atMs: number; sound: TimerSound }[];
}

/**
 * Everything still ahead of `elapsedMs`, as absolute instants from `now`: the
 * native side plays and shows it without JavaScript (background, locked screen).
 */
export function nativePlan(
  title: string,
  c: TimerConfig,
  segments: Segment[],
  allEvents: TimerEvent[],
  elapsedMs: number,
  now: number,
  paused: boolean,
): NativeTimerPlan {
  const state = stateAt(c, segments, elapsedMs);
  const abs = (ms: number) => Math.round(now + (ms - elapsedMs));
  return {
    title,
    rounds: c.rounds,
    paused,
    current: {
      phase: state.phase,
      round: state.round,
      remainingSeconds: Math.ceil(state.remainingMs / 1000),
      warning: state.warning,
    },
    phases: paused
      ? []
      : segments
          .filter((s) => s.endMs > elapsedMs)
          .map((s) => {
            const length = s.endMs - s.startMs;
            const warns = s.phase !== 'prep' && c.warningSeconds > 0 && c.warningSeconds * 1000 < length;
            return {
              phase: s.phase,
              round: s.round,
              startAtMs: abs(s.startMs),
              endAtMs: abs(s.endMs),
              warningAtMs: warns ? abs(s.endMs - c.warningSeconds * 1000) : null,
            };
          }),
    sounds: paused ? [] : allEvents.filter((e) => e.atMs >= elapsedMs).map((e) => ({ atMs: abs(e.atMs), sound: e.sound })),
  };
}
