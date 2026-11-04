import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { gymService } from '@domain/Gym';
import { AppError, errorMessage, QueryKeys } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { pendingCode } from './entryStore';

const CONSUME_CODE_KEY = ['ConsumePendingCode'];

/**
 * After sign-in/sign-up, turns the code confirmed while signed out into a
 * join request. Already a member of that academy → straight into it. The code
 * is kept on network errors so the next launch retries.
 */
export function useConsumePendingCode() {
  const { userId } = useSession();
  const { active, selectGym } = useActiveGym();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationKey: CONSUME_CODE_KEY,
    mutationFn: (code: string) => gymService.joinWithCode(code),
    onSuccess: async (result) => {
      pendingCode.clear();
      if (result.status === 'active') selectGym(result.gymId);
      // Already in another academy: the app opens on it, so say where the request went.
      else if (active) Alert.alert('Pedido enviado', 'Quando a academia aprovar, ela aparece no seu Perfil.');
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
