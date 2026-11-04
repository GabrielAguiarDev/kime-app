import { useEffect } from 'react';
import { AppState } from 'react-native';

import { waterService } from '@domain/Water';

import { useSession } from './session';

/** Sends water logs saved offline: on sign-in and whenever the app returns to the foreground. */
export function useWaterSync() {
  const { userId } = useSession();

  useEffect(() => {
    if (!userId) return;
    const sync = () => void waterService.sync(userId).catch(() => undefined);
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [userId]);
}
