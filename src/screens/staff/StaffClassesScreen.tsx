import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Card, EmptyState, HeaderButton, Icon, LoadError, Screen, StatusBadge, Text } from '@components';
import {
  addDays,
  attendanceCounts,
  classesOn,
  useAcademyCheckins,
  useAcademyToday,
  useModalities,
  useSchedules,
  weekStart,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { DietWeekPicker } from '@screens/diet/DietWeekPicker';
import { useActiveGym } from '@services/activeGym';

import { ModalityFilter } from './ModalityFilter';

/**
 * Aulas (staff): days of the week on top (today selected), the classes of the
 * chosen day with confirmed / pending counts, filtered by modality ("Todas"
 * by default); a class opens its attendance list. The owner manages the
 * schedules from the header.
 */
export function StaffClassesScreen() {
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const modalities = useModalities(academyId);
  const [modality, setModality] = useState<string | null>(null);
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const [monday, setMonday] = useState<LocalDate | null>(null);

  const date = picked ?? today.data;
  const week = monday ?? (today.data ? weekStart(today.data) : undefined);
  const checkins = useAcademyCheckins(academyId, date);

  const headerRight = isOwner ? (
    <HeaderButton icon="settings" accessibilityLabel="Horários das aulas" onPress={() => router.push('/academy/schedules')} />
  ) : undefined;

  if (!academyId) return null;
  if (today.isError || schedules.isError) {
    return (
      <Screen nativeHeader title="Aulas" bottomInset={false} headerRight={headerRight}>
        <LoadError
          title="Não foi possível carregar as aulas"
          onRetry={() => {
            void today.refetch();
            void schedules.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!date || !week || !today.data || !schedules.data) {
    return (
      <Screen nativeHeader title="Aulas" bottomInset={false} headerRight={headerRight}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  const all = modality ? schedules.data.filter((s) => s.modalityId === modality) : schedules.data;
  const classes = classesOn(all, date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const withClasses = new Set(days.filter((d) => classesOn(all, d).length > 0));

  return (
    <Screen nativeHeader title="Aulas" bottomInset={false} headerRight={headerRight}>
      <Box gap="s24">
        <ModalityFilter modalities={modalities.data ?? []} value={modality} onChange={setModality} />

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
          <Text variant="captionCaps">{date === today.data ? 'Hoje' : formatLocalDate(date)}</Text>
          {schedules.data.length === 0 ? (
            <EmptyState
              visual="icon"
              icon="calendar"
              title="Nenhum horário cadastrado."
              description={isOwner ? 'Cadastre as aulas no botão do topo.' : 'O proprietário cadastra os horários.'}
            />
          ) : classes.length === 0 ? (
            <Text variant="body" color="textMuted">
              {modality ? 'Nenhuma aula desta modalidade neste dia.' : 'Nenhuma aula neste dia.'}
            </Text>
          ) : null}
          {checkins.isLoading ? <ActivityIndicator /> : null}
          {classes.map((c) => (
            <ClassRow
              key={c.id}
              schedule={c}
              date={date}
              future={date > today.data!}
              counts={attendanceCounts(checkins.data ?? [], c.id)}
            />
          ))}
        </Box>
      </Box>
    </Screen>
  );
}

function ClassRow({
  schedule,
  date,
  future,
  counts,
}: {
  schedule: ClassSchedule;
  date: LocalDate;
  future: boolean;
  counts: { confirmed: number; pending: number };
}) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/presenca', params: { schedule: schedule.id, date } })}
      accessibilityLabel={`${schedule.startTime}, ${schedule.modality}. ${counts.confirmed} confirmados, ${counts.pending} pendentes. Abrir lista de presença`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Text variant="counter">{schedule.startTime}</Text>
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{schedule.modality}</Text>
        {future ? (
          <Text variant="caption">Ainda não aconteceu</Text>
        ) : (
          <Box flexDirection="row" alignItems="center" gap="s8">
            <Text variant="caption">
              {counts.confirmed} {counts.confirmed === 1 ? 'confirmado' : 'confirmados'}
            </Text>
            {counts.pending > 0 ? (
              <StatusBadge status="pending" label={counts.pending === 1 ? '1 pendente' : `${counts.pending} pendentes`} />
            ) : null}
          </Box>
        )}
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
