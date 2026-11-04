import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, StatusBadge, Text } from '@components';
import { classesOn, useAcademyCheckins, useAcademyToday, useSchedules } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';

/** Professor home: today's classes with pending check-ins, straight to Confirmações. */
export function ProfessorHome() {
  const { active } = useActiveGym();
  const today = useAcademyToday(active?.gymId);
  const schedules = useSchedules(active?.gymId);
  const checkins = useAcademyCheckins(active?.gymId, today.data);

  if (today.isLoading || schedules.isLoading) return <ActivityIndicator />;

  if (today.isError || schedules.isError) {
    return (
      <EmptyState
        title="Não foi possível carregar as aulas de hoje."
        action={
          <Button
            title="Tentar de novo"
            variant="secondary"
            onPress={() => {
              today.refetch();
              schedules.refetch();
            }}
          />
        }
      />
    );
  }

  const all = schedules.data ?? [];
  if (all.length === 0) {
    return (
      <EmptyState
        title="Nenhum horário cadastrado."
        description="Cadastre as aulas da semana para acompanhar os check-ins."
        action={
          <Button title="Cadastrar horários" variant="secondary" onPress={() => router.push('/academy/schedules')} />
        }
      />
    );
  }

  const classes = today.data ? classesOn(all, today.data) : [];
  if (classes.length === 0) {
    return <EmptyState title="Nenhuma aula hoje." description="Os check-ins das aulas do dia aparecem aqui." />;
  }

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Aulas de hoje</Text>
      {classes.map((c) => {
        const pending = (checkins.data ?? []).filter((k) => k.scheduleId === c.id && k.status === 'pending').length;
        return (
          <Card
            key={c.id}
            onPress={() => router.navigate('/(tabs)/confirmations')}
            accessibilityLabel={`${c.startTime}, ${c.modality}, ${pending} check-ins pendentes`}
            flexDirection="row"
            alignItems="center"
            gap="s12"
          >
            <Text variant="counter">{c.startTime}</Text>
            <Box flex={1} gap="s4">
              <Text variant="bodyStrong">{c.modality}</Text>
              {pending > 0 ? (
                <StatusBadge status="pending" label={pending === 1 ? '1 pendente' : `${pending} pendentes`} />
              ) : (
                <Text variant="caption">Sem check-ins pendentes</Text>
              )}
            </Box>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        );
      })}
    </Box>
  );
}
