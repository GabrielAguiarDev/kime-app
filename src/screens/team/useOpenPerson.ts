import { router } from 'expo-router';
import { useCallback } from 'react';

import { useGymMembers } from '@domain/Membership';
import { useClassmates } from '@domain/Team';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/**
 * Tap on a person anywhere (lists of attendance, events, ranking, team…):
 * staff open the member detail, a student opens the colleague profile, and
 * the person themself opens their own Perfil. Returns undefined when there is
 * nothing to open (left the academy, not a classmate): the row stays plain.
 */
export function useOpenPerson(): (userId: string | null | undefined) => (() => void) | undefined {
  const { userId: me } = useSession();
  const { active, isStaff } = useActiveGym();
  const academyId = active?.gymId;
  const members = useGymMembers(isStaff ? academyId : undefined);
  const classmates = useClassmates(isStaff ? undefined : academyId);

  return useCallback(
    (userId) => {
      if (!userId) return undefined;
      if (userId === me) return () => router.navigate('/(tabs)/profile');
      if (isStaff) {
        const member = members.data?.find((m) => m.userId === userId && m.status === 'active');
        return member
          ? () => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })
          : undefined;
      }
      return classmates.data?.some((m) => m.userId === userId)
        ? () => router.push({ pathname: '/colega/[userId]', params: { userId } })
        : undefined;
    },
    [me, isStaff, members.data, classmates.data],
  );
}
