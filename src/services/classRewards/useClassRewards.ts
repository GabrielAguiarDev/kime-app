import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useMemberStats, useMyCheckins } from '@domain/Classes';
import { keyValueStorage } from '@infra';
import { haptics } from '@utils/haptics';

import { detectReward, lastConfirmedReviewAt, parseSnapshot } from './classRewardsRules';

/**
 * Rewards the student for progress made since the last visit to Início:
 * new belt or class milestone → achievement screen (11.4); confirmed
 * check-in → feedback sheet (count returned to the caller). Runs only while
 * Início is focused, once per change in progress.
 */
export function useClassRewards(academyId: string | undefined, userId: string | undefined) {
  const focused = useIsFocused();
  const stats = useMemberStats(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const own = stats.data?.find((s) => s.userId === userId);
  const list = checkins.data;
  const lastReviewedAt = list ? lastConfirmedReviewAt(list) : null;
  // Primitive key: detection runs only when progress actually changes.
  const progressKey = own && list ? `${own.confirmedTotal}|${own.beltAwardedAt}|${lastReviewedAt}` : null;
  const scope = academyId && userId ? `${userId}.${academyId}` : null;

  // Pure detection against the saved snapshot (read synchronously from kv-store).
  const detected = useMemo(() => {
    if (!focused || !progressKey || !own || !list || !scope) return null;
    const previous = parseSnapshot(keyValueStorage.getScoped('classRewards', scope));
    return detectReward(
      previous,
      { confirmedTotal: own.confirmedTotal, beltAwardedAt: own.beltAwardedAt, lastReviewedAt, belt: own.belt },
      list,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, progressKey, scope]);

  // Side effects: persist first (a reward never repeats), then reward.
  useEffect(() => {
    if (!detected || !scope) return;
    keyValueStorage.setScoped('classRewards', scope, JSON.stringify(detected.snapshot));
    const { reward } = detected;
    if (!reward) return;
    haptics.success();
    if (reward.kind !== 'checkinConfirmed') {
      router.push({
        pathname: '/achievement',
        params:
          reward.kind === 'belt' ? { kind: 'belt', belt: reward.belt } : { kind: 'milestone', value: String(reward.value) },
      });
    }
  }, [detected, scope]);

  const reward = detected?.reward;
  const confirmedCount =
    reward?.kind === 'checkinConfirmed' && dismissedKey !== progressKey ? reward.count : null;

  return { confirmedCount, dismissConfirmed: () => setDismissedKey(progressKey) };
}
