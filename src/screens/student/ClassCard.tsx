import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Avatar, Box, Button, Card, StatusBadge, Text, TextButton } from '@components';
import {
  useCancelCheckin,
  useCheckIn,
  useClassAttendees,
  type Checkin,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';

interface ClassCardProps {
  academyId: string;
  userId: string;
  today: LocalDate;
  /** Day of this class (check-in only today; classmates only today and later). */
  date: LocalDate;
  schedule: ClassSchedule;
  checkin: Checkin | undefined;
  /** Início highlight: big time and a line like "Começa em 2 h" / "Terça · em 3 dias". */
  highlight?: string;
}

/**
 * A class of the selected modality: time, modality, the row of classmates who
 * checked in ("7 vão treinar") and, today, the check-in (or its status).
 * A tap opens the details with everyone who is going.
 */
export function ClassCard({ academyId, userId, today, date, schedule, checkin, highlight }: ClassCardProps) {
  const isToday = date === today;
  const upcoming = date >= today;
  const checkIn = useCheckIn(academyId, userId);
  const cancel = useCancelCheckin(academyId, userId);
  const attendees = useClassAttendees(schedule.id, date, upcoming);
  const people = attendees.data ?? [];
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
  // TODO(motion): check-in button turning into the pending badge.
  const doCheckIn = () => checkIn.mutate({ scheduleId: schedule.id, date: today });

  const checkinArea = !isToday ? null : !checkin ? (
    <Button title="Fazer check-in" loading={checkIn.isPending} onPress={doCheckIn} />
  ) : checkin.status === 'pending' ? (
    cancel.isPending ? (
      <ActivityIndicator accessibilityLabel="Cancelando" />
    ) : (
      <TextButton title="Cancelar check-in" color="danger" onPress={askCancel} />
    )
  ) : null;

  return (
    <>
      <Card
        gap="s12"
        selected={!!highlight && isToday}
        onPress={() => router.push({ pathname: '/aula', params: { scheduleId: schedule.id, date } })}
        accessibilityLabel={`Detalhes da aula ${schedule.modality} às ${schedule.startTime}`}
      >
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
          <Box flex={1} gap="s4">
            <Text variant={highlight ? 'displayLg' : 'heading'}>{schedule.startTime}</Text>
            <Text variant="body" color="textMuted">
              {schedule.modality}
            </Text>
            {highlight ? (
              <Text variant="bodyStrong" color={isToday ? 'accent' : 'textMuted'}>
                {highlight}
              </Text>
            ) : null}
          </Box>
          {/* TODO(motion): badge changing from pending to confirmed. */}
          {checkin ? <StatusBadge status={checkin.status} /> : null}
        </Box>
        {upcoming ? <AttendeesRow people={people} loading={attendees.isLoading} isToday={isToday} /> : null}
        {checkinArea}
        {error ? (
          <Text variant="caption" color="danger">
            {errorMessage(error)}
          </Text>
        ) : null}
      </Card>

    </>
  );
}

type Attendee = { user_id: string; full_name: string; avatar_path: string | null };

/** Overlapping photos (up to 4) and "7 vão treinar". */
export function AttendeesRow({ people, loading, isToday }: { people: Attendee[]; loading: boolean; isToday: boolean }) {
  if (loading) return null;
  return (
    <Box flexDirection="row" alignItems="center" gap="s8">
      {people.length ? (
        <Box flexDirection="row" alignItems="center">
          {people.slice(0, 4).map((person, index) => (
            <Box key={person.user_id} style={{ marginLeft: index ? -10 : 0 }}>
              <Avatar name={person.full_name} path={person.avatar_path} size={32} />
            </Box>
          ))}
        </Box>
      ) : null}
      {people.length > 4 ? <Text variant="caption">+{people.length - 4}</Text> : null}
      <Text variant="caption">
        {people.length
          ? `${people.length} ${people.length === 1 ? 'vai' : 'vão'} treinar`
          : isToday
            ? 'Seja o primeiro a fazer check-in.'
            : 'Ninguém fez check-in ainda.'}
      </Text>
    </Box>
  );
}
