import { router } from 'expo-router';

import { useWindowDimensions } from 'react-native';

import { AcademyLogo, Box, FeedbackSheet, HeaderButton, Screen, Text } from '@components';
import { useWaterDay } from '@domain/Water';
import { ProfessorHome } from '@screens/professor/ProfessorHome';
import { StudentHome } from '@screens/student/StudentHome';
import { WaterCounter } from '@screens/water/WaterCounter';
import { formatMl } from '@screens/water/format';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useWaterGoalFeedback, useWaterSettings } from '@services/water';

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const { userId } = useSession();
  const { active, isStaff, memberships } = useActiveGym();
  const rejection = useJoinRequestNotices(userId, memberships);

  // The widget may have met the goal while the app was closed: celebrate it here once.
  const { settings: waterSettings } = useWaterSettings();
  const { data: water } = useWaterDay(userId, waterSettings?.timeZone);
  const goalFeedback = useWaterGoalFeedback(userId, water?.date, water?.totalMl, waterSettings?.goalMl);

  return (
    <Screen
      nativeHeader
      // No title: the academy (logo + name) sits on the left, water on the right.
      largeTitle={false}
      headerLeft={
        active ? (
          <HeaderButton accessibilityLabel={`${active.gymName}. Abrir perfil e academias`} onPress={() => router.navigate('/(tabs)/profile')}>
            <Box flexDirection="row" alignItems="center" gap="s8" paddingRight="s8" style={{ maxWidth: width * 0.6 }}>
              <AcademyLogo name={active.gymName} url={active.gymLogoUrl} size="header" />
              <Text variant="navTitle" numberOfLines={1} flexShrink={1}>
                {active.gymName}
              </Text>
            </Box>
          </HeaderButton>
        ) : undefined
      }
      // Today's water at the top right for everyone (students and staff).
      headerRight={<WaterCounter inHeader />}
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
        ) : rejection.notice ? (
          <FeedbackSheet
            tone="danger"
            icon="rejected"
            title="Pedido recusado"
            message={
              rejection.notice.gymName
                ? `A ${rejection.notice.gymName} recusou seu pedido de entrada.`
                : 'Uma academia recusou seu pedido de entrada.'
            }
            actionLabel="Entendi"
            onAction={rejection.dismiss}
          />
        ) : undefined
      }
    >
      {isStaff ? <ProfessorHome /> : <StudentHome />}
    </Screen>
  );
}
