import { useQuery } from '@tanstack/react-query';

import { supabase, toAppError } from '@infra/supabase';

/** Server returns only the list fields and enforces modality, date and privacy. */
/** `enabled` false for past dates (the server only lists today and later). */
export function useClassAttendees(scheduleId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: ['classAttendees', scheduleId, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('class_attendees', { p_schedule_id: scheduleId, p_class_date: date });
      if (error) throw toAppError(error);
      return data;
    },
    enabled,
    refetchInterval: 30_000,
  });
}
