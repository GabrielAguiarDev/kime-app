import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function usePendingRequests(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.PendingRequests, gymId],
    queryFn: () => membershipService.listPending(gymId!),
    enabled: !!gymId,
  });
}

/** Staff: "Alunos sumidos" (oldest first). */
export function useInactiveStudents(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InactiveStudents, gymId],
    queryFn: () => membershipService.listInactive(gymId!),
    enabled: !!gymId,
  });
}
