import { router } from 'expo-router';
import { useState, type ComponentRef, type Ref } from 'react';
import { Alert, View, type LayoutChangeEvent } from 'react-native';

import {
  BottomSheet,
  Button,
  Box,
  Card,
  EmptyState,
  FilterChips,
  Icon,
  LoadError,
  PersonRow,
  Screen,
  SelectionCard,
  Text,
  Spinner,
} from '@components';
import { useAcademyToday } from '@domain/Classes';
import { errorMessage } from '@infra';
import { useMyProfile } from '@domain/Profile';
import {
  MEDAL_PLACES,
  rankingPeriod,
  rankingSections,
  rankingTrend,
  recalculateRanking,
  useRanking,
  useRankingModalities,
  type RankingEntry,
} from '@domain/Ranking';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useAppTheme, type ColorToken } from '@theme';

import { RankingHeader } from './RankingHeader';
import { days, points } from './rankingFormat';
import { useOpenPerson } from '@screens/team/useOpenPerson';

export function RankingScreen() {
  const { active } = useActiveGym();
  return (
    <Screen nativeHeader title="Ranking" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      {active ? <RankingView academyId={active.gymId} /> : null}
    </Screen>
  );
}

/**
 * Always one modality. Students follow the modality selected in the Início
 * header; owner and professor pick one (default: the first). Layout: header
 * (modality · window, "i" explains the score), one compact list (medals for
 * the top 3), then "Em classificação" (students still short of the minimum days).
 * Staff see the same screen without a highlighted "você" row.
 */
export function RankingView({
  academyId,
  onOpenMember,
  ownRowRef,
  onOwnRowLayout,
}: {
  academyId: string;
  /** Student: a row (own included) opens that member's profile. */
  onOpenMember?: (userId: string) => void;
  /** The student's own ranked row, so the parent can pin it when it is off screen. */
  ownRowRef?: Ref<ComponentRef<typeof View>>;
  onOwnRowLayout?: (e: LayoutChangeEvent) => void;
}) {
  const openPerson = useOpenPerson();
  const openMember = onOpenMember ?? ((id: string) => openPerson(id)?.());
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const { isStaff } = useActiveGym();
  const { selected: studentModality } = useActiveModality();
  const today = useAcademyToday(academyId);
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const modalities = useRankingModalities(academyId, userId, period);
  const [picked, setPicked] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const options = modalities.data ?? [];
  const selected = isStaff
    ? (options.find((m) => m.id === picked) ?? options[0])
    : options.find((m) => m.id === studentModality?.id);
  const ranking = useRanking(academyId, selected?.id, period);
  const viewerId = isStaff ? undefined : userId;
  const { list, ownBelow, qualifying, own } = rankingSections(ranking.data ?? [], viewerId);

  if (today.isError || modalities.isError) {
    return (
      <LoadError
        title="Não foi possível carregar as modalidades do ranking"
        onRetry={() => {
          void today.refetch();
          void modalities.refetch();
        }}
      />
    );
  }
  if (today.isLoading || modalities.isLoading) return <Spinner accessibilityLabel="Carregando modalidades" />;
  if (!selected) {
    return (
      <EmptyState
        visual="icon"
        icon="trophy"
        title={isStaff ? 'Nenhuma modalidade cadastrada.' : 'Sem ranking nesta modalidade ainda.'}
        description={isStaff ? 'Cadastre as modalidades da academia para ver os rankings.' : undefined}
      />
    );
  }

  const row = (e: RankingEntry, last: boolean) => {
    const isSelf = e.userId === viewerId;
    const r = <RankingRow key={`${e.modalityId}:${e.userId}`} entry={e} isSelf={isSelf} last={last} onOpen={openMember} />;
    return isSelf && e.status === 'ranked' && ownRowRef ? (
      <View key={`${e.modalityId}:${e.userId}`} ref={ownRowRef} onLayout={onOwnRowLayout} collapsable={false}>
        {r}
      </View>
    ) : r;
  };

  return (
    <Box gap="s24">
      {isStaff && options.length > 1 ? (
        <>
          <FilterChips
            accessibilityLabel="Filtros"
            chips={[
              {
                key: 'modality',
                label: selected.name,
                selected: true,
                icon: 'chevronDown',
                accessibilityLabel: `Modalidade: ${selected.name}. Trocar`,
                onPress: () => setPicking(true),
              },
            ]}
          />
          <BottomSheet visible={picking} onRequestClose={() => setPicking(false)}>
            <SheetForm title="Modalidade" tall>
              {options.map((m) => (
                <SelectionCard
                  key={m.id}
                  label={m.name}
                  selected={selected.id === m.id}
                  onPress={() => {
                    setPicked(m.id);
                    setPicking(false);
                  }}
                />
              ))}
            </SheetForm>
          </BottomSheet>
        </>
      ) : null}

      <RankingHeader modalityName={selected.name} />

      {!isStaff && profile.data && !profile.data.showInRanking ? (
        <Card gap="s4">
          <Text variant="bodyStrong">Você não aparece no ranking.</Text>
          <Text variant="caption">Mude em Perfil → Preferências.</Text>
        </Card>
      ) : null}

      {own && own.status === 'qualifying' ? (
        <Card selected flexDirection="row" alignItems="center" gap="s12">
          <Icon name="clock" color="accent" />
          <Text variant="body" flex={1}>
            Você entra no ranking em {days(own.daysToQualify)}. Continue treinando e batendo sua meta de água.
          </Text>
        </Card>
      ) : null}

      {ranking.isLoading ? <Spinner accessibilityLabel="Carregando ranking" /> : null}
      {ranking.isError ? <LoadError title="Não foi possível carregar o ranking" onRetry={() => void ranking.refetch()} /> : null}
      {ranking.data?.length === 0 ? <EmptyState visual="icon" icon="trophy" title="Nenhum aluno no ranking." /> : null}

      {ranking.data?.length ? (
        <>
          {/* The medal places always show; empty ones as "Vaga aberta". */}
          <Card paddingVertical="s4">
            {list.map((e, i) => row(e, i === list.length - 1 && list.length >= MEDAL_PLACES))}
            {Array.from({ length: Math.max(0, MEDAL_PLACES - list.length) }, (_, i) => list.length + i + 1).map((place) => (
              <OpenPlaceRow key={`open-${place}`} place={place} last={place === MEDAL_PLACES} />
            ))}
          </Card>
          {ownBelow ? (
            <Box gap="s8">
              <Text variant="caption" textAlign="center">…</Text>
              <Card paddingVertical="s4">{row(ownBelow, true)}</Card>
            </Box>
          ) : null}

          {qualifying.length ? (
            <Box gap="s8">
              <Text variant="captionCaps">Em classificação ({qualifying.length})</Text>
              <Card paddingVertical="s4">{qualifying.map((e, i) => row(e, i === qualifying.length - 1))}</Card>
            </Box>
          ) : null}
        </>
      ) : null}

      {isStaff ? <Button title="Recalcular ranking" variant="secondary" loading={recalculating} onPress={async () => {
        setRecalculating(true);
        try { await recalculateRanking(academyId); await ranking.refetch(); }
        catch (error) { Alert.alert('Ranking', errorMessage(error)); }
        finally { setRecalculating(false); }
      }} /> : null}
    </Box>
  );
}

/**
 * Colleagues: position (with the trend vs the previous day), photo, name and
 * score; qualifying students show the days left instead. `onOpen`: tap opens
 * their profile (the student's own row too, highlighted in accent). `pinned`: the copy fixed at the bottom of the screen.
 */
export function RankingRow({
  entry: e,
  isSelf,
  last,
  onOpen,
  pinned = false,
}: {
  entry: RankingEntry;
  isSelf: boolean;
  last?: boolean;
  onOpen?: (userId: string) => void;
  pinned?: boolean;
}) {
  const theme = useAppTheme();
  const qualifying = e.status !== 'ranked' || e.position == null;
  const head = (
    <PersonRow
      last={last || isSelf}
      dense
      name={`${e.fullName}${isSelf ? ' (você)' : ''}`}
      avatarPath={e.avatarPath}
      trailing={
        qualifying
          ? <Text variant="caption">faltam {days(e.daysToQualify)}</Text>
          : (
            <Box flexDirection="row" alignItems="center" gap="s8">
              <Text variant="counter">{points(e.rankingScore)}</Text>
              <PositionTrend entry={e} />
            </Box>
          )
      }
      chevron={false}
      onPress={onOpen ? () => onOpen(e.userId) : undefined}
    />
  );
  if (!isSelf) return head;
  return (
    <Box
      backgroundColor="accentSelected"
      borderColor="accent"
      borderWidth={theme.border.width}
      borderRadius="md"
      paddingHorizontal="s8"
      style={pinned ? undefined : { marginHorizontal: -theme.spacing.s8 }}
    >
      {head}
    </Box>
  );
}

const MEDALS: Record<number, { face: ColorToken; edge: ColorToken; label: string }> = {
  1: { face: 'medalGold', edge: 'medalGoldEdge', label: 'ouro' },
  2: { face: 'medalSilver', edge: 'medalSilverEdge', label: 'prata' },
  3: { face: 'medalBronze', edge: 'medalBronzeEdge', label: 'bronze' },
};
const MEDAL = 24;
const MEDAL_EDGE = 3;

function Medal({ place }: { place: number }) {
  const medal = MEDALS[place]!;
  return (
    <Box>
      <Box
        backgroundColor={medal.edge}
        style={{ borderRadius: MEDAL / 2, paddingBottom: MEDAL_EDGE }}
        accessible
        accessibilityLabel={`${place}º lugar, medalha de ${medal.label}`}
      >
        <Box width={MEDAL} height={MEDAL} backgroundColor={medal.face} alignItems="center" justifyContent="center" style={{ borderRadius: MEDAL / 2 }}>
          <Text variant="bodyStrong" color="onWarning" style={{ fontSize: 13, lineHeight: 16 }}>{place}</Text>
        </Box>
      </Box>
    </Box>
  );
}

/** Empty medal place: dashed photo with "?", "Vaga aberta" and the medal on the right. */
function OpenPlaceRow({ place, last }: { place: number; last: boolean }) {
  const theme = useAppTheme();
  return (
    <Box
      minHeight={48}
      style={{ paddingVertical: 6 }}
      flexDirection="row"
      alignItems="center"
      gap="s12"
      borderBottomWidth={last ? 0 : theme.border.width}
      borderColor="border"
    >
      <Box
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        borderWidth={theme.border.width}
        borderColor="textMuted"
        style={{ borderRadius: 16, borderStyle: 'dashed' }}
      >
        <Text variant="bodyStrong" color="textMuted">?</Text>
      </Box>
      <Text variant="body" color="textMuted" flex={1}>Vaga aberta</Text>
      <Medal place={place} />
    </Box>
  );
}

/**
 * Right corner: the arrow vs the previous day's calculation (nothing when
 * unchanged), then the position: a medal for the top 3, a small number after.
 */
function PositionTrend({ entry }: { entry: RankingEntry }) {
  const trend = rankingTrend(entry);
  return (
    <Box flexDirection="row" alignItems="center" gap="s4">
      {trend ? (
        <Box accessible accessibilityLabel={trend === 'up' ? 'Subiu desde ontem' : 'Caiu desde ontem'}>
          <Icon name={trend === 'up' ? 'arrowUp' : 'arrowDown'} size={14} color={trend === 'up' ? 'success' : 'danger'} />
        </Box>
      ) : null}
      {entry.position != null && entry.position <= MEDAL_PLACES ? (
        <Medal place={entry.position} />
      ) : (
        <Box style={{ minWidth: MEDAL }} alignItems="center" accessible accessibilityLabel={`${entry.position}º lugar`}>
          <Text variant="caption" color="textMuted">{entry.position}º</Text>
        </Box>
      )}
    </Box>
  );
}
