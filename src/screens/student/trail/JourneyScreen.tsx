import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box, Button, EmptyState, HeaderButton, Screen, Text, Spinner } from '@components';
import { beltsOf, graduationTrail, useBelts, useModalityStats } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useAppTheme, withAlpha } from '@theme';

import { GraduationTrailList } from './GraduationTrailList';
import { DEMO_MODALITY_TOTAL, DEMO_TRAIL } from './journeyDemo';

/** iOS compact navigation bar under the status bar (title + subtitle), plus a little room. */
const NAV_BAR = 52;
/** Darkening behind the transparent header, so title and subtitle read over any environment. */
const HEADER_SCRIM = 0.6;

const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/classes'));

/**
 * Jornada: the graduation trail of the modality selected in the Início header
 * (opened from the progress cards of Aulas and Início). The trail climbs from
 * Seção 1 (bottom) to the dojo (top); it opens on the current section with the
 * ninja a little below the middle: the path walked below, what comes next above.
 */
export function JourneyScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useAppTheme();
  // DEV ONLY: sample trail with 7 sections (journeyDemo). Never in production builds.
  const [demo, setDemo] = useState(false);
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const { selected, isLoading: modalitiesLoading } = useActiveModality();
  const belts = useBelts(academyId);
  const modalityStats = useModalityStats(academyId);

  const loading = modalitiesLoading || belts.isLoading || modalityStats.isLoading;
  const failed = belts.isError || modalityStats.isError;
  const own = (modalityStats.data ?? []).find((s) => s.userId === userId && s.modalityId === selected?.id);
  const modalityBelts = useMemo(
    () => (selected?.usesBelts ? beltsOf(belts.data ?? [], selected.id) : []),
    [belts.data, selected],
  );
  const trail = useMemo(
    () =>
      !loading && !failed && modalityBelts.length > 0
        ? graduationTrail(modalityBelts, own?.beltId ?? null, own?.confirmedSinceBelt ?? 0)
        : null,
    [loading, failed, modalityBelts, own?.beltId, own?.confirmedSinceBelt],
  );

  // The list is mounted from the first render (iOS header, see Screen);
  // loading, errors and the empty state live in its header.
  const header = trail ? undefined : failed ? (
    <EmptyState
      visual="icon"
      icon="offline"
      title="Não foi possível carregar a jornada"
      action={
        <Button
          title="Tentar de novo"
          variant="secondary"
          onPress={() => {
            void belts.refetch();
            void modalityStats.refetch();
          }}
        />
      }
    />
  ) : loading ? (
    <Spinner accessibilityLabel="Carregando" />
  ) : selected && !selected.usesBelts ? (
    <EmptyState
      visual="icon"
      icon="medal"
      title="Esta modalidade não tem faixas."
      action={<Button title="Ver relatório de treinos" variant="secondary" onPress={() => router.push('/relatorio')} />}
    />
  ) : (
    <EmptyState visual="icon" icon="belt" title="A academia ainda não cadastrou as faixas desta modalidade." />
  );

  const showDemo = __DEV__ && demo;
  const shown = showDemo ? DEMO_TRAIL : trail;

  return (
    <Screen
      nativeHeader
      title="Jornada"
      subtitle={showDemo ? 'Demonstração' : selected?.name}
      onBack={back}
      scrollable={false}
      headerRight={
        <Box flexDirection="row" alignItems="center" gap="s16">
          {__DEV__ ? (
            <HeaderButton accessibilityLabel={demo ? 'Usar dados reais' : 'Usar dados de exemplo'} onPress={() => setDemo((d) => !d)}>
              <Text variant="caption" color="textMuted">
                {demo ? 'Real' : 'Demo'}
              </Text>
            </HeaderButton>
          ) : null}
          <HeaderButton icon="chart" accessibilityLabel="Relatório de treinos" onPress={() => router.push('/relatorio')} />
        </Box>
      }
    >
      <GraduationTrailList
        header={shown ? undefined : header}
        trail={shown}
        modalityTotal={showDemo ? DEMO_MODALITY_TOTAL : (own?.confirmedTotal ?? 0)}
        scrollKey={showDemo ? 'demo' : (selected?.id ?? '')}
      />
      {shown && Platform.OS === 'ios' ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top + NAV_BAR, backgroundColor: withAlpha(colors.bg, HEADER_SCRIM) }}
        />
      ) : null}
    </Screen>
  );
}
