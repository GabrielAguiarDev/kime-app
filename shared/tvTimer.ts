import { elapsed, stateAt, timeline, type TimerClock, type TimerConfig } from './timer';

export type TvTimerStatus = 'idle' | 'running' | 'paused' | 'finished';
export interface TvTimerSnapshot {
  status: TvTimerStatus;
  title: string;
  config: TimerConfig;
  clock: TimerClock;
}

/** The exact same timeline used by the app, evaluated against a server-aligned epoch. */
export function tvTimerAt(snapshot: TvTimerSnapshot, now: number) {
  const segments = timeline(snapshot.config);
  const state = stateAt(snapshot.config, segments, elapsed(snapshot.clock, now));
  return { segments, state, finished: snapshot.status === 'finished' || state.phase === 'done' };
}
