import { AppState, Platform } from 'react-native';

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

/**
 * The running round timer (one at a time), outside React so it survives
 * navigation. Time always comes from the clock (domain/Timer).
 *
 * Sounds, the Live Activity (iOS) and the fixed notification (Android) are the
 * NATIVE engine's job (modules/kimi-widget): every start / pause / resume /
 * skip sends it the plan of what is ahead, and it plays the bells on time with
 * the app in the background or the screen locked. JavaScript only draws the
 * screen (a 200 ms tick while it is open).
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
function syncNative() {
  if (!session) return;
  const now = Date.now();
  const plan = nativePlan(
    session.title,
    session.config,
    session.segments,
    session.events,
    elapsed(session.clock, now),
    now,
    session.clock.pausedAt !== null,
  );
  void roundTimerNative.sync(plan).catch(() => undefined);
}

function tick() {
  if (!session) return;
  const t = elapsed(session.clock, Date.now());
  session = { ...session, state: stateAt(session.config, session.segments, t) };
  if (session.state.phase === 'done') stopTicker();
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
  // Android 13+: the fixed notification needs the permission (the bells play without it).
  if (Platform.OS === 'android') await requestNotificationPermission().catch(() => false);
  const segments = timeline(config);
  session = {
    title,
    config,
    segments,
    events: events(config, segments),
    clock: startClock(Date.now()),
    state: stateAt(config, segments, 0),
  };
  // Back from the background: redraw at once (JS timers may have been paused).
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') tick();
  });
  syncNative();
  tick();
  startTicker();
}

export function pauseTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: pause(session.clock, Date.now()) };
  stopTicker();
  tick();
  syncNative();
}

export function resumeTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: resume(session.clock, Date.now()) };
  tick();
  syncNative();
  startTicker();
}

/** Jumps to the next (+1) or previous (-1) phase start. */
export function skipTimer(direction: 1 | -1) {
  if (!session) return;
  const now = Date.now();
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
  if (session.clock.pausedAt === null && session.state.phase !== 'done' && !ticker) startTicker();
}

export async function stopTimer(): Promise<void> {
  stopTicker();
  appStateSub?.remove();
  appStateSub = null;
  const hadSession = !!session;
  session = null;
  emit();
  if (hadSession) await roundTimerNative.stop().catch(() => undefined);
}
