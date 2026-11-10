import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Weekday } from '@domain/Classes';
import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { InstructorBelt, InstructorProfile, InstructorProfileInput, InstructorSchedule } from '../instructorTypes';

interface BeltRow {
  modality_id: string;
  belt_id: string;
}
interface ScheduleRow {
  id: string;
  modality_id: string;
  weekday: number;
  start_time: string;
}

async function getProfile(academyId: string, userId: string): Promise<InstructorProfile | null> {
  const { data, error } = await supabase.rpc('get_instructor_profile', { p_academy_id: academyId, p_user_id: userId });
  if (error) throw toAppError(error);
  const r = data[0];
  if (!r) return null;
  return {
    membershipId: r.membership_id,
    userId: r.user_id,
    fullName: r.full_name,
    avatarPath: r.avatar_path,
    role: r.role,
    memberSince: r.member_since,
    bio: r.bio,
    modalityIds: r.modality_ids ?? [],
    belts: ((r.belts ?? []) as unknown as BeltRow[]).map((b): InstructorBelt => ({ modalityId: b.modality_id, beltId: b.belt_id })),
    schedules: ((r.schedules ?? []) as unknown as ScheduleRow[]).map(
      (s): InstructorSchedule => ({ id: s.id, modalityId: s.modality_id, weekday: s.weekday as Weekday, startTime: s.start_time }),
    ),
  };
}

/**
 * Owner / instructor profile, for any active member of the academy. Null
 * when the person is not active staff there (left, or a student).
 */
export function useInstructorProfile(academyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InstructorProfile, academyId, userId],
    queryFn: () => getProfile(academyId!, userId!),
    enabled: !!academyId && !!userId,
  });
}

/** The person's bio (the same in every academy). */
export function useUpdateInstructorProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InstructorProfileInput) => {
      const { error } = await supabase.from('instructor_profiles').upsert(
        {
          user_id: userId!,
          bio: input.bio,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorProfile] }),
  });
}

/** The staff member's belt in one modality (null clears it). The person or the owner. */
export function useSetInstructorBelt(academyId: string, membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ modalityId, beltId }: { modalityId: string; beltId: string | null }) => {
      // RPC: update, else insert (an upsert would need UPDATE on the key columns).
      const { error } = await supabase.rpc('set_instructor_belt', {
        p_membership_id: membershipId,
        p_modality_id: modalityId,
        p_belt_id: beltId,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorProfile, academyId] }),
  });
}

/** Owner: the modalities a staff member teaches (replaces the set). */
export function useSetInstructorModalities(academyId: string, membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (modalityIds: string[]) => {
      const { error } = await supabase.rpc('set_instructor_modalities', {
        p_membership_id: membershipId,
        p_modality_ids: modalityIds,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorProfile, academyId] }),
  });
}
