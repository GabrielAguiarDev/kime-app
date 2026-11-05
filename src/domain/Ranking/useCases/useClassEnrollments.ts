import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

export function useClassEnrollments(membershipId: string) {
  return useQuery({
    queryKey: [QueryKeys.ClassEnrollments, membershipId],
    queryFn: async () => {
      const { data, error } = await supabase.from('student_class_enrollments').select('*').eq('membership_id', membershipId).is('ends_on', null);
      if (error) throw toAppError(error);
      return data;
    },
  });
}
export function useSetClassEnrollment(membershipId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, enrolled }: { scheduleId: string; enrolled: boolean }) => {
      const { error } = await supabase.rpc('set_student_class_enrollment', { p_membership_id: membershipId, p_schedule_id: scheduleId, p_enrolled: enrolled });
      if (error) throw toAppError(error);
    },
    onSuccess: () => Promise.all([
      cache.invalidateQueries({ queryKey: [QueryKeys.ClassEnrollments, membershipId] }),
      cache.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
    ]),
  });
}
