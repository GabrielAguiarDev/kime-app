import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

export function useCreateGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => gymService.create(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}
