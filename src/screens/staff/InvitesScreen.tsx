import { router } from 'expo-router';

import { Screen } from '@components';
import { InviteCodesSection } from '@screens/professor/InviteCodes';
import { useActiveGym } from '@services/activeGym';

/** Owner: the student code and the single-use professor codes (Perfil → Convites, Equipe → Convidar). */
export function InvitesScreen() {
  const { active } = useActiveGym();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen nativeHeader title="Convites" onBack={back}>
      {active ? <InviteCodesSection gymId={active.gymId} gymName={active.gymName} /> : null}
    </Screen>
  );
}
