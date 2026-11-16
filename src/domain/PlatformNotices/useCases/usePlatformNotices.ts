import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { platformNoticesService as service } from '../platformNoticesService';

/**
 * Notices from the Kimi team for this account, newest first. Rare: a long
 * staleTime keeps them out of the 15 s polling and the refresh on navigation
 * (infra/query isLongLived). Keyed by account (the feed depends on its roles).
 */
export function usePlatformNotices(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.PlatformNotices, userId],
    queryFn: service.list,
    enabled: !!userId,
    staleTime: 10 * 60_000,
  });
}

/** "Entendi": dismisses (RPC), then reloads the feed. */
export function useDismissPlatformNotice(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => service.dismiss(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.PlatformNotices, userId] }),
  });
}
