import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import {
  Avatar,
  BeltChip,
  BottomSheet,
  Box,
  Button,
  EmptyState,
  HeaderButton,
  LoadError,
  PersonList,
  PersonRow,
  Screen,
  SelectionCard,
  StatusBadge,
  Text,
  TextField,
  Spinner,
} from '@components';
import {
  useAcademyCheckins,
  useAcademyToday,
  useClassSessions,
  useBelts,
  useModalityStats,
  useConfirmAll,
  useDecideCheckin,
  useMarkAttendance,
  useSchedules,
  type AcademyCheckin,
  type ClassSchedule,
  type LocalDate,
} from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { useGymMembers, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { InstructorField } from './InstructorField';
import { useOpenPerson } from '@screens/team/useOpenPerson';

/**
 * Lista de presença of one class (`?schedule=&date=`): pending check-ins on top
 * (confirm / reject, "Confirmar todos" with more than one), confirmed below,
 * "Marcar presença" for a student who forgot the check-in, and the class's
 * instructor once someone is confirmed. "Timer" in the header.
 */
export function AttendanceScreen() {
  const { schedule: scheduleId, date } = useLocalSearchParams<{ schedule: string; date: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const schedules = useSchedules(academyId);
  const checkins = useAcademyCheckins(academyId, date);
  const today = useAcademyToday(academyId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const schedule = schedules.data?.find((s) => s.id === scheduleId);
  const timerAction = schedule ? (
    <HeaderButton
      icon="timer"
      accessibilityLabel="Abrir o timer"
      onPress={() => router.navigate({ pathname: '/timer', params: { modality: schedule.modalityId } })}
    />
  ) : undefined;

  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!academyId || !scheduleId || !date) {
    return (
      <Screen nativeHeader title="Presença" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (schedules.isError || checkins.isError) {
    return (
      <Screen nativeHeader title="Presença" onBack={back}>
        <LoadError
          title="Não foi possível carregar a lista"
          onRetry={() => {
            void schedules.refetch();
            void checkins.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!schedule || !checkins.data || !today.data) {
    return (
      <Screen nativeHeader title="Presença" onBack={back}>
        {schedules.data && !schedule ? (
          <EmptyState title="Aula não encontrada." description="O horário pode ter sido removido." />
        ) : (
          <Spinner accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }

  return (
    <AttendanceList
      academyId={academyId}
      schedule={schedule}
      date={date}
      canMark={date <= today.data}
      checkins={checkins.data.filter((c) => c.scheduleId === schedule.id)}
      onBack={back}
      headerRight={timerAction}
    />
  );
}

function AttendanceList({
  academyId,
  schedule,
  date,
  canMark,
  checkins,
  onBack,
  headerRight,
}: {
  academyId: string;
  schedule: ClassSchedule;
  date: LocalDate;
  canMark: boolean;
  checkins: AcademyCheckin[];
  onBack: () => void;
  headerRight: ReactNode;
}) {
  const openPerson = useOpenPerson();
  const confirmAll = useConfirmAll(academyId);
  const sessions = useClassSessions(academyId, date);
  const members = useGymMembers(academyId);
  const modalityStats = useModalityStats(academyId);
  const belts = useBelts(academyId);
  const [marking, setMarking] = useState(false);

  const pending = checkins.filter((c) => c.status === 'pending');
  const confirmed = checkins.filter((c) => c.status === 'confirmed');
  const rejected = checkins.filter((c) => c.status === 'rejected');
  const session = (sessions.data ?? []).find((x) => x.scheduleId === schedule.id);
  const staff = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'instructor');
  const beltFor = (userId: string) => {
    const membership = members.data?.find((m) => m.userId === userId);
    const stat = modalityStats.data?.find((x) => x.membershipId === membership?.id && x.modalityId === schedule.modalityId);
    return belts.data?.find((b) => b.id === stat?.beltId) ?? null;
  };

  return (
    <Screen
      nativeHeader
      title={`${schedule.modality} · ${schedule.startTime}`}
      onBack={onBack}
      headerRight={headerRight}
      footer={canMark ? <Button title="Marcar presença" icon="plus" variant="secondary" onPress={() => setMarking(true)} /> : undefined}
    >
      <Box gap="s24">
        <Text variant="caption">{formatLocalDate(date)}</Text>
        {!canMark ? (
          <EmptyState visual="icon" icon="calendar" title="Esta aula ainda não aconteceu." />
        ) : null}

        {pending.length > 0 ? (
          <Box gap="s12">
            <Text variant="captionCaps">Pendentes ({pending.length})</Text>
            {pending.length > 1 ? (
              <Button
                title={`Confirmar todos (${pending.length})`}
                loading={confirmAll.isPending}
                onPress={() =>
                  confirmAll.mutate(
                    { scheduleId: schedule.id, date },
                    {
                      onSuccess: () => haptics.success(),
                      onError: (e) => Alert.alert('Check-ins', errorMessage(e)),
                    },
                  )
                }
              />
            ) : null}
            <PersonList>{pending.map((c, index) => <PendingRow key={c.id} checkin={c} academyId={academyId} last={index === pending.length - 1} />)}</PersonList>
          </Box>
        ) : null}

        {canMark ? (
          <Box gap="s12">
            <Text variant="captionCaps">Confirmados ({confirmed.length})</Text>
            {confirmed.length === 0 ? (
              <Text variant="body" color="textMuted">
                Ninguém confirmado ainda.
              </Text>
            ) : null}
            {confirmed.length ? <PersonList>{confirmed.map((c, index) => {
              const belt = beltFor(c.userId);
              return <PersonRow key={c.id} name={c.fullName} avatarPath={c.avatarPath} last={index === confirmed.length - 1} onPress={openPerson(c.userId)}
                secondary={belt ? <BeltChip belt={belt} /> : 'Confirmado'} />;
            })}</PersonList> : null}
          </Box>
        ) : null}

        {rejected.length > 0 ? (
          <Box gap="s12">
            <Text variant="captionCaps">Recusados ({rejected.length})</Text>
            <PersonList>
              {rejected.map((c, index) => (
                <PersonRow
                  key={c.id}
                  name={c.fullName}
                  avatarPath={c.avatarPath}
                  secondary={<StatusBadge status="rejected" />}
                  last={index === rejected.length - 1}
                  onPress={openPerson(c.userId)}
                />
              ))}
            </PersonList>
          </Box>
        ) : null}

        {session && confirmed.length > 0 ? (
          <InstructorField academyId={academyId} session={session} staff={staff} />
        ) : null}
      </Box>

      <BottomSheet visible={marking} onRequestClose={() => setMarking(false)}>
        {marking ? (
          <MarkAttendanceForm
            academyId={academyId}
            schedule={schedule}
            date={date}
            checkins={checkins}
            members={members.data ?? []}
            onDone={() => setMarking(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function PendingRow({ checkin, academyId, last }: { checkin: AcademyCheckin; academyId: string; last?: boolean }) {
  const openPerson = useOpenPerson();
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
  const confirm = useConfirm();
  const reject = async () => {
    if (await confirm({ title: `Recusar o check-in de ${checkin.fullName}?`, message: 'O check-in será recusado.', confirmLabel: 'Recusar', tone: 'danger' })) run('rejected');
  };
  return <PersonRow name={checkin.fullName} avatarPath={checkin.avatarPath} secondary="Pendente" last={last} onPress={openPerson(checkin.userId)}
    actions={[
      { icon: 'trash', label: `Recusar check-in de ${checkin.fullName}`, onPress: () => void reject(), disabled: decide.isPending },
      { icon: 'check', label: `Confirmar check-in de ${checkin.fullName}`, onPress: () => run('confirmed'), color: 'accent', disabled: decide.isPending },
    ]} />;
}

function MarkAttendanceForm({
  academyId,
  schedule,
  date,
  checkins,
  members,
  onDone,
}: {
  academyId: string;
  schedule: ClassSchedule;
  date: LocalDate;
  checkins: AcademyCheckin[];
  members: GymMember[];
  onDone: () => void;
}) {
  const { userId } = useSession();
  const mark = useMarkAttendance(academyId, userId ?? '');
  const decide = useDecideCheckin(academyId);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<GymMember | null>(null);

  // Only students with an active link to the class modality (the database
  // refuses the others), in the list and in the search.
  const listed = new Set(checkins.filter((c) => c.status !== 'rejected').map((c) => c.userId));
  const students = members.filter(
    (m) =>
      m.role === 'student' &&
      !listed.has(m.userId) &&
      m.modalities.some((l) => l.modalityId === schedule.modalityId),
  );
  const q = query.trim().toLowerCase();
  const shown = (q ? students.filter((m) => m.fullName.toLowerCase().includes(q)) : students).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
  const pending = mark.isPending || decide.isPending;

  const save = () => {
    if (!picked) return;
    const rejected = checkins.find((c) => c.userId === picked.userId && c.status === 'rejected');
    const done = {
      onSuccess: () => {
        haptics.success();
        onDone();
      },
    };
    if (rejected) decide.mutate({ id: rejected.id, status: 'confirmed' }, done);
    else mark.mutate({ scheduleId: schedule.id, date, userId: picked.userId }, done);
  };

  return (
    <SheetForm
      title="Marcar presença"
      tall
      actions={<Button title="Confirmar presença" disabled={!picked} loading={pending} onPress={save} />}
    >
      <Text variant="body" color="textMuted">
        Para quem treinou e esqueceu o check-in. A presença já entra confirmada.
      </Text>
      <TextField label="Buscar aluno" value={query} onChangeText={setQuery} placeholder="Nome" autoCorrect={false} />
      {!q ? <Text variant="captionCaps">Treinam {schedule.modality}</Text> : null}
      {shown.length === 0 ? (
        <Text variant="body" color="textMuted">
          {q ? `Nenhum aluno de ${schedule.modality} com esse nome.` : 'Ninguém desta modalidade fora da lista.'}
        </Text>
      ) : null}
      {shown.map((m) => (
        <SelectionCard
          key={m.id}
          label={m.fullName}
          leading={<Avatar name={m.fullName} path={m.avatarPath} />}
          selected={picked?.id === m.id}
          onPress={() => setPicked(m)}
        />
      ))}
      {mark.error || decide.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(mark.error ?? decide.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
