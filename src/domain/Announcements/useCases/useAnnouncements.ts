import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { announcementsService as service } from '../announcementsService';
import type { AnnouncementInput } from '../announcementsTypes';

/** Notices the caller sees (staff: all, expired included; student: current ones of their audience). */
export function useAnnouncements(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Announcements, academyId],
    queryFn: () => service.list(academyId!),
    enabled: !!academyId,
  });
}

/** Staff: publish, edit (author) and delete (author or owner). */
export function useAnnouncementMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.Announcements, academyId] });
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id: string | null; input: AnnouncementInput }) => service.save(academyId, id, input),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => service.remove(id),
      onSuccess,
    }),
  };
}
