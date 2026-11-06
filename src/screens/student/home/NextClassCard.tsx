import { Box, Card, Text } from '@components';
import {
  daysBetweenLabel,
  nextClass,
  nowTimeIn,
  startsInLabel,
  WEEKDAY_LABELS,
  weekdayOf,
  type Checkin,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import { ClassCard } from '@screens/student/ClassCard';

/** Academy calendar (fixed, see services/reminders). */
export const ACADEMY_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Next class of the selected modality (highlight): today = big time, "Começa
 * em 2 h", the classmates and the check-in; otherwise the day and time of the
 * next one ("Terça · em 3 dias") with who already checked in.
 */
export function NextClassCard({
  academyId,
  userId,
  today,
  schedules,
  checkins,
}: {
  academyId: string;
  userId: string;
  today: LocalDate;
  schedules: ClassSchedule[];
  checkins: Checkin[];
}) {
  const next = nextClass(schedules, today, nowTimeIn(ACADEMY_TIME_ZONE));
  if (!next) {
    return (
      <Card gap="s4">
        <Text variant="captionCaps">Próxima aula</Text>
        <Text variant="body" color="textMuted">
          Nenhuma aula desta modalidade nos próximos dias.
        </Text>
      </Card>
    );
  }
  const highlight =
    next.date === today
      ? startsInLabel(next)
      : `${WEEKDAY_LABELS[weekdayOf(next.date)].long} · ${daysBetweenLabel(today, next.date)}`;
  return (
    <Box gap="s8">
      <Text variant="captionCaps">{next.date === today ? 'Aula de hoje' : 'Próxima aula'}</Text>
      <ClassCard
        academyId={academyId}
        userId={userId}
        today={today}
        date={next.date}
        schedule={next.schedule}
        checkin={checkins.find((c) => c.scheduleId === next.schedule.id && c.classDate === next.date)}
        highlight={highlight}
      />
    </Box>
  );
}
