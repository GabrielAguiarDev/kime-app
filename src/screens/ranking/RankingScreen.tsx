import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import {
  Avatar,
  BottomSheet,
  Box,
  Card,
  EmptyState,
  FilterChips,
  Icon,
  LoadError,
  Screen,
  SelectionCard,
  Text,
} from '@components';
import { useAcademyToday } from '@domain/Classes';
import { useMyProfile } from '@domain/Profile';
import {
  RANKING_CONFIG,
  rankingPeriod,
  useRanking,
  useRankingModalities,
  visibleRanking,
  type RankingEntry,
} from '@domain/Ranking';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

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
 * header; owner and professor pick one (default: the first).
 */
export function RankingView({ academyId }: { academyId: string }) {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const { isStaff } = useActiveGym();
  const { selected: studentModality } = useActiveModality();
  const today = useAcademyToday(academyId);
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const modalities = useRankingModalities(academyId, userId, period);
  const [picked, setPicked] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const options = modalities.data ?? [];
  const selected = isStaff
    ? (options.find((m) => m.id === picked) ?? options[0])
    : options.find((m) => m.id === studentModality?.id);
  const ranking = useRanking(academyId, selected?.id, period);
  const { rows, own } = visibleRanking(ranking.data ?? [], userId);

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
  if (today.isLoading || modalities.isLoading) return <ActivityIndicator accessibilityLabel="Carregando modalidades" />;
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

      <Box gap="s8">
        <Text variant="captionCaps">Ranking · {selected.name}</Text>
        <Text variant="caption">
          Últimos {RANKING_CONFIG.rollingDays} dias completos. Presença {RANKING_CONFIG.attendanceWeight * 100}% · constância
          de água {RANKING_CONFIG.hydrationWeight * 100}%.
        </Text>
      </Box>

      {!isStaff && profile.data && !profile.data.showInRanking ? (
        <Card gap="s4">
          <Text variant="bodyStrong">Você não aparece no ranking.</Text>
          <Text variant="caption">Mude em Perfil → Preferências.</Text>
        </Card>
      ) : null}

      <Box gap="s12">
        {ranking.isLoading ? <ActivityIndicator accessibilityLabel="Carregando ranking" /> : null}
        {ranking.isError ? <LoadError title="Não foi possível carregar o ranking" onRetry={() => void ranking.refetch()} /> : null}
        {ranking.data?.length === 0 ? <EmptyState visual="icon" icon="trophy" title="Nenhum aluno no ranking." /> : null}
        {rows.map((e) => (
          <RankingRow key={`${e.modalityId}:${e.userId}`} entry={e} isSelf={e.userId === userId} />
        ))}
        {own ? (
          <>
            <Text variant="caption" textAlign="center">
              …
            </Text>
            <RankingRow key={`${own.modalityId}:${own.userId}`} entry={own} isSelf />
          </>
        ) : null}
      </Box>
    </Box>
  );
}

const points = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Colleagues: position, photo, name and score only. The student's own row opens their numbers. */
function RankingRow({ entry: e, isSelf }: { entry: RankingEntry; isSelf: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const head = (
    <Box flexDirection="row" alignItems="center" gap="s12">
      {e.position === 1 ? (
        <Icon name="trophy" color="accent" />
      ) : (
        <Text variant="counter" color="textMuted">
          {e.position ?? '–'}
        </Text>
      )}
      <Avatar name={e.fullName} path={e.avatarPath} />
      <Text variant="bodyStrong" flex={1}>
        {e.fullName}
        {isSelf ? ' (você)' : ''}
      </Text>
      <Text variant="counter">{points(e.rankingScore)}</Text>
    </Box>
  );
  if (!isSelf) return <Card>{head}</Card>;
  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`Sua posição: ${e.position ?? 'em classificação'}, ${points(e.rankingScore)} pontos. ${expanded ? 'Ocultar' : 'Ver'} seus números`}
    >
      <Card selected gap="s12">
        {head}
        {e.status === 'qualifying' ? (
          <Text variant="caption" color="accent">
            Em classificação · faltam {e.daysToQualify} {e.daysToQualify === 1 ? 'dia' : 'dias'}
          </Text>
        ) : null}
        {expanded ? (
          <Box gap="s8">
            <Text variant="caption">
              Presença: {percent(e.attendanceRate)} · {e.confirmedClasses}{' '}
              {e.confirmedClasses === 1 ? 'aula confirmada' : 'aulas confirmadas'} · meta de {e.weeklyGoal}{' '}
              {e.weeklyGoal === 1 ? 'aula' : 'aulas'} por semana
            </Text>
            <Text variant="caption">
              Água: {e.eligibleHydrationDays ? percent(e.hydrationRate) : 'sem meta registrada'} ·{' '}
              {e.hydrationGoalsAchieved} de {e.eligibleHydrationDays} {e.eligibleHydrationDays === 1 ? 'dia' : 'dias'} com a
              meta cumprida
            </Text>
            {e.protectedDays ? (
              <Text variant="caption">
                {e.protectedDays} {e.protectedDays === 1 ? 'dia protegido' : 'dias protegidos'} pelo congelamento (fora da conta)
              </Text>
            ) : null}
            <Text variant="caption">
              Cada semana conta até 100% da meta de aulas. A água conta os dias em que você cumpriu a sua meta, nunca o volume.
            </Text>
          </Box>
        ) : null}
      </Card>
    </Pressable>
  );
}
