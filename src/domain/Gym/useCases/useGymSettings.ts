import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

export function useGymSettings(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.GymSettings, gymId],
    queryFn: () => gymService.getSettings(gymId!),
    enabled: !!gymId,
  });
}

export function useGymSettingsMutations(gymId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GymSettings, gymId] }),
      // Name shows in the memberships list (Home, Perfil).
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
      // The "sumido" threshold.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.InactiveStudents, gymId] }),
    ]);
  return {
    update: useMutation({
      mutationFn: (patch: { name?: string; inactiveAfterDays?: number }) => gymService.updateSettings(gymId, patch),
      onSuccess,
    }),
    changeLogo: useMutation({
      mutationFn: ({ uri, previousPath }: { uri: string; previousPath: string | null }) =>
        gymService.changeLogo(gymId, uri, previousPath),
      onSuccess,
    }),
  };
}
