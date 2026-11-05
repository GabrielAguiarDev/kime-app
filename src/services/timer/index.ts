import { useSyncExternalStore } from 'react';

import { getTimerSession, subscribeTimer } from './timerSession';

export { pauseTimer, resumeTimer, skipTimer, startTimer, stopTimer, type TimerSession } from './timerSession';

/** The running round timer (null when none), re-rendered on every tick. */
export function useTimerSession() {
  return useSyncExternalStore(subscribeTimer, getTimerSession);
}
