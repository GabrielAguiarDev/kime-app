import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

/**
 * Sign-up flow. The screen keeps itself open with services/access
 * academySignup while the memberships refresh with the new owner membership.
 */
export function useCreateGymWithSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gymService.createWithSetup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}

export function useCreateGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, modalities }: { name: string; modalities: string[] }) =>
      gymService.create(name, modalities),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}
