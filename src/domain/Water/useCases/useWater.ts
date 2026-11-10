import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { localDate } from '../waterRules';
import { waterService } from '../waterService';

/** Today's logs and total, from the device (offline, includes what the widget logged). */
export function useWaterDay(userId: string | undefined, timeZone: string | undefined) {
  // The date is part of the key: the first render after midnight reads the new day.
  const today = timeZone ? localDate(new Date(), timeZone) : undefined;
  return useQuery({
    queryKey: [QueryKeys.WaterToday, userId, timeZone, today],
    queryFn: () => waterService.day(userId!, timeZone!),
    enabled: !!userId && !!timeZone,
    networkMode: 'always',
  });
}

function useAfterLocalChange(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterToday, userId] });
    // Best effort: stays pending on the device and retries on the next trigger.
    if (userId) waterService.sync(userId).then(() => Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterDays, userId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Discipline, userId] }),
    ])).catch(() => undefined);
  };
}

export function useLogWater(userId: string | undefined) {
  const onSuccess = useAfterLocalChange(userId);
  return useMutation({
    networkMode: 'always',
    mutationFn: async (amountMl: number) => waterService.log(userId!, amountMl),
    onSuccess,
  });
}

export function useUndoWater(userId: string | undefined, timeZone: string | undefined) {
  const onSuccess = useAfterLocalChange(userId);
  return useMutation({
    networkMode: 'always',
    mutationFn: async () => waterService.undoLast(userId!, timeZone!),
    onSuccess,
  });
}
