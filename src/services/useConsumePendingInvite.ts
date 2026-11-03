import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { membershipService } from '@domain/Membership';
import { AppError, errorMessage, QueryKeys } from '@infra';

import { pendingInvite } from './pendingInvite';
import { useSession } from './session';

const CONSUME_INVITE_KEY = ['ConsumePendingInvite'];

/**
 * After sign-in/sign-up, turns an invite link opened while signed out into a
 * membership request (pending professor approval). The token is kept on
 * network errors so the next launch retries.
 */
export function useConsumePendingInvite() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationKey: CONSUME_INVITE_KEY,
    mutationFn: (token: string) => membershipService.requestWithInvite(token),
    onSuccess: () => {
      pendingInvite.clear();
      return queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] });
    },
    onError: (e) => {
      if (!(e instanceof AppError && e.code === 'network')) pendingInvite.clear();
      Alert.alert('Convite', errorMessage(e));
    },
  });

  useEffect(() => {
    const token = pendingInvite.get();
    if (userId && token && !isPending) mutate(token);
    // Run once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}

/** True while a saved invite is being turned into a membership request. */
export function useIsConsumingInvite(): boolean {
  return useIsMutating({ mutationKey: CONSUME_INVITE_KEY }) > 0;
}
