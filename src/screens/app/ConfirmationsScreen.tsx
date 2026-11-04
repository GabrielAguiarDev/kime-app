import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Avatar, BottomSheet, Box, Button, Card, EmptyState, Screen, SelectionCard, StatusBadge, Text, TextButton } from '@components';
import {
  classesOn,
  useAcademyCheckins,
  useAcademyToday,
  useClassSessions,
  useConfirmAll,
  useSetSessionInstructor,
  useDecideCheckin,
  useSchedules,
  type AcademyCheckin,
  type ClassSession,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import {
  roleLabel,
  useDecideMembership,
  useGymMembers,
  usePendingRequests,
  type GymMember,
  type PendingRequest,
} from '@domain/Membership';
import { SheetForm } from '@screens/professor/shared';
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
  const sessions = useClassSessions(active?.gymId, today.data);
  const members = useGymMembers(active?.gymId);

  if (!active) return null;
  // Who can be the instructor of a class: active owner and instructors.
  const staff = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'instructor');

  const groups = today.data ? groupByClass(schedules.data ?? [], checkins.data ?? [], today.data) : [];
  const pendingCheckins = (checkins.data ?? []).filter((c) => c.status === 'pending').length;
  const pendingRequests = requests.data?.length ?? 0;
  const loaded = !!checkins.data && !!requests.data && !!schedules.data;
  // Classes already given today stay listed (their instructor can still be switched).
  const givenToday = (checkins.data ?? []).some((c) => c.status === 'confirmed');
  const allClear = loaded && pendingCheckins === 0 && pendingRequests === 0 && !givenToday;
  const checkinsLoading = today.isLoading || schedules.isLoading || checkins.isLoading;
  const checkinsError = today.isError || schedules.isError || checkins.isError;

  return (
    <Screen nativeHeader title="Confirmações" bottomInset={false}>
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
              <ClassCheckinsCard
                key={group.scheduleId ?? 'deleted'}
                group={group}
                academyId={active.gymId}
                date={today.data!}
                session={(sessions.data ?? []).find((x) => x.scheduleId === group.scheduleId && !!group.scheduleId)}
                staff={staff}
              />
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

function ClassCheckinsCard({
  group,
  academyId,
  date,
  session,
  staff,
}: {
  group: ClassGroup;
  academyId: string;
  date: LocalDate;
  session: ClassSession | undefined;
  staff: GymMember[];
}) {
  const confirmAll = useConfirmAll(academyId);
  const pending = group.checkins.filter((c) => c.status === 'pending');
  // Check-ins of the class finished: who taught it (owner by default) can be switched.
  const finished = pending.length === 0 && group.checkins.some((c) => c.status === 'confirmed');

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
      {finished && session ? <InstructorField academyId={academyId} session={session} staff={staff} /> : null}
    </Card>
  );
}

/** "Professor da aula": the class's instructor, switchable among the academy's staff. */
function InstructorField({
  academyId,
  session,
  staff,
}: {
  academyId: string;
  session: ClassSession;
  staff: GymMember[];
}) {
  const setInstructor = useSetSessionInstructor(academyId);
  const [open, setOpen] = useState(false);
  const current = staff.find((m) => m.userId === session.instructorId);
  const name = current?.fullName ?? 'Sem professor';

  return (
    <Box gap="s8" paddingTop="s8">
      <Text variant="captionCaps">Professor da aula</Text>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Avatar name={name} path={current?.avatarPath} />
        <Text variant="bodyStrong" flex={1} numberOfLines={1}>
          {name}
        </Text>
        {staff.length > 1 ? (
          <TextButton
            title="Trocar"
            fullWidth={false}
            disabled={setInstructor.isPending}
            onPress={() => setOpen(true)}
            accessibilityLabel={`Trocar o professor da aula. Atual: ${name}`}
          />
        ) : null}
      </Box>
      {setInstructor.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(setInstructor.error)}
        </Text>
      ) : null}

      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        <SheetForm
          title="Professor da aula"
          actions={<Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />}
        >
          {staff.map((member) => (
            <SelectionCard
              key={member.id}
              label={member.fullName}
              description={roleLabel[member.role]}
              leading={<Avatar name={member.fullName} path={member.avatarPath} />}
              selected={member.userId === session.instructorId}
              onPress={() => {
                setOpen(false);
                if (member.userId === session.instructorId) return;
                setInstructor.mutate(
                  { sessionId: session.id, instructorId: member.userId },
                  { onSuccess: () => haptics.success() },
                );
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </Box>
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
    if (request.role !== 'instructor') return run(true);
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
