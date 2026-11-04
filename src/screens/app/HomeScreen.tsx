import { AcademyLogo, Box, Screen, Text } from '@components';
import { useMyProfile } from '@domain/Profile';
import { ProfessorHome } from '@screens/professor/ProfessorHome';
import { StudentHome } from '@screens/student/StudentHome';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

export function HomeScreen() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { data: profile } = useMyProfile(userId);
  const firstName = profile?.fullName.split(' ')[0];

  return (
    <Screen bottomInset={false}>
      <Box gap="s16" marginBottom="s24">
        {active ? (
          <Box flexDirection="row" alignItems="center" gap="s12">
            <AcademyLogo name={active.gymName} url={active.gymLogoUrl} size="small" />
            <Text variant="heading" flex={1} numberOfLines={2}>
              {active.gymName}
            </Text>
          </Box>
        ) : null}
        <Text variant="title">{firstName ? `Olá, ${firstName}` : 'Olá'}</Text>
      </Box>
      {isStaff ? <ProfessorHome /> : <StudentHome />}
    </Screen>
  );
}
