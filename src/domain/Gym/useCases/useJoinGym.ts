import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

export function useJoinGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => gymService.joinWithCode(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}
