import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, Screen, Text } from '@components';
import { addDays, weekdayOf, WEEKDAY_LABELS } from '@domain/Classes';
import {
  formatShortDate,
  planInForce,
  plannedMlOn,
  sortWeights,
  useAthleteWater,
  useWaterPlans,
  useWeightLogs,
} from '@domain/Competition';
import { useMyProfile } from '@domain/Profile';
import { dailyGoal, localDate } from '@domain/Water';
import { formatMl } from '@screens/water/format';

import { Section, WeightRow, WeightSummary } from './shared';
import { useAthlete } from './useAthlete';

const WATER_DAYS = 7;

/**
 * Staff: how a competitor is doing — water of the last 7 days against the
 * goal of each day (plan or automatic) and the weigh-ins. Water shows what
 * reached the server: logs still waiting on the athlete's phone are missing.
 */
export function AthleteProgressScreen() {
  const { member, isLoading, notCompetitor, back } = useAthlete();
  const athleteId = member?.userId;
  const profile = useMyProfile(athleteId);
  const water = useAthleteWater(athleteId, WATER_DAYS + 1);
  const plans = useWaterPlans(athleteId);
  const weights = useWeightLogs(athleteId);

  const title = member?.fullName ?? 'Atleta';
  const queries = [profile, water, plans, weights];

  if (isLoading || queries.some((q) => q.isLoading)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (notCompetitor || !member) {
    return (
      <Screen nativeHeader title="Atleta" onBack={back}>
        <EmptyState
          title="Este aluno não está na equipe."
          description="Peso e água só aparecem para atletas da equipe de competição."
        />
      </Screen>
    );
  }
  if (queries.some((q) => q.isError) || !profile.data) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar os dados"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
        />
      </Screen>
    );
  }

  const timeZone = profile.data.timeZone;
  const today = localDate(new Date(), timeZone);
  const totals = new Map<string, number>();
  for (const log of water.data ?? []) {
    const day = localDate(log.loggedAt, timeZone);
    totals.set(day, (totals.get(day) ?? 0) + log.amountMl);
  }
  const days = Array.from({ length: WATER_DAYS }, (_, i) => addDays(today, -i));
  const weightLogs = sortWeights(weights.data ?? []);

  return (
    <Screen nativeHeader title={title} onBack={back}>
      <Box gap="s32">
        <Section title="Água · últimos 7 dias">
          <Card gap="s12">
            {days.map((day) => {
              const total = totals.get(day) ?? 0;
              const planned = plannedMlOn(plans.data ?? [], day);
              const goal = dailyGoal({ weightKg: profile.data.weightKg, plannedMl: planned });
              // A planned limit is done between 90 % and 100 % of it (going over is not done).
              const isLimit = planned !== null && !!planInForce(plans.data ?? [], day)?.limits[weekdayOf(day)];
              const reached =
                goal.goalMl !== null &&
                (isLimit ? total >= Math.ceil(goal.goalMl * 0.9) && total <= goal.goalMl : total >= goal.goalMl);
              const label = day === today ? 'Hoje' : `${WEEKDAY_LABELS[weekdayOf(day)].short} ${formatShortDate(day)}`;
              return (
                <Box
                  key={day}
                  flexDirection="row"
                  alignItems="center"
                  gap="s12"
                  accessible
                  accessibilityLabel={`${label}: ${formatMl(total)} ml${
                    goal.goalMl
                      ? ` de ${formatMl(goal.goalMl)}${isLimit ? ' (limite)' : ''}${reached ? (isLimit ? ', dentro do limite' : ', meta batida') : ''}`
                      : ''
                  }`}
                >
                  <Text variant="body" flex={1}>
                    {label}
                  </Text>
                  <Text variant="bodyStrong">{formatMl(total)} ml</Text>
                  <Text variant="caption">
                    {goal.goalMl ? `/ ${formatMl(goal.goalMl)}${isLimit ? ' limite' : ''}` : ''}
                  </Text>
                  {reached ? <Icon name="check" color="success" /> : null}
                </Box>
              );
            })}
          </Card>
          <Text variant="caption">
            Registros feitos sem internet aparecem quando o celular do atleta sincronizar.
          </Text>
        </Section>

        <Section title="Peso">
          {weightLogs.length === 0 ? (
            <Text variant="body" color="textMuted">
              Nenhum peso registrado ainda.
            </Text>
          ) : null}
          <WeightSummary logs={weightLogs} />
          {weightLogs.map((log) => (
            <WeightRow key={log.id} log={log} />
          ))}
        </Section>
      </Box>
    </Screen>
  );
}
