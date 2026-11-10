import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Box, Card, Icon, Text } from '@components';
import { addDays, nowTimeIn, WEEKDAY_LABELS, weekdayOf, weekStart, type LocalDate } from '@domain/Classes';
import { weekProgressText, weeksLabel, type Discipline } from '@domain/Streaks';
import { useAppTheme } from '@theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Sua semana": Monday–Sunday in small circles with two marks per day
 * (confirmed class of the modality, water goal met), the days trained this
 * week against the days the modality's grid has classes, and the Disciplina
 * (weeks in a row + this week's progress). On Sunday evening a week not done
 * yet turns the text into a friendly alert. Opens Disciplina.
 */
export function WeekCard({
  today,
  trainedDays,
  classDays,
  discipline,
  timeZone,
}: {
  today: LocalDate;
  /** Days with a confirmed class (selected modality). */
  trainedDays: Set<LocalDate>;
  /** Days of the week with a class of the selected modality in the grid. */
  classDays: number;
  discipline: Discipline | null;
  timeZone: string | undefined;
}) {
  const theme = useAppTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const late = !!timeZone && nowTimeIn(timeZone, now) >= '18:00';
  const monday = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const classes = days.filter((d) => trainedDays.has(d)).length;
  const dot = theme.spacing.s8;

  const waterDoneDays = new Set((discipline?.days ?? []).filter((d) => d.water === 'done').map((d) => d.day));
  const current = discipline?.current ?? 0;
  const alert =
    late && weekdayOf(today) === 0 && !!discipline && current > 0 && !discipline.weekDone
      ? `Cumpra a semana hoje para manter sua disciplina de ${weeksLabel(current)}.`
      : null;

  return (
    <Card gap="s16" onPress={() => router.push('/disciplina')} accessibilityLabel="Sua semana. Ver disciplina">
      <Text variant="captionCaps">Sua semana</Text>
      {/* TODO(motion): a day's marks lighting up when the class is confirmed or the goal is met. */}
      <Box flexDirection="row" justifyContent="space-between">
        {days.map((d) => {
          const trained = trainedDays.has(d);
          const drank = waterDoneDays.has(d);
          const isToday = d === today;
          return (
            <Box
              key={d}
              alignItems="center"
              gap="s4"
              accessible
              accessibilityLabel={`${WEEKDAY_LABELS[weekdayOf(d)].long}: ${trained ? 'treinou' : 'sem treino'}, ${drank ? 'meta de água cumprida' : 'meta de água não cumprida'}`}
            >
              <Text variant="caption" color={isToday ? 'accent' : 'textMuted'}>
                {WEEKDAY_LABELS[weekdayOf(d)].short.charAt(0)}
              </Text>
              <Box
                width={theme.size.touchTarget * 0.8}
                height={theme.size.touchTarget * 0.8}
                alignItems="center"
                justifyContent="center"
                borderWidth={theme.border.width}
                borderColor={isToday ? 'accent' : 'border'}
                backgroundColor={trained ? 'accentSelected' : 'surface'}
                style={{ borderRadius: theme.size.touchTarget }}
              >
                {trained ? <Icon name="flame" color="accent" active size={theme.size.iconInline} /> : null}
              </Box>
              <Box
                width={dot}
                height={dot}
                style={{ borderRadius: dot / 2 }}
                backgroundColor={drank ? 'water' : 'border'}
              />
            </Box>
          );
        })}
      </Box>
      <Text variant="bodyStrong">{`${classes} de ${plural(classDays, 'treino', 'treinos')} desta semana`}</Text>
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Icon name="flame" color={current > 0 ? 'accent' : 'disabled'} active={!!discipline?.weekDone} />
        <Text variant="caption" flex={1}>
          {discipline ? `${weeksLabel(current)} de disciplina · ${weekProgressText(discipline)}` : `${weeksLabel(0)} de disciplina`}
        </Text>
      </Box>
      {alert ? (
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="warning" color="warning" />
          <Text variant="body" color="warning" flex={1}>
            {alert}
          </Text>
        </Box>
      ) : null}
    </Card>
  );
}
