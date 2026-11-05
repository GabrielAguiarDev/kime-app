import { useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';

import { Avatar, BeltChip, BottomSheet, Box, Button, Card, PersonRow, StatusBadge, Text, TextButton } from '@components';
import {
  addDays,
  classesOn,
  useCancelCheckin,
  useClassAttendees,
  useCheckIn,
  WEEKDAY_LABELS,
  weekdayOf,
  type Checkin,
  type ClassSchedule,
  type LocalDate,
  type BeltColorKey,
} from '@domain/Classes';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';

interface TodayClassesProps {
  academyId: string;
  userId: string;
  today: LocalDate;
  schedules: ClassSchedule[];
  checkins: Checkin[];
}

/** Today's classes with the check-in action (only on the class day, server-enforced). */
export function TodayClasses({ academyId, userId, today, schedules, checkins }: TodayClassesProps) {
  const classes = classesOn(schedules, today);

  if (classes.length === 0) {
    const next = nextClassDay(schedules, today);
    return (
      <Box gap="s4">
        <Text variant="captionCaps">Hoje</Text>
        <Text variant="body">Sem aulas hoje.</Text>
        {next ? (
          <Text variant="body" color="textMuted">
            {`Próxima: ${WEEKDAY_LABELS[weekdayOf(next.date)].long}, ${next.schedule.startTime} · ${next.schedule.modality}`}
          </Text>
        ) : null}
      </Box>
    );
  }

  return (
    <Box gap="s12">
      <Text variant="captionCaps">{classes.length > 1 ? 'Aulas de hoje' : 'Aula de hoje'}</Text>
      {classes.map((schedule) => (
        <ClassCard
          key={schedule.id}
          academyId={academyId}
          userId={userId}
          today={today}
          schedule={schedule}
          checkin={checkins.find((c) => c.scheduleId === schedule.id && c.classDate === today)}
        />
      ))}
    </Box>
  );
}

function ClassCard({
  academyId,
  userId,
  today,
  schedule,
  checkin,
}: {
  academyId: string;
  userId: string;
  today: LocalDate;
  schedule: ClassSchedule;
  checkin: Checkin | undefined;
}) {
  const checkIn = useCheckIn(academyId, userId);
  const attendees = useClassAttendees(schedule.id, today);
  const [open, setOpen] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const people = attendees.data ?? [];
  const cancel = useCancelCheckin(academyId, userId);
  const confirm = useConfirm();
  const error = checkIn.error ?? cancel.error;

  const askCancel = async () => {
    if (!checkin) return;
    const ok = await confirm({
      title: 'Cancelar check-in?',
      message: 'O professor deixa de ver seu check-in nesta aula.',
      confirmLabel: 'Cancelar check-in',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (ok) cancel.mutate(checkin.id);
  };

  return (
    <>
    <Card gap="s12" onPress={() => setOpen(true)} accessibilityLabel={`Detalhes da aula ${schedule.modality} às ${schedule.startTime}`}>
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Box flex={1} gap="s4">
          <Text variant="heading">{schedule.startTime}</Text>
          <Text variant="body" color="textMuted">
            {schedule.modality}
          </Text>
        </Box>
        {/* TODO(motion): badge changing from pending to confirmed. */}
        {checkin ? <StatusBadge status={checkin.status} /> : null}
      </Box>
      <Box flexDirection="row" alignItems="center" gap="s8">
        {people.length ? <Box flexDirection="row" alignItems="center">{people.slice(0, 4).map((person, index) => (
          <Box key={person.user_id} style={{ marginLeft: index ? -10 : 0 }}><Avatar name={person.full_name} path={person.avatar_path} size={32} /></Box>
        ))}</Box> : null}
        {people.length > 4 ? <Text variant="caption">+{people.length - 4}</Text> : null}
        <Text variant="caption">{people.length ? `${people.length} ${people.length === 1 ? 'vai' : 'vão'} treinar` : 'Seja o primeiro a fazer check-in.'}</Text>
      </Box>
      {!checkin ? (
        <Button
          title="Fazer check-in"
          loading={checkIn.isPending}
          onPress={() => checkIn.mutate({ scheduleId: schedule.id, date: today })}
        />
      ) : null}
      {checkin?.status === 'pending' ? (
        cancel.isPending ? (
          <ActivityIndicator accessibilityLabel="Cancelando" />
        ) : (
          <TextButton title="Cancelar check-in" color="danger" onPress={askCancel} />
        )
      ) : null}
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </Card>
    <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
      <Box gap="s16">
        <Text variant="heading">{schedule.startTime} · {schedule.modality}</Text>
        <Text variant="caption">{today}</Text>
        {!checkin ? <Button title="Fazer check-in" loading={checkIn.isPending} onPress={() => checkIn.mutate({ scheduleId: schedule.id, date: today })} /> :
          <Box gap="s8"><StatusBadge status={checkin.status} />{checkin.status === 'pending' ? <TextButton title="Cancelar check-in" onPress={askCancel} /> : null}</Box>}
        <Text variant="captionCaps">Quem vai</Text>
        <ScrollView style={{ maxHeight: windowHeight * 0.45 }}><Card>{people.map((person, index) => <PersonRow key={person.user_id} last={index === people.length - 1} name={person.user_id === userId ? 'Você' : person.full_name}
          avatarPath={person.avatar_path} secondary={<Box flexDirection="row" alignItems="center" gap="s8">{person.belt_primary ? <BeltChip belt={{ primary: person.belt_primary as BeltColorKey, tip: person.belt_tip as BeltColorKey | null }} /> : null}{person.status === 'pending' ? <StatusBadge status="pending" /> : null}</Box>} />)}</Card></ScrollView>
        {!people.length ? <Text variant="caption">Seja o primeiro a fazer check-in.</Text> : null}
      </Box>
    </BottomSheet>
    </>
  );
}

function nextClassDay(schedules: ClassSchedule[], today: LocalDate) {
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const [first] = classesOn(schedules, date);
    if (first) return { date, schedule: first };
  }
  return null;
}
