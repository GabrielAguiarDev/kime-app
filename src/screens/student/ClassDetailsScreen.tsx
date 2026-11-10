import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList } from 'react-native';

import { BeltChip, Box, Button, EmptyState, LoadError, PersonRow, Screen, StatusBadge, Text, TextButton } from '@components';
import { useAcademyToday, useSchedules, useMyCheckins, useClassAttendees, useCheckIn, useCancelCheckin, type BeltColorKey } from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { useConfirm } from '@services/confirm';
import { useOpenPerson } from '@screens/team/useOpenPerson';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function ClassDetailsScreen() {
  const { scheduleId = '', date = '' } = useLocalSearchParams<{ scheduleId: string; date: string }>();
  const { userId } = useSession();
  const openPerson = useOpenPerson();
  const theme = useAppTheme();
  const { active } = useActiveGym();
  const today = useAcademyToday(active?.gymId);
  const schedules = useSchedules(active?.gymId);
  const checkins = useMyCheckins(active?.gymId, userId);
  const schedule = schedules.data?.find((s) => s.id === scheduleId);
  const attendees = useClassAttendees(scheduleId, date, !!today.data && date >= today.data);
  const checkIn = useCheckIn(active?.gymId ?? '', userId ?? '');
  const cancel = useCancelCheckin(active?.gymId ?? '', userId ?? '');
  const confirm = useConfirm();
  const own = checkins.data?.find((c) => c.scheduleId === scheduleId && c.classDate === date);
  const isToday = date === today.data;
  const people = attendees.data ?? [];
  const cancelOwn = async () => {
    if (own && await confirm({ title: 'Cancelar check-in?', message: 'O professor deixa de ver seu check-in nesta aula.', confirmLabel: 'Cancelar check-in', cancelLabel: 'Manter', tone: 'danger' })) cancel.mutate(own.id);
  };
  const loading = today.isLoading || schedules.isLoading || checkins.isLoading;
  const failed = today.isError || schedules.isError || checkins.isError;

  return (
    <Screen nativeHeader title="Aula" onBack={back} scrollable={false}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando aula" /> : failed ? (
        <LoadError title="Não foi possível carregar a aula" onRetry={() => { void today.refetch(); void schedules.refetch(); void checkins.refetch(); }} />
      ) : !schedule || !date ? <EmptyState title="Aula não encontrada." /> : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: theme.colors.bg }}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.screenMargin, paddingBottom: theme.spacing.s24 }}
          data={people}
          keyExtractor={(person) => person.user_id}
          ListHeaderComponent={
            <Box gap="s16" paddingBottom="s16">
              <Text variant="heading">{schedule.startTime} · {schedule.modality}</Text>
              <Text variant="caption">{isToday ? 'Hoje' : formatLocalDate(date)}</Text>
              {own ? <StatusBadge status={own.status} /> : null}
              {isToday && !own ? <Button title="Fazer check-in" loading={checkIn.isPending} onPress={() => checkIn.mutate({ scheduleId, date })} /> : null}
              {isToday && own?.status === 'pending' ? <TextButton title="Cancelar check-in" color="danger" disabled={cancel.isPending} onPress={cancelOwn} /> : null}
              {checkIn.error || cancel.error ? <Text variant="caption" color="danger">{errorMessage(checkIn.error ?? cancel.error)}</Text> : null}
            </Box>
          }
          // One surface container for the whole list (thin dividers, no card per person).
          renderItem={({ item, index }) => {
            const first = index === 0;
            const last = index === people.length - 1;
            return (
              <Box
                backgroundColor="surface"
                borderColor="border"
                borderLeftWidth={theme.border.width}
                borderRightWidth={theme.border.width}
                borderTopWidth={first ? theme.border.width : 0}
                borderBottomWidth={last ? theme.border.width : 0}
                borderTopLeftRadius={first ? 'lg' : undefined}
                borderTopRightRadius={first ? 'lg' : undefined}
                borderBottomLeftRadius={last ? 'lg' : undefined}
                borderBottomRightRadius={last ? 'lg' : undefined}
                paddingHorizontal="s16"
              >
                <PersonRow name={item.user_id === userId ? `${item.full_name} (você)` : item.full_name} avatarPath={item.avatar_path} last={last} onPress={openPerson(item.user_id)} secondary={
                  <Box flexDirection="row" alignItems="center" gap="s8">
                    {item.belt_primary ? <BeltChip belt={{ primary: item.belt_primary as BeltColorKey, tip: item.belt_tip as BeltColorKey | null }} /> : null}
                    {item.status === 'pending' ? <StatusBadge status="pending" /> : null}
                  </Box>
                } />
              </Box>
            );
          }}
          ListEmptyComponent={
            <Box justifyContent="center" alignItems="center" paddingVertical="s32">
              {attendees.isLoading ? <ActivityIndicator accessibilityLabel="Carregando alunos" /> : attendees.isError ? (
                <LoadError title="Não foi possível carregar os alunos" onRetry={() => void attendees.refetch()} />
              ) : (
                <EmptyState
                  visual="icon"
                  icon="users"
                  title="Ninguém fez check-in ainda"
                />
              )}
            </Box>
          }
        />
      )}
    </Screen>
  );
}
