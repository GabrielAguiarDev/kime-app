import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InvitePreview, token],
    queryFn: () => gymService.invitePreview(token!),
    enabled: !!token,
  });
}
