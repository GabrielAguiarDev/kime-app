import { AppState, Platform, type AppStateStatus } from 'react-native';

import {
  elapsed,
  events,
  eventsBetween,
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
import { playTimerSound, startTimerAudio, stopTimerAudio } from '@infra/audio';
import { cancelNotifications, scheduleTimerNotification } from '@infra/notifications';
import { roundTimerActivity } from '@infra/widget';

/**
 * The running round timer (one at a time), outside React so it survives
 * navigation. Time comes from the clock (domain/Timer); a tick only refreshes
 * the screen, plays the sounds it crossed and updates the Live Activity.
 *
 * Background / locked screen:
 *  - iOS: the audio session stays alive (silent loop + background audio), so
 *    ticks and bells go on; the Live Activity shows round and time left.
 *  - Android: JS may be paused, so the next bells are also scheduled as local
 *    notifications when the app leaves the foreground, and cancelled when it
 *    comes back.
 */

const TICK_MS = 200;
/** A tick after a long pause (app suspended) does not replay old sounds. */
const STALE_SOUND_MS = 1500;
/** Android fallback: how many upcoming bells become notifications. */
const MAX_FALLBACK = 40;

export interface TimerSession {
  title: string;
  config: TimerConfig;
  segments: Segment[];
  events: TimerEvent[];
  clock: TimerClock;
  state: TimerState;
}

let session: TimerSession | null = null;
let lastElapsed = 0;
let ticker: ReturnType<typeof setInterval> | null = null;
let activityKey = '';
let fallbackIds: string[] = [];
const listeners = new Set<() => void>();
let appStateSub: { remove: () => void } | null = null;

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

function syncActivity(now: number) {
  if (!session) return;
  const s = session.state;
  const seg = s.segmentIndex >= 0 ? session.segments[s.segmentIndex] : undefined;
  const paused = session.clock.pausedAt !== null;
  // Only on changes: the system counts the seconds down by itself.
  const key = `${s.segmentIndex}|${s.warning}|${paused}|${paused ? 0 : session.clock.startedAt + session.clock.pausedTotalMs}`;
  if (key === activityKey) return;
  activityKey = key;
  const endsAtMs = seg ? now + (seg.endMs - elapsed(session.clock, now)) : now;
  roundTimerActivity.update({
    title: session.title,
    phase: s.phase,
    round: s.round,
    rounds: s.rounds,
    endsAtMs,
    paused,
    remainingSeconds: Math.ceil(s.remainingMs / 1000),
    warning: s.warning,
  });
}

function tick() {
  if (!session) return;
  const now = Date.now();
  const t = elapsed(session.clock, now);
  const crossed = eventsBetween(session.events, lastElapsed, t).filter((e) => t - e.atMs < STALE_SOUND_MS);
  lastElapsed = Math.max(lastElapsed, t);
  // Several at once (e.g. round end + next start without rest): the last one wins.
  const sound = crossed[crossed.length - 1];
  if (sound) void playTimerSound(sound.sound).catch(() => undefined);
  session = { ...session, state: stateAt(session.config, session.segments, t) };
  syncActivity(now);
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

async function scheduleFallback() {
  if (Platform.OS !== 'android' || !session || session.clock.pausedAt !== null) return;
  const now = Date.now();
  const t = elapsed(session.clock, now);
  const upcoming = session.events.filter((e) => e.atMs > t && e.sound !== 'warning').slice(0, MAX_FALLBACK);
  const ids: string[] = [];
  for (const e of upcoming) {
    const st = stateAt(session.config, session.segments, e.atMs);
    const id = await scheduleTimerNotification({
      at: new Date(now + (e.atMs - t)),
      title: e.sound === 'roundStart' ? `Round ${st.round} começou` : `Fim do round ${stateAt(session.config, session.segments, e.atMs - 1).round}`,
      body: session.title,
      data: { kind: 'round-timer' },
    }).catch(() => null);
    if (id) ids.push(id);
  }
  fallbackIds = ids;
}

async function clearFallback() {
  const ids = fallbackIds;
  fallbackIds = [];
  if (ids.length) await cancelNotifications(ids).catch(() => undefined);
}

function onAppState(next: AppStateStatus) {
  if (!session) return;
  if (next === 'active') {
    void clearFallback();
    tick();
  } else if (next === 'background') {
    void scheduleFallback();
  }
}

export async function startTimer(title: string, config: TimerConfig): Promise<void> {
  await stopTimer();
  const segments = timeline(config);
  const now = Date.now();
  const clock = startClock(now);
  session = { title, config, segments, events: events(config, segments), clock, state: stateAt(config, segments, 0) };
  lastElapsed = -1;
  activityKey = '';
  appStateSub = AppState.addEventListener('change', onAppState);
  await startTimerAudio().catch(() => undefined);
  tick();
  startTicker();
}

export function pauseTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: pause(session.clock, Date.now()) };
  stopTicker();
  tick();
}

export function resumeTimer() {
  if (!session || session.state.phase === 'done') return;
  session = { ...session, clock: resume(session.clock, Date.now()) };
  lastElapsed = elapsed(session.clock, Date.now());
  tick();
  startTicker();
}

/** Jumps to the next (+1) or previous (-1) phase start, without sounds for what was skipped. */
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
  lastElapsed = elapsed(session.clock, now);
  if (session.clock.pausedAt === null && !ticker) startTicker();
  tick();
}

export async function stopTimer(): Promise<void> {
  stopTicker();
  appStateSub?.remove();
  appStateSub = null;
  await clearFallback();
  if (session) roundTimerActivity.end();
  session = null;
  activityKey = '';
  emit();
  await stopTimerAudio().catch(() => undefined);
}
