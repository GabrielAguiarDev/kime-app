import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { RankingPeriod } from './useRanking';

export type ModalityEnrollmentStatus = 'active' | 'suspended' | 'ended';

export function useModalityEnrollments(membershipId: string) {
  return useQuery({
    queryKey: [QueryKeys.ModalityEnrollments, membershipId],
    queryFn: async () => {
      const { data, error } = await supabase.from('student_modality_enrollments').select('*').eq('membership_id', membershipId);
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useSetModalityEnrollment(membershipId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ modalityId, status }: { modalityId: string; status: ModalityEnrollmentStatus }) => {
      const { error } = await supabase.rpc('set_student_modality_enrollment', {
        p_membership_id: membershipId, p_modality_id: modalityId, p_status: status,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: () => Promise.all([
      cache.invalidateQueries({ queryKey: [QueryKeys.ModalityEnrollments, membershipId] }),
      cache.invalidateQueries({ queryKey: [QueryKeys.RankingModalities] }),
      cache.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
    ]),
  });
}

/** The server restricts student options to their own eligible enrolments.
 * Staff can inspect each modality of their academy, never a global ranking.
 */
export function useRankingModalities(academyId: string, userId: string | undefined, period: RankingPeriod | undefined) {
  return useQuery({
    queryKey: [QueryKeys.RankingModalities, academyId, userId, period?.from, period?.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ranking_modalities', {
        p_academy_id: academyId, p_from: period!.from, p_to: period!.to,
      });
      if (error) throw toAppError(error);
      return data.map((r) => ({ id: r.modality_id, name: r.name }));
    },
    enabled: !!userId && !!period,
    refetchInterval: 60_000,
  });
}
