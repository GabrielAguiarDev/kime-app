import { router } from 'expo-router';
import { useRef, useState } from 'react';

import {
  BottomSheet,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SelectionCard,
  Text,
  TextButton,
  TextField,
  Spinner,
} from '@components';
import {
  groupDisplayDays,
  groupSchedules,
  isValidTime,
  planScheduleGroup,
  useModalities,
  useScheduleMutations,
  useSchedules,
  WEEK_ORDER,
  WEEKDAY_LABELS,
  type ClassSchedule,
  type Modality,
  type ScheduleGroup,
  type Weekday,
} from '@domain/Classes';
import { roleLabel, useGymMembers } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { SheetForm } from './shared';
import { WeekdayChips } from './WeekdayChips';

type Editing = { mode: 'new' } | { mode: 'edit'; group: ScheduleGroup };

/**
 * Professor: recurring classes. One card per class group (time + modality)
 * with its weekdays; the database keeps one row per weekday (see
 * planScheduleGroup).
 */
export function SchedulesScreen() {
  const { active } = useActiveGym();
  const schedules = useSchedules(active?.gymId);
  const academyModalities = useModalities(active?.gymId);
  const mutations = useScheduleMutations(active?.gymId ?? '');
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Confirmations open after the form sheet is gone (one modal at a time).
  const afterClose = useRef<(() => void) | null>(null);

  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!active) {
    return (
      <Screen nativeHeader title="Horários das aulas" onBack={() => router.back()}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  const list = schedules.data ?? [];
  const groups = groupSchedules(list);
  const activeGroups = groups.filter((g) => g.active);
  const inactiveGroups = groups.filter((g) => !g.active);
  // The academy's registered modalities, in its order (only the owner adds them, in settings).
  const modalities = academyModalities.data ?? [];

  const open = (next: Editing) => {
    setEditing(next);
    setSheetOpen(true);
  };

  const askDeactivate = (group: ScheduleGroup) => {
    afterClose.current = async () => {
      const ok = await confirm({
        title: 'Desativar horário?',
        message: 'A aula some da lista dos alunos e não aceita check-in. Os check-ins antigos continuam contando.',
        confirmLabel: 'Desativar',
        tone: 'danger',
      });
      if (ok) {
        const ids = group.schedules.filter((s) => s.active).map((s) => s.id);
        mutations.setGroupActive.mutate({ ids, active: false });
      }
    };
    setSheetOpen(false);
  };

  const askDelete = (group: ScheduleGroup) => {
    afterClose.current = async () => {
      const ok = await confirm({
        title: 'Apagar horário?',
        message: `${group.startTime} · ${group.modality} sai da academia. Os check-ins já feitos continuam contando para os alunos.`,
        confirmLabel: 'Apagar',
        tone: 'danger',
      });
      if (ok) mutations.removeGroup.mutate(group.schedules.map((s) => s.id));
    };
    setSheetOpen(false);
  };

  const reactivate = (group: ScheduleGroup) => {
    mutations.setGroupActive.mutate(
      { ids: group.schedules.map((s) => s.id), active: true },
      { onSuccess: () => haptics.success() },
    );
    setSheetOpen(false);
  };

  return (
    <Screen nativeHeader
      title="Horários das aulas"
      onBack={() => router.back()}
      footer={<Button title="Adicionar horário" icon="plus" onPress={() => open({ mode: 'new' })} />}
    >
      {schedules.isLoading ? <Spinner /> : null}
      {schedules.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar os horários"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => schedules.refetch()} />}
        />
      ) : null}
      {schedules.data && groups.length === 0 ? (
        <EmptyState title="Nenhum horário cadastrado." description="Adicione as aulas da semana da academia." />
      ) : null}
      {mutations.setGroupActive.error || mutations.removeGroup.error ? (
        <Text variant="caption" color="danger" marginBottom="s12">
          {errorMessage(mutations.setGroupActive.error ?? mutations.removeGroup.error)}
        </Text>
      ) : null}

      <Box gap="s12">
        {activeGroups.map((group) => (
          <GroupCard key={group.key} group={group} onPress={() => open({ mode: 'edit', group })} />
        ))}
      </Box>

      {inactiveGroups.length > 0 ? (
        <Box gap="s12" marginTop="s32">
          <Text variant="captionCaps">Desativados</Text>
          {inactiveGroups.map((group) => (
            <GroupCard key={group.key} group={group} onPress={() => open({ mode: 'edit', group })} />
          ))}
        </Box>
      ) : null}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        onClosed={() => {
          setEditing(null);
          const next = afterClose.current;
          afterClose.current = null;
          next?.();
        }}
      >
        {editing ? (
          <GroupForm
            key={editing.mode === 'edit' ? editing.group.key : 'new'}
            academyId={active.gymId}
            all={list}
            editing={editing}
            modalities={modalities}
            onDone={() => setSheetOpen(false)}
            onDeactivate={askDeactivate}
            onReactivate={reactivate}
            onDelete={askDelete}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function GroupCard({ group, onPress }: { group: ScheduleGroup; onPress: () => void }) {
  const muted = !group.active;
  return (
    <Card
      onPress={onPress}
      gap="s12"
      accessibilityLabel={`${group.startTime}, ${group.modality}, ${groupDisplayDays(group)
        .map((d) => WEEKDAY_LABELS[d].long)
        .join(', ')}${muted ? ', desativado' : ''}`}
    >
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Text variant="counter" color={muted ? 'textMuted' : 'text'}>
          {group.startTime}
        </Text>
        <Text variant="bodyStrong" flex={1} numberOfLines={1} color={muted ? 'textMuted' : 'text'}>
          {group.modality}
        </Text>
        <Icon name="chevronRight" color="textMuted" />
      </Box>
      <WeekdayChips days={groupDisplayDays(group)} muted={muted} />
    </Card>
  );
}

function GroupForm({
  academyId,
  all,
  editing,
  modalities,
  onDone,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  academyId: string;
  all: ClassSchedule[];
  editing: Editing;
  modalities: Modality[];
  onDone: () => void;
  onDeactivate: (group: ScheduleGroup) => void;
  onReactivate: (group: ScheduleGroup) => void;
  onDelete: (group: ScheduleGroup) => void;
}) {
  const group = editing.mode === 'edit' ? editing.group : null;
  const { saveGroup } = useScheduleMutations(academyId);
  const { isOwner } = useActiveGym();
  const members = useGymMembers(academyId);
  // Who can give the class: active owner/instructors of the academy.
  const staff = (members.data ?? []).filter((m) => m.status === 'active' && m.role !== 'student');
  const savedInstructor = group?.schedules.find((s) => s.active)?.instructorId ?? group?.schedules[0]?.instructorId ?? null;
  const [instructorId, setInstructorId] = useState<string | null>(savedInstructor);
  const [days, setDays] = useState<Weekday[]>(group ? groupDisplayDays(group) : []);
  const [time, setTime] = useState(group?.startTime ?? '');
  const [modalityId, setModalityId] = useState<string | null>(
    group?.modalityId ?? (modalities.length === 1 ? modalities[0]!.id : null),
  );

  const timeError = time.length >= 5 && !isValidTime(time) ? 'Use o formato 24h, ex. 19:30.' : undefined;
  const valid = days.length > 0 && isValidTime(time) && !!modalityId && modalities.some((m) => m.id === modalityId);

  const toggleDay = (day: Weekday) =>
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  // Typing "1930" becomes "19:30".
  const onTimeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  };

  const submit = () => {
    if (!valid || !modalityId) return;
    const plan = planScheduleGroup(all, group?.schedules ?? [], time, modalityId, days);
    saveGroup.mutate(
      {
        plan,
        startTime: time,
        modalityId,
        // An instructor who left the academy is not offered: saving clears them.
        // Members not loaded (slow network, error): keep what was chosen.
        instructorId: !members.data || staff.some((m) => m.userId === instructorId) ? instructorId : null,
      },
      {
        onSuccess: () => {
          haptics.success();
          onDone();
        },
      },
    );
  };
  const error = saveGroup.error;

  const rows: Weekday[][] = [WEEK_ORDER.slice(0, 4), WEEK_ORDER.slice(4)];

  return (
    <SheetForm
      title={group ? 'Editar horário' : 'Novo horário'}
      headerAction={
        group
          ? { icon: 'trash', color: 'danger', accessibilityLabel: 'Apagar horário', onPress: () => onDelete(group) }
          : undefined
      }
      actions={
        <>
          <Button
            title="Salvar"
            disabled={!valid}
            loading={saveGroup.isPending}
            onPress={submit}
          />
          {group?.active ? (
            <TextButton title="Desativar horário" color="danger" onPress={() => onDeactivate(group)} />
          ) : null}
          {group && !group.active ? (
            <TextButton title="Reativar horário" onPress={() => onReactivate(group)} />
          ) : null}
        </>
      }
    >
      <TextField
        label="Horário"
        value={time}
        onChangeText={onTimeChange}
        placeholder="19:30"
        keyboardType="number-pad"
        maxLength={5}
        errorMessage={timeError}
      />

      <Box gap="s8">
        <Text variant="caption">Dias da semana</Text>
        {rows.map((row, index) => (
          <Box key={index} flexDirection="row" gap="s8">
            {row.map((day) => (
              <SelectionCard
                key={day}
                flex={1}
                label={WEEKDAY_LABELS[day].short}
                accessibilityLabel={WEEKDAY_LABELS[day].long}
                selected={days.includes(day)}
                onPress={() => toggleDay(day)}
              />
            ))}
            {/* Keep the 3 cards of the second row the same width as the first. */}
            {row.length < 4 ? <Box flex={1} /> : null}
          </Box>
        ))}
      </Box>

      <Box gap="s8">
        <Text variant="caption">Modalidade</Text>
        {modalities.length === 0 ? (
          <Text variant="body" color="textMuted">
            {isOwner
              ? 'Cadastre as modalidades em Configurações da academia.'
              : 'O proprietário ainda não cadastrou as modalidades da academia.'}
          </Text>
        ) : null}
        {modalities.map((m) => (
          <SelectionCard
            key={m.id}
            label={m.name}
            description={m.usesBelts ? 'Com faixas' : 'Sem faixas'}
            selected={modalityId === m.id}
            onPress={() => setModalityId(m.id)}
          />
        ))}
      </Box>

      <Box gap="s8">
        <Text variant="caption">Professor</Text>
        <SelectionCard label="Sem professor" selected={instructorId === null} onPress={() => setInstructorId(null)} />
        {staff.map((m) => (
          <SelectionCard
            key={m.userId}
            label={m.fullName}
            description={roleLabel[m.role]}
            selected={instructorId === m.userId}
            onPress={() => setInstructorId(m.userId)}
          />
        ))}
      </Box>

      {error ? (
        <Box flexDirection="row" gap="s8" alignItems="center">
          <Icon name="warning" color="danger" />
          <Text variant="caption" color="danger" flex={1}>
            {errorMessage(error)}
          </Text>
        </Box>
      ) : null}
    </SheetForm>
  );
}
