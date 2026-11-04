import { ActivityIndicator } from 'react-native';

import { BELTS, BeltChip, BigCounter, Box, Button, Card, EmptyState, ProgressBar, Screen, Text } from '@components';
import { beltProgress, useAcademyToday, useBeltGoals, useMemberStats, useSchedules } from '@domain/Classes';
import { GraduationTrail } from '@screens/student/GraduationTrail';
import { WeekSchedule } from '@screens/student/WeekSchedule';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** Aulas (student): belt progress, graduation trail and the week's classes. */
export function ClassesScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const goals = useBeltGoals(academyId);
  const stats = useMemberStats(academyId);

  const queries = [today, schedules, goals, stats];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);

  const own = stats.data?.find((s) => s.userId === userId);
  const belt = own?.belt ?? null;
  const progress = beltProgress(goals.data ?? [], belt, own?.confirmedSinceBelt ?? 0);
  const activeSchedules = (schedules.data ?? []).filter((s) => s.active);

  return (
    <Screen title="Aulas" bottomInset={false}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
      {failed ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar as aulas"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
        />
      ) : null}
      {!loading && !failed ? (
        <Box gap="s32">
          <Card gap="s16">
            <Box flexDirection="row" alignItems="center" justifyContent="space-between">
              {belt ? <BeltChip belt={belt} /> : <Text variant="caption">Sem faixa</Text>}
            </Box>
            {progress.next ? (
              <ProgressBar
                value={progress.done}
                max={progress.required}
                unit="aulas"
                color={BELTS[progress.next.belt].color}
                label={`Até a faixa ${BELTS[progress.next.belt].label.toLowerCase()}`}
              />
            ) : (
              <Text variant="body" color="textMuted">
                {goals.data?.length
                  ? 'Você está na última faixa definida pela academia.'
                  : 'Seu professor ainda não definiu as metas de faixa.'}
              </Text>
            )}
            <BigCounter value={own?.confirmedTotal ?? 0} label="Aulas confirmadas" />
          </Card>

          {progress.next && progress.required > 0 ? (
            <Box gap="s12">
              <Text variant="captionCaps">Trilha de graduação</Text>
              <GraduationTrail required={progress.required} done={progress.done} nextBelt={progress.next.belt} />
            </Box>
          ) : null}

          <Box gap="s12">
            <Text variant="captionCaps">Horários da semana</Text>
            {activeSchedules.length === 0 ? (
              <EmptyState title="Nenhum horário cadastrado." />
            ) : today.data ? (
              <WeekSchedule schedules={activeSchedules} today={today.data} />
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Screen>
  );
}
