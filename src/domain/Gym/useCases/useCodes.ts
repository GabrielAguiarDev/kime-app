import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';
import { isCodeComplete, normalizeCode } from '../gymRules';

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

// ------------------------------------------------------------ owner only ---

export function useStudentCode(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.StudentCode, gymId],
    queryFn: () => gymService.getStudentCode(gymId!),
    enabled: !!gymId,
  });
}

export function useRegenerateStudentCode(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gymService.regenerateStudentCode(gymId),
    onSuccess: (code) => queryClient.setQueryData([QueryKeys.StudentCode, gymId], code),
  });
}

export function useProfessorCodes(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ProfessorCodes, gymId],
    queryFn: () => gymService.listProfessorCodes(gymId!),
    enabled: !!gymId,
  });
}

export function useCreateProfessorCode(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gymService.createProfessorCode(gymId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.ProfessorCodes, gymId] }),
  });
}

export function useRevokeProfessorCode(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codeId: string) => gymService.revokeProfessorCode(codeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.ProfessorCodes, gymId] }),
  });
}
