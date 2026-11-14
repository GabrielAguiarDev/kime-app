import { useSyncExternalStore } from 'react';

import { getTimerSession, subscribeTimer } from './timerSession';

export {
  alignTimerClock,
  pauseTimer,
  resumeTimer,
  skipTimer,
  startTimer,
  stopTimer,
  timerSoundsAvailable,
  type TimerSession,
} from './timerSession';
export { setTimerOrientation, useTimerOrientation, type TimerOrientation } from './timerOrientation';

/** The running round timer (null when none), re-rendered on every tick. */
export function useTimerSession() {
  return useSyncExternalStore(subscribeTimer, getTimerSession);
}

export { getTimerSession } from './timerSession';
