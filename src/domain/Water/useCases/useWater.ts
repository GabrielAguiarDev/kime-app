import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { waterService } from '../waterService';

/** Today's total from the device (works offline). */
export function useWaterToday(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.WaterToday, userId],
    queryFn: () => waterService.todayTotal(userId!),
    enabled: !!userId,
    networkMode: 'always',
  });
}

export function useLogWater(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (amountMl: number) => waterService.log(userId!, amountMl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterToday, userId] });
      // Best effort: stays pending on the device and retries on the next trigger.
      waterService.sync(userId!).catch(() => undefined);
    },
  });
}
