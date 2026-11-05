import { useSyncExternalStore } from 'react';

/**
 * Academy sign-up being finished (memory only): set right before the academy
 * is created and kept until "Ir para o app". While set, the guard keeps
 * /create-gym open even after the memberships refresh with the new owner
 * membership (e.g. the app returning from the Android share sheet), so the
 * "Sua academia está pronta" step is never skipped. Closing the app drops it.
 */
let finishing = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const academySignup = {
  start: () => {
    finishing = true;
    emit();
  },
  finish: () => {
    finishing = false;
    emit();
  },
  isFinishing: () => finishing,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAcademySignupFinishing(): boolean {
  return useSyncExternalStore(subscribe, academySignup.isFinishing);
}
