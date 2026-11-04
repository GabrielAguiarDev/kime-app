import { Box, Screen, Text } from '@components';
import { membershipLabel } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { ProfessorHome } from '@screens/professor/ProfessorHome';
import { StudentHome } from '@screens/student/StudentHome';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

export function HomeScreen() {
  const { userId } = useSession();
  const { active, role } = useActiveGym();
  const { data: profile } = useMyProfile(userId);
  const firstName = profile?.fullName.split(' ')[0];

  return (
    <Screen bottomInset={false}>
      <Box gap="s4" marginBottom="s24">
        <Text variant="captionCaps">{active ? `${active.gymName} · ${membershipLabel(active)}` : ''}</Text>
        <Text variant="title">{firstName ? `Olá, ${firstName}` : 'Olá'}</Text>
      </Box>
      {role === 'professor' ? <ProfessorHome /> : <StudentHome />}
    </Screen>
  );
}
