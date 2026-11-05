import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BeltChip, BigCounter, Box, Button, Card, ChoiceRow, EmptyState, ProgressBar, Screen, Text } from '@components';
import {
  beltName,
  beltProgress,
  beltsOf,
  trainedModalities,
  useAcademyToday,
  useBelts,
  useMemberStats,
  useModalities,
  useModalityStats,
  useSchedules,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { GraduationTrail } from '@screens/student/GraduationTrail';
import { WeekSchedule } from '@screens/student/WeekSchedule';
import { LinkRow } from '@screens/competition/shared';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/**
 * Aulas (student): per modality, the belt progress and graduation trail
 * (modalities with belts) or just the class count (without belts); then the
 * week's classes. Training more than one modality: a selector on top.
 */
export function ClassesScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const stats = useMemberStats(academyId);
  const modalityStats = useModalityStats(academyId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queries = [today, schedules, modalities, belts, stats, modalityStats];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);

  const own = stats.data?.find((s) => s.userId === userId);
  const ownModalities = (modalityStats.data ?? []).filter((s) => s.userId === userId);
  const trained = trainedModalities(modalities.data ?? [], ownModalities);
  const selected = trained.find((m) => m.id === selectedId) ?? trained[0] ?? null;
  const activeSchedules = (schedules.data ?? []).filter((s) => s.active);

  return (
    <Screen nativeHeader title="Aulas" bottomInset={false}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
      {failed ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar as aulas"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
        />
      ) : null}
      {!loading && !failed ? (
        <Box gap="s32">
          {trained.length > 1 && selected ? (
            <ChoiceRow
              accessibilityLabel="Modalidade"
              options={trained.map((m) => ({ value: m.id, label: m.name }))}
              value={selected.id}
              onChange={setSelectedId}
            />
          ) : null}

          {selected ? (
            <ModalityProgress
              key={selected.id}
              modality={selected}
              belts={beltsOf(belts.data ?? [], selected.id)}
              stats={ownModalities.find((s) => s.modalityId === selected.id)}
              overallTotal={own?.confirmedTotal ?? 0}
              showOverall={trained.length > 1 || (modalities.data?.length ?? 0) > 1}
            />
          ) : (
            <Card>
              <BigCounter value={own?.confirmedTotal ?? 0} label="Aulas confirmadas" />
            </Card>
          )}

          <LinkRow
            title="Ranking da academia"
            description="Quem mais treinou no mês"
            icon="trophy"
            onPress={() => router.push('/ranking')}
          />

          <Box gap="s12">
            <Text variant="captionCaps">Horários da semana</Text>
            {activeSchedules.length === 0 ? (
              <EmptyState title="Nenhum horário cadastrado." />
            ) : today.data ? (
              <WeekSchedule schedules={activeSchedules} today={today.data} />
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Screen>
  );
}

function ModalityProgress({
  modality,
  belts,
  stats,
  overallTotal,
  showOverall,
}: {
  modality: Modality;
  belts: ModalityBelt[];
  stats: ModalityStats | undefined;
  overallTotal: number;
  showOverall: boolean;
}) {
  const modalityTotal = stats?.confirmedTotal ?? 0;
  const overall = showOverall ? (
    <Text variant="caption">{`Total geral: ${overallTotal} ${overallTotal === 1 ? 'aula' : 'aulas'} em todas as modalidades`}</Text>
  ) : null;

  // Without belts: only the class count of the modality.
  if (!modality.usesBelts) {
    return (
      <Card gap="s12">
        <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
        {overall}
      </Card>
    );
  }

  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);

  return (
    <Box gap="s32">
      <Card gap="s16">
        {current ? <BeltChip belt={current} /> : <Text variant="caption">Sem faixa</Text>}
        {progress.next && progress.required > 0 ? (
          <ProgressBar
            value={progress.done}
            max={progress.required}
            unit="aulas"
            beltColor={progress.next.primary}
            label={`Até a faixa ${beltName(progress.next).toLowerCase()}`}
          />
        ) : (
          <Text variant="body" color="textMuted">
            {progress.next
              ? 'A academia ainda não definiu as aulas da próxima faixa.'
              : belts.length
                ? 'Você está na última faixa desta modalidade.'
                : 'A academia ainda não cadastrou as faixas desta modalidade.'}
          </Text>
        )}
        <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
        {overall}
      </Card>

      {progress.next && progress.required > 0 ? (
        <Box gap="s12">
          <Text variant="captionCaps">Trilha de graduação</Text>
          <GraduationTrail required={progress.required} done={progress.done} nextBelt={progress.next} />
        </Box>
      ) : null}
    </Box>
  );
}
