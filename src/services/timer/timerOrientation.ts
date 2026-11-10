import { useSyncExternalStore } from 'react';

import { keyValueStorage, StorageKeys } from '@infra/storage';

/** How the running timer is shown (the rest of the app stays portrait). */
export type TimerOrientation = 'portrait' | 'landscape';

const listeners = new Set<() => void>();

function read(): TimerOrientation {
  try {
    return keyValueStorage.get(StorageKeys.timerOrientation) === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

let current: TimerOrientation | null = null;

function get(): TimerOrientation {
  current ??= read();
  return current;
}

export function setTimerOrientation(value: TimerOrientation) {
  current = value;
  try {
    keyValueStorage.set(StorageKeys.timerOrientation, value);
  } catch {
    // Still applied for this run of the app.
  }
  listeners.forEach((l) => l());
}

/** The device's choice ("Tela do timer" in Ajustar, rotate button on the running timer). */
export function useTimerOrientation(): TimerOrientation {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
  );
}
