import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Box, Card, Icon, Text } from '@components';
import { addDays, nowTimeIn, WEEKDAY_LABELS, weekdayOf, weekStart, type LocalDate } from '@domain/Classes';
import type { Streak } from '@domain/Streaks';
import { useAppTheme } from '@theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Sua semana" (Duolingo-like calendar): Monday–Sunday in small circles with
 * two marks per day (confirmed class, water goal met), the classes of the
 * week against the modality's weekly goal, and both streaks. A streak at
 * risk turns the text into a friendly alert. Opens Disciplina.
 */
export function WeekCard({
  today,
  trainedDays,
  waterDoneDays,
  weeklyGoal,
  training,
  water,
  timeZone,
}: {
  today: LocalDate;
  /** Days with a confirmed class (selected modality). */
  trainedDays: Set<LocalDate>;
  /** Days with the water goal met. */
  waterDoneDays: Set<LocalDate>;
  weeklyGoal: number;
  training: Streak | null;
  water: Streak | null;
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

  const trainingRisk = late && weekdayOf(today) === 0 && !!training && training.current > 0 && !training.currentDone;
  const waterRisk = late && !!water && water.current > 0 && !water.currentDone;
  const alert = trainingRisk
    ? `Treine até domingo para manter sua disciplina de ${plural(training!.current, 'semana', 'semanas')}.`
    : waterRisk
      ? `Cumpra a água de hoje para manter sua disciplina de ${plural(water!.current, 'dia', 'dias')}.`
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
      <Text variant="bodyStrong">{`${classes} de ${plural(weeklyGoal, 'treino', 'treinos')} desta semana`}</Text>
      <Box flexDirection="row" gap="s24">
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="flame" color={training && training.current > 0 ? 'accent' : 'disabled'} active={!!training?.currentDone} />
          <Text variant="caption">{`${plural(training?.current ?? 0, 'semana', 'semanas')} de treino`}</Text>
        </Box>
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="drop" color={water && water.current > 0 ? 'water' : 'disabled'} active={!!water?.currentDone} />
          <Text variant="caption">{`${plural(water?.current ?? 0, 'dia', 'dias')} de água`}</Text>
        </Box>
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
