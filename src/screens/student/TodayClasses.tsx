import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, StatusBadge, Text, TextButton } from '@components';
import {
  addDays,
  classesOn,
  useCancelCheckin,
  useCheckIn,
  WEEKDAY_LABELS,
  weekdayOf,
  type Checkin,
  type ClassSchedule,
  type LocalDate,
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
    <Card gap="s12">
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
