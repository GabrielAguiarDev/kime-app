import { useSyncExternalStore } from 'react';

import { keyValueStorage } from '@infra';

// Shared by every mounted screen (Início stays mounted under Água): dismissing
// the sheet on one hides it everywhere at once.
const listeners = new Set<() => void>();
let version = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

/**
 * "Meta do dia batida" shows once per day, wherever the goal is first seen
 * met: on the water screen right after a log, or on Início when the widget
 * got there while the app was closed.
 */
export function useWaterGoalFeedback(
  userId: string | undefined,
  day: string | undefined,
  totalMl: number | undefined,
  goalMl: number | null | undefined,
) {
  useSyncExternalStore(subscribe, getVersion);
  const reached = !!goalMl && totalMl !== undefined && totalMl >= goalMl;
  const seen = !!userId && !!day && keyValueStorage.getScoped('waterGoalCelebrated', userId) === day;

  const dismiss = () => {
    if (!userId || !day) return;
    keyValueStorage.setScoped('waterGoalCelebrated', userId, day);
    version += 1;
    listeners.forEach((listener) => listener());
  };

  return { visible: reached && !seen, dismiss };
}
