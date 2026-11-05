import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';
import { isCodeComplete, normalizeCode } from '../gymRules';
import type { CodeType, InviteCodes } from '../gymTypes';

/** Academy card for a typed code (works signed out). Disabled until 8 chars. */
export function useCodeLookup(code: string | undefined) {
  const normalized = code ? normalizeCode(code) : '';
  return useQuery({
    queryKey: [QueryKeys.CodeLookup, normalized],
    queryFn: () => gymService.lookupCode(normalized),
    enabled: isCodeComplete(normalized),
    retry: false,
  });
}

export function useJoinWithCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => gymService.joinWithCode(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}

// ------------------------------------------------------------ staff ---

/** Active codes: owner both, instructors the student one (RLS). */
export function useInviteCodes(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InviteCodes, gymId],
    queryFn: () => gymService.listInviteCodes(gymId!),
    enabled: !!gymId,
  });
}

/** Same query, just the student code. */
export function useStudentCode(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InviteCodes, gymId],
    queryFn: () => gymService.listInviteCodes(gymId!),
    enabled: !!gymId,
    select: (codes: InviteCodes) => codes.student ?? null,
  });
}

/** Owner: "Gerar novo código" for one kind; the old code stops working. */
export function useRegenerateInviteCode(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codeType: CodeType) => gymService.regenerateInviteCode(gymId, codeType),
    onSuccess: (code, codeType) =>
      queryClient.setQueryData<InviteCodes>([QueryKeys.InviteCodes, gymId], (old) => ({ ...old, [codeType]: code })),
  });
}
