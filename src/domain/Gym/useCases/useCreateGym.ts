import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

export function useCreateGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, modalities }: { name: string; modalities: string[] }) =>
      gymService.create(name, modalities),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}
