import { AppState } from 'react-native';

import {
  elapsed,
  events,
  nativePlan,
  pause,
  resume,
  seekTo,
  startClock,
  stateAt,
  timeline,
  type Segment,
  type TimerClock,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from '@domain/Timer';
import { requestNotificationPermission } from '@infra/notifications';
import { roundTimerNative } from '@infra/widget';
import { publishTvTimer, timerNow } from '@services/tv';

/**
 * The running round timer (one at a time), outside React so it survives
 * navigation. Time always comes from the clock (domain/Timer).
 *
 * Sounds, the Live Activity (iOS) and the fixed notification (Android) are the
 * NATIVE engine's job (modules/kimi-widget): every start / pause / resume /
 * skip sends it the plan of what is ahead, and it plays the bells on time with
 * the app in the background or the screen locked. JavaScript only draws the
 * screen (a 200 ms tick while it is open).
 *
 * The Live Activity (iOS) and notification (Android) buttons come back here as
 * commands: this session stays the single owner of the clock and re-syncs.
 */

const TICK_MS = 200;

export interface TimerSession {
  title: string;
  config: TimerConfig;
  segments: Segment[];
  events: TimerEvent[];
  clock: TimerClock;
  state: TimerState;
}

let session: TimerSession | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let commandSub: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

/** Sounds and background need the native engine (a new build). */
export const timerSoundsAvailable = roundTimerNative.available;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeTimer(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTimerSession(): TimerSession | null {
  return session;
}

/** Hands the native engine everything still ahead (replaces the previous plan). */
function broadcast() {
  if (!session) { publishTvTimer(null); return; }
  publishTvTimer({ status: session.state.phase === 'done' ? 'finished' : session.clock.pausedAt !== null ? 'paused' : 'running',
    title: session.title, config: session.config, clock: session.clock });
}

/** Move an existing local clock onto the server epoch when a TV connects. */
export function alignTimerClock(deltaMs: number) {
  if (!session) return;
  session = { ...session, clock: { ...session.clock, startedAt: session.clock.startedAt + deltaMs,
    pausedAt: session.clock.pausedAt === null ? null : session.clock.pausedAt + deltaMs } };
  tick(); syncNative(); broadcast();
}

function syncNative() {
  if (!session) return;
  const now = timerNow();
  const plan = nativePlan(
    session.title,
    session.config,
    session.segments,
    session.events,
    elapsed(session.clock, now),
    Date.now(),
    session.clock.pausedAt !== null,
  );
  void roundTimerNative.sync(plan).catch(() => undefined);
}

function tick() {
  if (!session) return;
  const t = elapsed(session.clock, timerNow());
  session = { ...session, state: stateAt(session.config, session.segments, t) };
  if (session.state.phase === 'done') { stopTicker(); broadcast(); }
  emit();
}

function startTicker() {
  stopTicker();
  ticker = setInterval(tick, TICK_MS);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

export async function startTimer(title: string, config: TimerConfig): Promise<void> {
  await stopTimer();
  // Android 13+: the fixed notification needs it. iOS: the bell notifications that go off if the
  // system closes the app mid-session. The bells play in the app without it.
  await requestNotificationPermission().catch(() => false);
  const segments = timeline(config);
  session = {
    title,
    config,
    segments,
    events: events(config, segments),
    clock: startClock(timerNow()),
    state: stateAt(config, segments, 0),
  };
  // Back from the background: redraw at once (JS timers may have been paused).
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') tick();
  });
  commandSub = roundTimerNative.onCommand((command) => {
    if (command === 'pause') pauseTimer();
    else if (command === 'resume') resumeTimer();
    else skipTimer(1);
  });
  syncNative();
  tick();
  broadcast();
  startTicker();
}

export function pauseTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: pause(session.clock, timerNow()) };
  stopTicker();
  tick();
  syncNative();
  broadcast();
}

export function resumeTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: resume(session.clock, timerNow()) };
  tick();
  syncNative();
  broadcast();
  startTicker();
}

/** Jumps to the next (+1) or previous (-1) phase start. */
export function skipTimer(direction: 1 | -1) {
  if (!session) return;
  const now = timerNow();
  const index = session.state.segmentIndex < 0 ? session.segments.length - 1 : session.state.segmentIndex;
  const target = index + direction;
  if (target < 0) return;
  if (target >= session.segments.length) {
    // Past the last phase: finish.
    const end = session.segments[session.segments.length - 1]!.endMs;
    session = { ...session, clock: { ...session.clock, startedAt: session.clock.startedAt + (elapsed(session.clock, now) - end) } };
  } else {
    session = { ...session, clock: seekTo(session.clock, session.segments, target, now) };
  }
  tick();
  syncNative();
  broadcast();
  if (session.clock.pausedAt === null && session.state.phase !== 'done' && !ticker) startTicker();
}

export async function stopTimer(): Promise<void> {
  stopTicker();
  appStateSub?.remove();
  appStateSub = null;
  commandSub?.remove();
  commandSub = null;
  const hadSession = !!session;
  session = null;
  broadcast();
  emit();
  if (hadSession) await roundTimerNative.stop().catch(() => undefined);
}
