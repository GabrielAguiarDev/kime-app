import { Box, Card, Text } from '@components';
import {
  sortByTime,
  WEEK_ORDER,
  WEEKDAY_LABELS,
  weekdayOf,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';

/** Week of classes, Monday first; today's day highlighted (selected card). */
export function WeekSchedule({ schedules, today }: { schedules: ClassSchedule[]; today: LocalDate }) {
  const todayDow = weekdayOf(today);
  const days = WEEK_ORDER.map((weekday) => ({
    weekday,
    classes: sortByTime(schedules.filter((s) => s.active && s.weekday === weekday)),
  })).filter((d) => d.classes.length > 0);

  return (
    <Box gap="s12">
      {days.map(({ weekday, classes }) => {
        const isToday = weekday === todayDow;
        return (
          <Card
            key={weekday}
            selected={isToday}
            gap="s8"
            accessibilityLabel={`${WEEKDAY_LABELS[weekday].long}${isToday ? ', hoje' : ''}`}
          >
            <Text variant="heading">{isToday ? `${WEEKDAY_LABELS[weekday].long} · hoje` : WEEKDAY_LABELS[weekday].long}</Text>
            {classes.map((c) => (
              <Box key={c.id} flexDirection="row" gap="s12">
                <Text variant="bodyStrong">{c.startTime}</Text>
                <Text variant="body" color="textMuted" flex={1}>
                  {c.modality}
                </Text>
              </Box>
            ))}
          </Card>
        );
      })}
    </Box>
  );
}
