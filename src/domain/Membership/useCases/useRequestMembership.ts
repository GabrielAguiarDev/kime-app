import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function useRequestMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => membershipService.requestWithInvite(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}
