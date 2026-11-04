import { router, useLocalSearchParams } from 'expo-router';

import { useGymMembers } from '@domain/Membership';
import { useActiveGym } from '@services/activeGym';

/** Staff screens of one athlete (`?membershipId=`): the member, or null while loading / when gone. */
export function useAthlete() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const { active } = useActiveGym();
  const members = useGymMembers(active?.gymId);
  const member = members.data?.find((m) => m.id === membershipId) ?? null;
  return {
    academyId: active?.gymId,
    member,
    isLoading: members.isLoading,
    /** Gone, or no longer on the team (staff no longer read their data). */
    notCompetitor: !members.isLoading && (!member || !member.isCompetitor),
    back: () => (router.canGoBack() ? router.back() : router.replace('/')),
  };
}
