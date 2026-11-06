import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BeltChip, BigCounter, Box, Button, Card, EmptyState, ProgressBar, Screen, Text } from '@components';
import {
  addDays,
  beltName,
  beltProgress,
  beltsOf,
  classesOn,
  nextClassMilestone,
  useAcademyToday,
  useBelts,
  useMemberStats,
  useModalityStats,
  useMyCheckins,
  useSchedules,
  weekStart,
  type LocalDate,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { DietWeekPicker } from '@screens/diet/DietWeekPicker';
import { ClassCard } from '@screens/student/ClassCard';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { missing } from '@utils/plural';

/**
 * Aulas (student), for the modality picked in the Início header: the days of
 * the week (today selected), the classes of the chosen day with the row of
 * classmates (check-in only today), then the progress: belt and the bar to
 * the next one (modalities with belts) or the total and the next milestone.
 */
export function ClassesScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const { selected, modalities, isLoading: modalitiesLoading } = useActiveModality();
  const belts = useBelts(academyId);
  const stats = useMemberStats(academyId);
  const modalityStats = useModalityStats(academyId);
  const [monday, setMonday] = useState<LocalDate | null>(null);
  const [picked, setPicked] = useState<LocalDate | null>(null);

  const queries = [today, schedules, checkins, belts, stats, modalityStats];
  const loading = modalitiesLoading || queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);

  if (loading || failed || !today.data || !academyId || !userId) {
    return (
      <Screen nativeHeader title="Aulas" bottomInset={false}>
        {failed ? (
          <EmptyState
            visual="icon"
            icon="offline"
            title="Não foi possível carregar as aulas"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
          />
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }

  const week = monday ?? weekStart(today.data);
  const date = picked ?? today.data;
  const own = stats.data?.find((s) => s.userId === userId);
  const ownModalities = (modalityStats.data ?? []).filter((s) => s.userId === userId);
  const modalitySchedules = (schedules.data ?? []).filter((s) => s.active && s.modalityId === selected?.id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const withClasses = new Set(days.filter((d) => classesOn(modalitySchedules, d).length > 0));
  const classes = classesOn(modalitySchedules, date);

  return (
    <Screen nativeHeader title="Aulas" bottomInset={false}>
      <Box gap="s24">
        <DietWeekPicker
          monday={week}
          selected={date}
          today={today.data}
          marked={withClasses}
          unmarkedLabel="sem aulas"
          onSelect={setPicked}
          onChangeWeek={(next) => {
            setMonday(next);
            setPicked(next <= today.data! && today.data! <= addDays(next, 6) ? today.data! : next);
          }}
        />

        <Box gap="s12">
          {classes.length === 0 ? (
            <Text variant="body" color="textMuted">
              {date === today.data ? 'Sem aulas hoje.' : 'Sem aulas neste dia.'}
            </Text>
          ) : (
            classes.map((schedule) => (
              <ClassCard
                key={schedule.id}
                academyId={academyId}
                userId={userId}
                today={today.data!}
                date={date}
                schedule={schedule}
                checkin={(checkins.data ?? []).find((c) => c.scheduleId === schedule.id && c.classDate === date)}
              />
            ))
          )}
        </Box>

        {selected ? (
          <ModalityProgress
            key={selected.id}
            modality={selected}
            belts={beltsOf(belts.data ?? [], selected.id)}
            stats={ownModalities.find((s) => s.modalityId === selected.id)}
            overallTotal={own?.confirmedTotal ?? 0}
            showOverall={modalities.length > 1}
          />
        ) : (
          <Card>
            <BigCounter value={own?.confirmedTotal ?? 0} label="Aulas confirmadas" />
          </Card>
        )}
      </Box>
    </Screen>
  );
}

const aulas = (n: number) => `${n} ${n === 1 ? 'aula' : 'aulas'}`;

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
    <Text variant="caption">{`Total geral: ${aulas(overallTotal)} em todas as modalidades`}</Text>
  ) : null;

  // Without belts: the class count of the modality and the next milestone.
  if (!modality.usesBelts) {
    const milestone = nextClassMilestone(modalityTotal);
    return (
      <Card gap="s16">
        <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
        <ProgressBar
          value={modalityTotal}
          max={milestone}
          unit="aulas"
          label={`${missing(milestone - modalityTotal, 'aula', 'aulas')} para ${milestone} aulas`}
        />
        {overall}
      </Card>
    );
  }

  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);

  return (
    <Card gap="s16" onPress={() => router.push('/graduacao')} accessibilityLabel={`Trilha de graduação de ${modality.name}. Abrir`}>
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
  );
}
