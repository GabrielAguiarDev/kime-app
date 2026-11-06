import { Alert } from 'react-native';

import { useLogWater, useWaterDay, waterDayState } from '@domain/Water';
import { errorMessage } from '@infra';
import { useWaterSettings } from '@services/water';
import { haptics } from '@utils/haptics';

/**
 * One bottle at a tap (Início shortcut and water card): water haptic, success
 * haptic when it completes the day, `onLogged` with the new total.
 * `bottleMl` null = no bottle configured yet.
 */
export function useLogBottle(onLogged?: (totalMl: number, bottleMl: number) => void) {
  const { userId, settings, isLoading } = useWaterSettings();
  const day = useWaterDay(userId, settings?.timeZone);
  const logWater = useLogWater(userId);
  const bottleMl = settings?.bottleMl ?? null;
  const goalMl = settings?.goalMl ?? null;
  const isLimit = settings?.isLimit ?? false;
  const totalMl = day.data?.totalMl ?? 0;

  const log = () => {
    if (!bottleMl) return;
    // TODO(motion): water drop / ring filling on each log.
    haptics.water();
    logWater.mutate(bottleMl, {
      onSuccess: () => {
        const next = totalMl + bottleMl;
        if (waterDayState(totalMl, goalMl, isLimit) !== 'done' && waterDayState(next, goalMl, isLimit) === 'done') haptics.success();
        onLogged?.(next, bottleMl);
      },
      onError: (e) => Alert.alert('Água', errorMessage(e)),
    });
  };

  return { isLoading, bottleMl, goalMl, isLimit, totalMl, date: day.data?.date, log, isPending: logWater.isPending, timeZone: settings?.timeZone, userId };
}
