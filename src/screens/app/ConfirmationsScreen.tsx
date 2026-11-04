import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, EmptyState, Screen, StatusBadge, Text } from '@components';
import {
  classesOn,
  useAcademyCheckins,
  useAcademyToday,
  useConfirmAll,
  useDecideCheckin,
  useSchedules,
  type AcademyCheckin,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import { roleLabel, useDecideMembership, usePendingRequests, type PendingRequest } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

/** Professor inbox: today's class check-ins, then join requests. */
export function ConfirmationsScreen() {
  const { active } = useActiveGym();
  const requests = usePendingRequests(active?.gymId);
  const today = useAcademyToday(active?.gymId);
  const schedules = useSchedules(active?.gymId);
  const checkins = useAcademyCheckins(active?.gymId, today.data);

  if (!active) return null;

  const groups = today.data ? groupByClass(schedules.data ?? [], checkins.data ?? [], today.data) : [];
  const pendingCheckins = (checkins.data ?? []).filter((c) => c.status === 'pending').length;
  const pendingRequests = requests.data?.length ?? 0;
  const loaded = !!checkins.data && !!requests.data && !!schedules.data;
  const allClear = loaded && pendingCheckins === 0 && pendingRequests === 0;
  const checkinsLoading = today.isLoading || schedules.isLoading || checkins.isLoading;
  const checkinsError = today.isError || schedules.isError || checkins.isError;

  return (
    <Screen title="Confirmações" bottomInset={false}>
      {allClear ? (
        <EmptyState title="Tudo em dia." description="Nenhum check-in ou pedido pendente." />
      ) : null}

      {!allClear ? (
        <Box gap="s32">
          <Box gap="s12">
            <Text variant="captionCaps">Check-ins de hoje</Text>
            {checkinsLoading ? <ActivityIndicator /> : null}
            {checkinsError ? (
              <EmptyState
                visual="icon"
                icon="offline"
                title="Não foi possível carregar os check-ins"
                action={
                  <Button
                    title="Tentar de novo"
                    variant="secondary"
                    onPress={() => {
                      today.refetch();
                      schedules.refetch();
                      checkins.refetch();
                    }}
                  />
                }
              />
            ) : null}
            {!checkinsLoading && !checkinsError && groups.length === 0 ? (
              <Text variant="body" color="textMuted">
                Nenhuma aula hoje.
              </Text>
            ) : null}
            {groups.map((group) => (
              <ClassCheckinsCard key={group.scheduleId ?? 'deleted'} group={group} academyId={active.gymId} date={today.data!} />
            ))}
          </Box>

          <Box gap="s12">
            <Text variant="captionCaps">Pedidos de entrada</Text>
            {requests.isLoading ? <ActivityIndicator /> : null}
            {requests.isError ? (
              <EmptyState
                visual="icon"
                icon="offline"
                title="Não foi possível carregar os pedidos"
                action={<Button title="Tentar de novo" variant="secondary" onPress={() => requests.refetch()} />}
              />
            ) : null}
            {requests.data?.length === 0 ? (
              <Text variant="body" color="textMuted">
                Nenhum pedido pendente.
              </Text>
            ) : null}
            {requests.data?.map((request) => (
              <RequestCard key={request.membershipId} request={request} />
            ))}
          </Box>
        </Box>
      ) : null}
    </Screen>
  );
}

interface ClassGroup {
  /** Null when the class schedule was deleted after the check-ins were made. */
  scheduleId: string | null;
  /** Null when the class is no longer in today's active list (edited / deactivated / deleted). */
  schedule: ClassSchedule | null;
  checkins: AcademyCheckin[];
}

/** Today's classes in order, plus any class that still has check-ins today. */
function groupByClass(schedules: ClassSchedule[], checkins: AcademyCheckin[], today: LocalDate): ClassGroup[] {
  const groups: ClassGroup[] = classesOn(schedules, today).map((schedule) => ({
    scheduleId: schedule.id,
    schedule,
    checkins: checkins.filter((c) => c.scheduleId === schedule.id),
  }));
  for (const c of checkins) {
    if (groups.some((g) => g.scheduleId === c.scheduleId)) continue;
    groups.push({
      scheduleId: c.scheduleId,
      schedule: schedules.find((s) => s.id === c.scheduleId) ?? null,
      checkins: checkins.filter((k) => k.scheduleId === c.scheduleId),
    });
  }
  return groups;
}

function ClassCheckinsCard({ group, academyId, date }: { group: ClassGroup; academyId: string; date: LocalDate }) {
  const confirmAll = useConfirmAll(academyId);
  const pending = group.checkins.filter((c) => c.status === 'pending');

  return (
    <Card gap="s12">
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Text variant="counter">{group.schedule?.startTime ?? '--:--'}</Text>
        <Text variant="heading" flex={1}>
          {group.schedule?.modality ?? 'Aula'}
        </Text>
      </Box>
      {group.checkins.length === 0 ? (
        <Text variant="caption">Nenhum check-in ainda.</Text>
      ) : null}
      {group.checkins.map((checkin) => (
        <CheckinRow key={checkin.id} checkin={checkin} academyId={academyId} />
      ))}
      {/* A deleted class has no schedule to confirm by: confirm each row instead. */}
      {pending.length > 1 && group.scheduleId ? (
        <Button
          title={`Confirmar todos (${pending.length})`}
          loading={confirmAll.isPending}
          onPress={() =>
            confirmAll.mutate(
              { scheduleId: group.scheduleId!, date },
              {
                onSuccess: () => haptics.success(),
                onError: (e) => Alert.alert('Check-ins', errorMessage(e)),
              },
            )
          }
        />
      ) : null}
    </Card>
  );
}

function CheckinRow({ checkin, academyId }: { checkin: AcademyCheckin; academyId: string }) {
  const decide = useDecideCheckin(academyId);

  const run = (status: 'confirmed' | 'rejected') =>
    decide.mutate(
      { id: checkin.id, status },
      {
        onSuccess: () => {
          if (status === 'confirmed') haptics.success();
        },
        onError: (e) => Alert.alert('Check-in', errorMessage(e)),
      },
    );

  if (checkin.status !== 'pending') {
    return (
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Text variant="bodyStrong" flex={1}>
          {checkin.fullName}
        </Text>
        <StatusBadge status={checkin.status} />
      </Box>
    );
  }

  return (
    <Box gap="s8">
      <Text variant="bodyStrong">{checkin.fullName}</Text>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button title="Recusar" variant="secondary" disabled={decide.isPending} onPress={() => run('rejected')} />
        </Box>
        <Box flex={1}>
          <Button title="Confirmar" loading={decide.isPending} onPress={() => run('confirmed')} />
        </Box>
      </Box>
    </Box>
  );
}

function RequestCard({ request }: { request: PendingRequest }) {
  const decide = useDecideMembership();
  const confirm = useConfirm();

  const run = (approve: boolean) =>
    decide.mutate(
      { membershipId: request.membershipId, approve },
      {
        onSuccess: () => {
          if (approve) haptics.success();
        },
        onError: (e) => Alert.alert('Pedido', errorMessage(e)),
      },
    );

  const confirmApprove = async () => {
    if (request.role !== 'professor') return run(true);
    const ok = await confirm({
      title: 'Aprovar professor?',
      message: `${request.fullName} poderá confirmar check-ins, aprovar alunos, cuidar dos horários e das faixas.`,
      confirmLabel: 'Aprovar',
    });
    if (ok) run(true);
  };

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">{request.fullName}</Text>
        <Text variant="caption">{request.email}</Text>
        <Text variant="captionCaps" color={request.role === 'student' ? 'textMuted' : 'text'}>
          Quer entrar como {roleLabel[request.role].toLowerCase()}
        </Text>
      </Box>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button title="Recusar" variant="secondary" disabled={decide.isPending} onPress={() => run(false)} />
        </Box>
        <Box flex={1}>
          <Button title="Aprovar" variant="primary" loading={decide.isPending} onPress={confirmApprove} />
        </Box>
      </Box>
    </Card>
  );
}
