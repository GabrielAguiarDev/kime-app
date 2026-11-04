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
      // Name shows in the memberships list (Home, Perfil); timezone defines "today".
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.AcademyToday, gymId] }),
    ]);
  return {
    update: useMutation({
      mutationFn: (patch: { name?: string; timezone?: string }) => gymService.updateSettings(gymId, patch),
      onSuccess,
    }),
    changeLogo: useMutation({
      mutationFn: ({ uri, previousPath }: { uri: string; previousPath: string | null }) =>
        gymService.changeLogo(gymId, uri, previousPath),
      onSuccess,
    }),
    removeLogo: useMutation({ mutationFn: (path: string) => gymService.removeLogo(gymId, path), onSuccess }),
  };
}

/** Name + logo for a typed invite code (before joining). */
export function useCodePreview(code: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.CodePreview, code],
    queryFn: () => gymService.previewByCode(code!),
    enabled: !!code,
    retry: false,
  });
}
