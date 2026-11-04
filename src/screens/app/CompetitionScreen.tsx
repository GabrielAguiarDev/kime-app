import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { BigCounter, BottomSheet, Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import {
  countdownLabel,
  daysBetween,
  formatLocalDate,
  pastChampionships,
  planInForce,
  sortWeights,
  upcomingChampionships,
  useMyChampionships,
  useRemoveCompetitor,
  useWaterPlans,
  useWeightLogs,
  type Championship,
  type WeightLog,
} from '@domain/Competition';
import { mealsOn, useDietMeals } from '@domain/Diet';
import { useMyProfile } from '@domain/Profile';
import { autoDailyGoalMl, localDate } from '@domain/Water';
import { errorMessage } from '@infra';
import { LinkRow, Section, WaterPlanWeek, WeightRow, WeightSummary } from '@screens/competition/shared';
import { MealCard } from '@screens/diet/MealCard';
import { WeightSheet } from '@screens/competition/WeightSheet';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';

/** How many weigh-ins the tab lists (the rest stays in the history). */
const WEIGHTS_SHOWN = 8;

/**
 * Competição (competitors): countdown to the next championship, the other
 * championships, the professor's water plan of the week, weight log, and
 * "Sair da equipe".
 */
export function CompetitionScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const profile = useMyProfile(userId);
  const championships = useMyChampionships(userId);
  const plans = useWaterPlans(userId);
  const weights = useWeightLogs(userId);
  const [sheet, setSheet] = useState<{ editing?: WeightLog } | null>(null);

  const queries = [profile, championships, plans, weights];
  if (queries.some((q) => q.isLoading)) {
    return (
      <Screen nativeHeader title="Competição" bottomInset={false}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (queries.some((q) => q.isError) || !profile.data || !userId || !active) {
    return (
      <Screen nativeHeader title="Competição" bottomInset={false}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar a competição"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
        />
      </Screen>
    );
  }

  const today = localDate(new Date(), profile.data.timeZone);
  const list = championships.data ?? [];
  const [next, ...upcoming] = upcomingChampionships(list, today);
  const past = pastChampionships(list, today);
  const weightLogs = sortWeights(weights.data ?? []);

  return (
    <Screen nativeHeader title="Competição" bottomInset={false}>
      <Box gap="s32">
        {next ? (
          <NextChampionship championship={next} today={today} />
        ) : (
          <EmptyState
            visual="icon"
            icon="trophy"
            title="Nenhum campeonato marcado"
            description="Quando o professor inscrever você, a contagem regressiva aparece aqui e no widget."
          />
        )}

        {upcoming.length > 0 ? (
          <Section title="Próximos campeonatos">
            {upcoming.map((c) => (
              <ChampionshipRow key={c.id} championship={c} today={today} />
            ))}
          </Section>
        ) : null}

        <TodayDiet userId={userId} today={today} />

        <Section title="Plano de água da semana">
          <WaterPlanWeek
            plan={planInForce(plans.data ?? [], today)}
            today={today}
            autoGoalMl={autoDailyGoalMl(profile.data.weightKg)}
          />
          <Text variant="caption">Dias com meta do professor substituem a meta automática, no app e no widget.</Text>
        </Section>

        <Section
          title="Peso"
          action={<TextButton title="Registrar" fullWidth={false} icon="plus" onPress={() => setSheet({})} />}
        >
          {weightLogs.length === 0 ? (
            <Text variant="body" color="textMuted">
              Registre seu peso para o professor acompanhar.
            </Text>
          ) : null}
          <WeightSummary logs={weightLogs} />
          {weightLogs.slice(0, WEIGHTS_SHOWN).map((log) => (
            <WeightRow key={log.id} log={log} onPress={() => setSheet({ editing: log })} />
          ))}
        </Section>

        {past.length > 0 ? (
          <Section title="Campeonatos anteriores">
            {past.map((c) => (
              <ChampionshipRow key={c.id} championship={c} />
            ))}
          </Section>
        ) : null}

        <LeaveTeam membershipId={active.id} gymName={active.gymName} />
      </Box>

      <BottomSheet visible={!!sheet} onRequestClose={() => setSheet(null)}>
        {sheet ? (
          <WeightSheet
            athleteId={userId}
            today={today}
            logs={weightLogs}
            editing={sheet.editing}
            onDone={() => setSheet(null)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function TodayDiet({ userId, today }: { userId: string; today: string }) {
  const meals = useDietMeals(userId, today, today);
  const ofDay = mealsOn(meals.data ?? [], today);
  return (
    <Section title="Dieta de hoje">
      {meals.isLoading ? <ActivityIndicator /> : null}
      {meals.data && ofDay.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhuma refeição para hoje.
        </Text>
      ) : null}
      {ofDay.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
      <LinkRow title="Dieta da semana" icon="diet" onPress={() => router.push('/dieta')} />
    </Section>
  );
}

function NextChampionship({ championship, today }: { championship: Championship; today: string }) {
  const days = daysBetween(today, championship.eventDate);
  return (
    <Card gap="s16" alignItems="center">
      {days === 0 ? (
        // TODO(motion): countdown reaching zero (championship day).
        <Box alignItems="center" accessible accessibilityLabel="O campeonato é hoje">
          <Text variant="displayXl" color="accent">
            HOJE
          </Text>
          <Text variant="captionCaps">Dia de campeonato</Text>
        </Box>
      ) : (
        <BigCounter value={days} label={days === 1 ? 'Dia para o campeonato' : 'Dias para o campeonato'} />
      )}
      <Box alignItems="center" gap="s4">
        <Text variant="heading" textAlign="center">
          {championship.name}
        </Text>
        <Text variant="caption" textAlign="center">
          {[formatLocalDate(championship.eventDate), championship.location || null].filter(Boolean).join(' · ')}
        </Text>
      </Box>
    </Card>
  );
}

function ChampionshipRow({ championship, today }: { championship: Championship; today?: string }) {
  const when = today ? countdownLabel(daysBetween(today, championship.eventDate)) : null;
  const details = [formatLocalDate(championship.eventDate), championship.location || null].filter(Boolean).join(' · ');
  return (
    <Card flexDirection="row" alignItems="center" gap="s12" accessible accessibilityLabel={`${championship.name}. ${details}`}>
      <Icon name="trophy" color={today ? 'accent' : 'textMuted'} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{championship.name}</Text>
        <Text variant="caption">{details}</Text>
      </Box>
      {when ? (
        <Text variant="caption" color="accent">
          {when}
        </Text>
      ) : null}
    </Card>
  );
}

function LeaveTeam({ membershipId, gymName }: { membershipId: string; gymName: string }) {
  const leave = useRemoveCompetitor();
  const confirm = useConfirm();
  const ask = async () => {
    const ok = await confirm({
      title: 'Sair da equipe de competição?',
      message: `Você deixa de ver campeonatos e planos da ${gymName}, e o professor deixa de ver seu peso e sua água. Suas inscrições em campeonatos futuros são removidas.`,
      confirmLabel: 'Sair da equipe',
      tone: 'danger',
    });
    if (!ok) return;
    leave.mutate(membershipId, {
      onSuccess: () => router.replace('/home'),
      onError: (e) => Alert.alert('Equipe de competição', errorMessage(e)),
    });
  };
  return <TextButton title="Sair da equipe" color="danger" disabled={leave.isPending} onPress={ask} />;
}
