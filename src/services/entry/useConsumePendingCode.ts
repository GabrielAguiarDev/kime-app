import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { gymService } from '@domain/Gym';
import { AppError, errorMessage, QueryKeys } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { pendingCode } from './entryStore';
import { joinOutcome, joinOutcomeText } from './joinOutcome';

const CONSUME_CODE_KEY = ['ConsumePendingCode'];

/**
 * After sign-in/sign-up, turns the code confirmed while signed out into a
 * join request. Already a member / already waiting → says so (nothing new is
 * created). The code is kept on network errors so the next launch retries.
 */
export function useConsumePendingCode() {
  const { userId } = useSession();
  const { active, selectGym } = useActiveGym();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationKey: CONSUME_CODE_KEY,
    mutationFn: async (code: string) => {
      const result = await gymService.joinWithCode(code);
      // Name for the message (best effort: the code was valid a moment ago).
      const lookup = await gymService.lookupCode(code).catch(() => null);
      return { result, gymName: lookup?.gymName ?? null };
    },
    onSuccess: async ({ result, gymName }) => {
      pendingCode.clear();
      const outcome = joinOutcome(result);
      if (outcome === 'alreadyMember') selectGym(result.gymId);
      // Without an approved academy the waiting screen shows a new request by itself.
      if (outcome !== 'sent' || active) {
        const text = joinOutcomeText(outcome, gymName);
        Alert.alert(text.title, text.message);
      }
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] });
    },
    onError: (e) => {
      if (!(e instanceof AppError && e.code === 'network')) pendingCode.clear();
      Alert.alert('Código', errorMessage(e));
    },
  });

  useEffect(() => {
    const code = pendingCode.get();
    if (userId && code && !isPending) mutate(code);
    // Run once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}

/** True while a saved code is being turned into a join request. */
export function useIsConsumingCode(): boolean {
  return useIsMutating({ mutationKey: CONSUME_CODE_KEY }) > 0;
}
