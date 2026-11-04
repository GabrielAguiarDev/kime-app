import { AcademyLogo, Box, FeedbackSheet, Screen, Text } from '@components';
import { useMyProfile } from '@domain/Profile';
import { useWaterDay } from '@domain/Water';
import { ProfessorHome } from '@screens/professor/ProfessorHome';
import { StudentHome } from '@screens/student/StudentHome';
import { WaterCounter } from '@screens/water/WaterCounter';
import { formatMl } from '@screens/water/format';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useWaterGoalFeedback, useWaterSettings } from '@services/water';

export function HomeScreen() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { data: profile } = useMyProfile(userId);
  const firstName = profile?.fullName.split(' ')[0];

  // The widget may have met the goal while the app was closed: celebrate it here once.
  const { settings: waterSettings } = useWaterSettings();
  const { data: water } = useWaterDay(userId, waterSettings?.timeZone);
  const goalFeedback = useWaterGoalFeedback(userId, water?.date, water?.totalMl, waterSettings?.goalMl);

  return (
    <Screen
      bottomInset={false}
      feedback={
        goalFeedback.visible && water ? (
          // TODO(motion): feedback sheet entering and leaving.
          <FeedbackSheet
            tone="water"
            title="Meta do dia batida."
            message={`${formatMl(water.totalMl)} ml hoje.`}
            actionLabel="Continuar"
            onAction={goalFeedback.dismiss}
          />
        ) : undefined
      }
    >
      <Box gap="s16" marginBottom="s24">
        {active ? (
          <Box flexDirection="row" alignItems="center" gap="s12">
            <AcademyLogo name={active.gymName} url={active.gymLogoUrl} size="small" />
            <Text variant="heading" flex={1} numberOfLines={2}>
              {active.gymName}
            </Text>
            {/* Students have the full top bar (with water) in StudentHome. */}
            {isStaff ? <WaterCounter /> : null}
          </Box>
        ) : null}
        <Text variant="title">{firstName ? `Olá, ${firstName}` : 'Olá'}</Text>
      </Box>
      {isStaff ? <ProfessorHome /> : <StudentHome />}
    </Screen>
  );
}
