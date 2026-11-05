import { useQuery } from '@tanstack/react-query';

import { supabase, toAppError } from '@infra/supabase';

/** Server returns only the list fields and enforces modality, date and privacy. */
export function useClassAttendees(scheduleId: string, date: string) {
  return useQuery({
    queryKey: ['classAttendees', scheduleId, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('class_attendees', { p_schedule_id: scheduleId, p_class_date: date });
      if (error) throw toAppError(error);
      return data;
    },
    refetchInterval: 30_000,
  });
}
