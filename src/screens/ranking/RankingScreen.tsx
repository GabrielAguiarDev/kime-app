import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Avatar, Box, Card, ChoiceRow, EmptyState, Icon, LoadError, Screen, Text, TextButton } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { useRankingModalities } from '@domain/Ranking/useCases/useModalityEnrollments';
import { useMyProfile } from '@domain/Profile';
import { RANKING_CONFIG, rankingPeriod, useRanking, visibleRanking, type RankingEntry } from '@domain/Ranking';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

export function RankingScreen() {
  const { active } = useActiveGym();
  return (
    <Screen nativeHeader title="Ranking" onBack={() => router.canGoBack() ? router.back() : router.replace('/')}>
      {active ? <RankingView academyId={active.gymId} /> : null}
    </Screen>
  );
}

export function RankingView({ academyId }: { academyId: string }) {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const { isStaff } = useActiveGym();
  const today = useAcademyToday(academyId);
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const modalities = useRankingModalities(academyId, userId, period);
  const [pickedModality, setPickedModality] = useState<string | null>(null);
  const selected = modalities.data?.find((m) => m.id === pickedModality) ?? modalities.data?.[0];
  const ranking = useRanking(academyId, selected?.id, period);
  const { rows, own } = visibleRanking(ranking.data ?? [], userId);
  if (today.isError || modalities.isError) {
    return <LoadError title="Não foi possível carregar as modalidades do ranking" onRetry={() => { void today.refetch(); void modalities.refetch(); }} />;
  }
  if (today.isLoading || modalities.isLoading) return <ActivityIndicator accessibilityLabel="Carregando modalidades" />;
  if (!selected) return <EmptyState visual="icon" icon="trophy" title={isStaff ? 'Nenhuma modalidade cadastrada.' : 'Nenhuma matrícula ativa em modalidade.'} description={isStaff ? 'Cadastre as modalidades da academia para consultar seus rankings.' : 'Peça à equipe para conferir suas matrículas.'} />;
  return (
    <Box gap="s24">
      <ChoiceRow
        accessibilityLabel="Modalidade do ranking"
        options={(modalities.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
        value={selected.id}
        onChange={setPickedModality}
      />
      <Box gap="s8">
        <Text variant="captionCaps">Ranking · {selected.name}</Text>
        <Text variant="caption">Últimos {RANKING_CONFIG.rollingDays} dias completos · atualizado continuamente</Text>
        <Text variant="caption">Aulas {RANKING_CONFIG.attendanceWeight * 100}% · Água {RANKING_CONFIG.hydrationWeight * 100}%. Falta: −{RANKING_CONFIG.penalties.missedClass} pontos · Água sem proteção: −{RANKING_CONFIG.penalties.missedHydrationGoal} pontos.</Text>
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
        {rows.map((e) => <RankingRow key={`${e.modalityId}:${e.userId}`} entry={e} isSelf={e.userId === userId} />)}
        {own ? <><Text variant="caption" textAlign="center">…</Text><RankingRow key={`${own.modalityId}:${own.userId}`} entry={own} isSelf /></> : null}
      </Box>
    </Box>
  );
}

const points = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
function RankingRow({ entry: e, isSelf }: { entry: RankingEntry; isSelf: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card selected={isSelf} gap="s12">
      <Box flexDirection="row" alignItems="center" gap="s12">
        {e.position === 1 ? <Icon name="trophy" color="accent" /> : <Text variant="counter" color="textMuted">{e.position ?? '–'}</Text>}
        <Avatar name={e.fullName} path={e.avatarPath} />
        <Text variant="bodyStrong" flex={1}>{e.fullName}{isSelf ? ' (você)' : ''}</Text>
        <Text variant="counter">{points(e.rankingScore)}</Text>
      </Box>
      {e.status === 'qualifying' ? (
        <Text variant="caption" color="accent">Em classificação · faltam {e.daysToQualify} dias elegíveis</Text>
      ) : null}
      <Text variant="caption">Frequência: {e.eligibleClasses ? `${Math.round(e.attendanceRate * 100)}%` : 'sem aulas obrigatórias'} · Água: {e.eligibleHydrationDays ? `${Math.round(e.hydrationRate * 100)}%` : 'sem meta registrada'}</Text>
      <Text variant="caption" color={e.penaltyPoints ? 'danger' : 'textMuted'}>Penalidades: −{points(e.penaltyPoints)} pontos</Text>
      <TextButton title={expanded ? 'Ocultar pontuação' : 'Como foi calculado'} onPress={() => setExpanded(!expanded)} />
      {expanded ? <Box gap="s8">
        <Text variant="caption">Desempenho: {points(e.performanceScore)} pontos</Text>
        <Text variant="caption">Aulas obrigatórias: {e.validCheckIns}/{e.eligibleClasses} · Metas de água: {e.hydrationGoalsAchieved}/{e.eligibleHydrationDays}</Text>
        <Text variant="caption" color="danger">Falhas sem proteção: {e.unprotectedAttendanceFailures} em aulas · {e.unprotectedHydrationFailures} em água</Text>
        <Text variant="caption">Falhas de água protegidas: {e.protectedFailures} · sem pontos extras</Text>
        <Text variant="bodyStrong">Pontuação final: {points(e.rankingScore)} pontos</Text>
        <Text variant="caption">Só turmas obrigatórias vinculadas ao aluno contam. Dias sem meta válida não contam. Sem aulas ou metas elegíveis, o respectivo critério fica em zero.</Text>
      </Box> : null}
    </Card>
  );
}
