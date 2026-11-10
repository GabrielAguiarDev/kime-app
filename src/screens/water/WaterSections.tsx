import { router } from 'expo-router';

import { Box, Card, Icon, Text, TextButton } from '@components';
import { addDays, WEEKDAY_LABELS, weekdayOf, type LocalDate } from '@domain/Classes';
import { planInForce, useWaterPlans } from '@domain/Competition';
import { useMyProfile } from '@domain/Profile';
import { autoDailyGoalMl, waterDayState, type WaterDayTotal } from '@domain/Water';
import { WaterPlanWeek } from '@screens/competition/shared';
import { useAppTheme } from '@theme';

import { formatMl } from './format';

/** Height of the tallest bar (a day at 100 % of its goal or more). */
const BAR_MAX = 96;

/** Last 7 days in simple bars (share of each day's goal); days met in `water`. */
export function LastDaysBars({ days, today }: { days: WaterDayTotal[]; today: LocalDate }) {
  const theme = useAppTheme();
  const byDay = new Map(days.map((d) => [d.day, d]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Últimos 7 dias</Text>
      <Card flexDirection="row" alignItems="flex-end" justifyContent="space-between" gap="s8">
        {week.map((d) => {
          const row = byDay.get(d);
          const total = row?.totalMl ?? 0;
          const goal = row?.goalMl ?? null;
          const state = waterDayState(total, goal, row?.isLimit);
          const share = goal ? Math.min(1, total / goal) : total > 0 ? 0.5 : 0;
          const done = state === 'done';
          return (
            <Box
              key={d}
              flex={1}
              alignItems="center"
              gap="s4"
              accessible
              accessibilityLabel={`${WEEKDAY_LABELS[weekdayOf(d)].long}: ${formatMl(total)} ml${done ? ', meta cumprida' : ''}`}
            >
              <Box height={BAR_MAX} justifyContent="flex-end" width="100%" alignItems="center">
                <Box
                  width="70%"
                  style={{ height: Math.max(theme.spacing.s4, share * BAR_MAX), borderRadius: theme.spacing.s4 }}
                  backgroundColor={done ? 'water' : state === 'over' ? 'warning' : 'border'}
                />
              </Box>
              {done ? <Icon name="done" color="water" size={theme.size.iconInline * 0.8} /> : <Box height={theme.size.iconInline * 0.8} />}
              <Text variant="caption" color={d === today ? 'accent' : 'textMuted'}>
                {WEEKDAY_LABELS[weekdayOf(d)].short.charAt(0)}
              </Text>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}

/** Competitor: the professor's water plan of the week (today highlighted). */
export function CompetitorWater({ userId, today }: { userId: string; today: LocalDate }) {
  const plans = useWaterPlans(userId);
  const profile = useMyProfile(userId);
  return (
    <Box gap="s24">
      <Box gap="s12">
        <Text variant="captionCaps">Plano de água da semana</Text>
        <WaterPlanWeek
          plan={planInForce(plans.data ?? [], today)}
          today={today}
          autoGoalMl={autoDailyGoalMl(profile.data?.weightKg)}
        />
      </Box>
    </Box>
  );
}

/** "Adicionar widget" at the end of Água. */
export function AddWidgetLink() {
  return <TextButton title="Adicionar widget" icon="device" onPress={() => router.push('/agua/widget')} />;
}
