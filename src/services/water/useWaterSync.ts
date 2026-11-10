import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { waterService } from '@domain/Water';
import { QueryKeys } from '@infra/query';
import { useSession } from '@services/session';

/**
 * On sign-in and whenever the app returns to the foreground: shows what the
 * widget logged meanwhile (shared storage), then sends it to Supabase.
 */
export function useWaterSync() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterToday, userId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
        // The last days bars and the Disciplina read the server totals.
        queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterDays, userId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.Discipline, userId] }),
      ]);
    const sync = () => {
      void refresh();
      waterService
        .sync(userId)
        .then(refresh)
        .catch(() => undefined);
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [userId, queryClient]);
}
