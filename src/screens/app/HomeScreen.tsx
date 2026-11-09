import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { AcademyLogo, Box, FeedbackSheet, HeaderButton, HeaderMenu, Icon, KimiMascot, Screen, Text } from '@components';
import { useWaterDay } from '@domain/Water';
import { StaffHome } from '@screens/staff/StaffHome';
import { StudentHome } from '@screens/student/StudentHome';
import { WaterCounter } from '@screens/water/WaterCounter';
import { WaterGoalSheet } from '@screens/water/WaterGoalSheet';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useStreakNotices } from '@services/streaks';
import { useWaterGoalFeedback, useWaterSettings } from '@services/water';
import { useAppTheme } from '@theme';

const openProfile = () => router.navigate('/(tabs)/profile');

/** Header item of Início: academy logo + a title (academy or modality), caret when it opens a menu. */
function HeaderTitle({
  logoName,
  logoUrl,
  title,
  maxWidth,
  caret = false,
}: {
  logoName: string;
  logoUrl: string | null;
  title: string;
  maxWidth: number;
  caret?: boolean;
}) {
  const { size } = useAppTheme();
  return (
    <Box flexDirection="row" alignItems="center" gap="s8" paddingRight="s8" style={{ maxWidth }}>
      <AcademyLogo name={logoName} url={logoUrl} size="header" />
      <Text variant="navTitle" numberOfLines={1} flexShrink={1}>
        {title}
      </Text>
      {caret ? <Icon name="chevronDown" color="textMuted" size={size.iconInline} /> : null}
    </Box>
  );
}

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const { userId } = useSession();
  const { active, isStaff, memberships } = useActiveGym();
  const { modalities, selected, select } = useActiveModality();
  const rejection = useJoinRequestNotices(userId, memberships);

  // The widget may have met the goal while the app was closed: celebrate it here once.
  const { settings: waterSettings } = useWaterSettings();
  const { data: water } = useWaterDay(userId, waterSettings?.timeZone);
  const goalFeedback = useWaterGoalFeedback(userId, water?.date, water?.totalMl, waterSettings?.goalMl, waterSettings?.isLimit);
  const streak = useStreakNotices();
  // Accepted a competition team invite (the invite card is gone by then): "Bem-vindo à equipe."
  const [joinedTeam, setJoinedTeam] = useState(false);

  return (
    <Screen
      nativeHeader
      // No title: logo + name on the left (staff: the academy; student: the selected
      // modality, with a native menu to switch when there is more than one), water on the right.
      largeTitle={false}
      headerLeft={
        !active ? undefined : isStaff || !selected ? (
          <HeaderButton accessibilityLabel={`${active.gymName}. Abrir perfil e academias`} onPress={openProfile}>
            <HeaderTitle logoName={active.gymName} logoUrl={active.gymLogoUrl} title={active.gymName} maxWidth={width * 0.6} />
          </HeaderButton>
        ) : modalities.length > 1 ? (
          <HeaderMenu
            accessibilityLabel={`${selected.name}, ${active.gymName}. Trocar modalidade`}
            label={
              <HeaderTitle
                logoName={active.gymName}
                logoUrl={active.gymLogoUrl}
                title={selected.name}
                maxWidth={width * 0.6}
                caret
              />
            }
            options={modalities.map((m) => ({ id: m.id, title: m.name }))}
            selectedId={selected.id}
            onSelect={select}
            extraAction={
              memberships.filter((m) => m.status === 'active').length > 1
                ? { title: 'Trocar academia', onPress: openProfile }
                : undefined
            }
            onFallbackPress={openProfile}
          />
        ) : (
          <HeaderButton accessibilityLabel={`${selected.name}, ${active.gymName}. Abrir perfil e academias`} onPress={openProfile}>
            <HeaderTitle logoName={active.gymName} logoUrl={active.gymLogoUrl} title={selected.name} maxWidth={width * 0.6} />
          </HeaderButton>
        )
      }
      // Today's water at the top right for everyone (students and staff). DEV: debug screen.
      headerRight={
        __DEV__ ? (
          <Box flexDirection="row" alignItems="center" gap="s16">
            <HeaderButton icon="bug" accessibilityLabel="Abrir tela de debug" onPress={() => router.push('/debug')} />
            <WaterCounter inHeader />
          </Box>
        ) : (
          <WaterCounter inHeader />
        )
      }
      bottomInset={false}
      feedback={
        joinedTeam ? (
          <FeedbackSheet
            tone="success"
            title="Bem-vindo à equipe."
            mascot={<KimiMascot size="feedback" pose="team" />}
            actionLabel="Continuar"
            onAction={() => setJoinedTeam(false)}
          />
        ) : goalFeedback.visible && water ? (
          <WaterGoalSheet
            isLimit={!!waterSettings?.isLimit}
            totalMl={water.totalMl}
            streak={streak.waterCurrent}
            onAction={goalFeedback.dismiss}
          />
        ) : streak.notice ? (
          <FeedbackSheet
            key={`${streak.notice.kind}.${streak.notice.count}`}
            tone="accent"
            title={streak.notice.record ? 'Novo recorde.' : 'Nada mal.'}
            mascot={<KimiMascot size="feedback" pose="streak" />}
            message={
              streak.notice.kind === 'water'
                ? `${streak.notice.count} dias seguidos cumprindo o objetivo de água.`
                : streak.notice.count === 1
                  ? '1 semana treinando.'
                  : `${streak.notice.count} semanas seguidas treinando.`
            }
            actionLabel={streak.notice.record ? 'Ver disciplina' : 'Continuar'}
            onAction={() => {
              streak.dismiss();
              if (streak.notice?.record) router.push('/disciplina');
            }}
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
      {isStaff ? <StaffHome /> : <StudentHome onJoinedTeam={() => setJoinedTeam(true)} />}
    </Screen>
  );
}
