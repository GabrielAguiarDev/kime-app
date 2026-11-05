import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { AVATAR_URL_TTL_SECONDS, profileService } from '../profileService';
import type { BodyAndBottle, PersonalData } from '../profileTypes';

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyProfile, userId],
    queryFn: () => profileService.getById(userId!),
    enabled: !!userId,
  });
}

/** Perfil → Água: weight, height and bottle. */
export function useUpdateBodyAndBottle(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyAndBottle) => profileService.updateBodyAndBottle(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
  });
}

/** Perfil: edit the name. */
export function useUpdateName(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => profileService.updateName(userId!, fullName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
  });
}

/** Perfil: take/choose a photo or remove it. */
export function useAvatarMutations(userId: string | undefined) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] });
  return {
    change: useMutation({
      mutationFn: ({ uri, previousPath }: { uri: string; previousPath: string | null }) =>
        profileService.changeAvatar(userId!, uri, previousPath),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (path: string) => profileService.removeAvatar(userId!, path), onSuccess }),
  };
}

/**
 * Signed URL of a photo in the private bucket. Keyed by path (a new photo is
 * a new path); refreshed well before the URL expires.
 */
const avatarQueue = new Map<string, { resolve: (url: string) => void; reject: (error: unknown) => void }[]>();
let avatarFlush: ReturnType<typeof setTimeout> | null = null;
function batchedAvatarUrl(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    avatarQueue.set(path, [...(avatarQueue.get(path) ?? []), { resolve, reject }]);
    if (avatarFlush) return;
    avatarFlush = setTimeout(async () => {
      avatarFlush = null;
      const pending = new Map(avatarQueue);
      avatarQueue.clear();
      try {
        const urls = await profileService.avatarUrls([...pending.keys()]);
        for (const [key, listeners] of pending) {
          const url = urls.get(key);
          for (const listener of listeners) { if (url) listener.resolve(url); else listener.reject(new Error('Foto indisponível')); }
        }
      } catch (error) {
        for (const listeners of pending.values()) for (const listener of listeners) listener.reject(error);
      }
    }, 0);
  });
}

export function useAvatarUrl(path: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.AvatarUrl, path],
    queryFn: () => batchedAvatarUrl(path!),
    enabled: !!path && enabled,
    staleTime: (AVATAR_URL_TTL_SECONDS - 10 * 60) * 1000,
    gcTime: (AVATAR_URL_TTL_SECONDS - 5 * 60) * 1000,
  });
}

/** Meus dados: name, sex, birth date, weight and height. */
export function useUpdatePersonalData(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonalData) => profileService.updatePersonalData(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
  });
}

/** Perfil: "Aparecer no ranking". */
export function useSetShowInRanking(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (show: boolean) => profileService.setShowInRanking(userId!, show),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
      ]),
  });
}

export function useSetShowCheckinsToPeers(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (show: boolean) => profileService.setShowCheckinsToPeers(userId!, show),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
  });
}
