import { router } from 'expo-router';

import { useWindowDimensions } from 'react-native';

import { AcademyLogo, Box, FeedbackSheet, HeaderButton, HeaderMenu, Icon, Screen, Text } from '@components';
import { useWaterDay } from '@domain/Water';
import { StaffHome } from '@screens/staff/StaffHome';
import { StudentHome } from '@screens/student/StudentHome';
import { WaterCounter } from '@screens/water/WaterCounter';
import { formatMl } from '@screens/water/format';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useStreakRecords } from '@services/streaks';
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
  const record = useStreakRecords();

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
      // Today's water at the top right for everyone (students and staff).
      headerRight={<WaterCounter inHeader />}
      bottomInset={false}
      feedback={
        goalFeedback.visible && water ? (
          // TODO(motion): feedback sheet entering and leaving.
          <FeedbackSheet
            tone="water"
            title={waterSettings?.isLimit ? "Limite do dia cumprido." : "Meta do dia batida."}
            message={`${formatMl(water.totalMl)} ml hoje.`}
            actionLabel="Continuar"
            onAction={goalFeedback.dismiss}
          />
        ) : record.notice ? (
          <FeedbackSheet
            tone="accent"
            icon="flame"
            title="Novo recorde."
            message={
              record.notice.kind === 'water'
                ? `${record.notice.count} dias seguidos cumprindo o objetivo de água.`
                : `${record.notice.count} semanas seguidas treinando.`
            }
            actionLabel="Ver ofensivas"
            onAction={() => {
              record.dismiss();
              router.push('/ofensivas');
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
      {isStaff ? <StaffHome /> : <StudentHome />}
    </Screen>
  );
}
