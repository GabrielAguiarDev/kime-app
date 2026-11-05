import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { Avatar, Box, Card, ChoiceRow, EmptyState, Icon, LoadError, Screen, Text } from '@components';
import { useAcademyToday, useModalities } from '@domain/Classes';
import { useMyProfile } from '@domain/Profile';
import {
  addMonths,
  championsByMonth,
  classesLabel,
  monthLabel,
  monthStart,
  useRanking,
  useRankingChampions,
  visibleRanking,
  type RankingEntry,
} from '@domain/Ranking';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

const OVERALL = 'all';

/**
 * Ranking of the academy: confirmed classes in the month, overall or per
 * modality, with the champions of past months. Students and staff.
 */
export function RankingScreen() {
  const { active } = useActiveGym();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen nativeHeader title="Ranking" onBack={back}>
      {active ? <RankingView academyId={active.gymId} /> : null}
    </Screen>
  );
}

/** The ranking itself (also a segment of Equipe): month, modality, list, champions. */
export function RankingView({ academyId }: { academyId: string }) {
  const { userId } = useSession();
  const today = useAcademyToday(academyId);
  const modalities = useModalities(academyId);
  const profile = useMyProfile(userId);
  const { isStaff } = useActiveGym();
  const [monthPicked, setMonthPicked] = useState<string | null>(null);
  const [modality, setModality] = useState<string>(OVERALL);

  const currentMonth = today.data ? monthStart(today.data) : undefined;
  const month = monthPicked ?? currentMonth;
  const modalityId = modality === OVERALL ? null : modality;
  const ranking = useRanking(academyId, month, modalityId);
  const champions = useRankingChampions(academyId, modalityId);

  if (today.isError) return <LoadError title="Não foi possível carregar o ranking" onRetry={() => void today.refetch()} />;
  if (!month || !currentMonth) return <ActivityIndicator accessibilityLabel="Carregando" />;

  const isCurrent = month === currentMonth;
  const { rows, own } = visibleRanking(ranking.data ?? [], userId);
  const groups = championsByMonth(champions.data ?? []);
  const options = [
    { value: OVERALL, label: 'Geral' },
    ...(modalities.data ?? []).map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <Box gap="s24">
      <MonthNav
        label={monthLabel(month)}
        onPrevious={() => setMonthPicked(addMonths(month, -1))}
        onNext={isCurrent ? undefined : () => setMonthPicked(addMonths(month, 1))}
      />
      {options.length > 2 ? (
        <ChoiceRow accessibilityLabel="Modalidade" options={options} value={modality} onChange={setModality} />
      ) : null}

      {!isStaff && profile.data && !profile.data.showInRanking ? (
        <Card gap="s4">
          <Text variant="bodyStrong">Você não aparece no ranking.</Text>
          <Text variant="caption">Mude em Perfil → Preferências.</Text>
        </Card>
      ) : null}

      <Box gap="s8">
        <Text variant="captionCaps">{isCurrent ? 'Aulas confirmadas neste mês' : 'Aulas confirmadas no mês'}</Text>
        {ranking.isLoading ? <ActivityIndicator /> : null}
        {ranking.isError ? <LoadError title="Não foi possível carregar o ranking" onRetry={() => void ranking.refetch()} /> : null}
        {ranking.data && ranking.data.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="trophy"
            title="Nenhuma aula confirmada neste mês."
            description={isCurrent && !isStaff ? 'A primeira aula confirmada já coloca você no topo.' : undefined}
          />
        ) : null}
        {rows.map((e) => (
          <RankingRow key={e.userId} entry={e} isSelf={e.userId === userId} />
        ))}
        {own ? (
          <>
            <Text variant="caption" textAlign="center" accessibilityElementsHidden>
              …
            </Text>
            <RankingRow entry={own} isSelf />
          </>
        ) : null}
      </Box>

      <Box gap="s8">
        <Text variant="captionCaps">Campeões</Text>
        {champions.isLoading ? <ActivityIndicator /> : null}
        {champions.data && groups.length === 0 ? (
          <Text variant="body" color="textMuted">
            O campeão de cada mês aparece aqui quando o mês termina.
          </Text>
        ) : null}
        {groups.map((g) => (
          <Card key={g.month} flexDirection="row" alignItems="center" gap="s12">
            <Icon name="trophy" color="accent" active />
            <Box flex={1} gap="s4">
              <Text variant="caption">{monthLabel(g.month)}</Text>
              <Text variant="bodyStrong">{g.champions.map((c) => c.fullName).join(', ')}</Text>
            </Box>
            <Text variant="caption">{classesLabel(g.champions[0]!.classes)}</Text>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

function MonthNav({ label, onPrevious, onNext }: { label: string; onPrevious: () => void; onNext?: () => void }) {
  const theme = useAppTheme();
  const button = (direction: 'previous' | 'next', onPress?: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'previous' ? 'Mês anterior' : 'Próximo mês'}
      accessibilityState={{ disabled: !onPress }}
      hitSlop={theme.spacing.s8}
      style={{ width: theme.size.touchTarget, height: theme.size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={direction === 'previous' ? 'chevronLeft' : 'chevronRight'} color={onPress ? 'text' : 'disabled'} />
    </Pressable>
  );
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="space-between">
      {button('previous', onPrevious)}
      <Text variant="heading">{label}</Text>
      {button('next', onNext)}
    </Box>
  );
}

function RankingRow({ entry, isSelf }: { entry: RankingEntry; isSelf: boolean }) {
  const { size } = useAppTheme();
  const podium = entry.position <= 3;
  return (
    <Card
      selected={isSelf}
      flexDirection="row"
      alignItems="center"
      gap="s12"
      accessible
      accessibilityLabel={`${entry.position}º lugar: ${entry.fullName}${isSelf ? ' (você)' : ''}, ${classesLabel(entry.classes)}`}
    >
      <Box minWidth={size.touchTarget} alignItems="center">
        {entry.position === 1 ? (
          <Icon name="trophy" color="accent" active />
        ) : (
          <Text variant="counter" color={podium ? 'accent' : 'textMuted'}>
            {entry.position}
          </Text>
        )}
      </Box>
      <Avatar name={entry.fullName} path={entry.avatarPath} />
      <Text variant="bodyStrong" flex={1} numberOfLines={1}>
        {entry.fullName}
        {isSelf ? ' (você)' : ''}
      </Text>
      <Text variant="counter">{entry.classes}</Text>
    </Card>
  );
}
