import { useState } from 'react';
import { Alert } from 'react-native';

import { BottomSheet, Box, Button, Card, Text, TextButton } from '@components';
import type { Modality } from '@domain/Classes';
import { useSetStudentModalities, useSetStudentWeeklyGoal, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { ModalitiesSheet } from '@screens/staff/ModalitiesSheet';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { GoalStepper, weeklyGoalLabel } from './GoalStepper';
import { SheetForm } from './shared';

/**
 * Staff, member detail: the student's modalities (at least one) and, per
 * modality, the weekly class goal of the ranking (the modality's goal unless
 * staff set another one for this student).
 */
export function StudentModalitiesSection({ member, modalities }: { member: GymMember; modalities: Modality[] }) {
  const setModalities = useSetStudentModalities();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [goalFor, setGoalFor] = useState<Modality | null>(null);

  const linked = modalities.flatMap((m) => {
    const link = member.modalities.find((l) => l.modalityId === m.id);
    return link ? [{ modality: m, link }] : [];
  });

  const save = async (modalityIds: string[]) => {
    const removedCompetitor = member.modalities.find((m) => m.isCompetitor && !modalityIds.includes(m.modalityId));
    if (removedCompetitor) {
      const ok = await confirm({ title: 'Tirar modalidade?', message: `${member.fullName} também sai da equipe de competição desta modalidade.`, confirmLabel: 'Tirar modalidade', tone: 'danger' });
      if (!ok) return;
    }
    setModalities.mutate(
      { membershipId: member.id, modalityIds },
      {
        onSuccess: () => {
          setEditing(false);
          haptics.success();
        },
        onError: (e) => Alert.alert('Modalidades', errorMessage(e)),
      },
    );
  };

  return (
    <Box gap="s12">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">Modalidades</Text>
        <TextButton title="Alterar" onPress={() => setEditing(true)} />
      </Box>
      {linked.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhuma modalidade.
        </Text>
      ) : null}
      {linked.map(({ modality, link }) => {
        const goal = link.weeklyClassGoal ?? modality.weeklyClassGoal;
        return (
          <Card
            key={modality.id}
            onPress={() => setGoalFor(modality)}
            accessibilityLabel={`${modality.name}, meta de ${weeklyGoalLabel(goal)}. Alterar a meta`}
            gap="s4"
          >
            <Text variant="bodyStrong">{modality.name}</Text>
            <Text variant="caption">
              Meta semanal: {weeklyGoalLabel(goal)}
              {link.weeklyClassGoal == null ? ' (da modalidade)' : ''}
            </Text>
          </Card>
        );
      })}

      <ModalitiesSheet
        visible={editing}
        title="Modalidades do aluno"
        caption="Tirar uma modalidade mantém o histórico de aulas e faixas dela."
        modalities={modalities}
        initial={linked.map((l) => l.modality.id)}
        confirmLabel="Salvar"
        loading={setModalities.isPending}
        onConfirm={save}
        onClose={() => setEditing(false)}
      />

      <BottomSheet visible={!!goalFor} onRequestClose={() => setGoalFor(null)}>
        {goalFor ? (
          <WeeklyGoalForm
            member={member}
            modality={goalFor}
            current={member.modalities.find((l) => l.modalityId === goalFor.id)?.weeklyClassGoal ?? null}
            onDone={() => setGoalFor(null)}
          />
        ) : null}
      </BottomSheet>
    </Box>
  );
}

function WeeklyGoalForm({
  member,
  modality,
  current,
  onDone,
}: {
  member: GymMember;
  modality: Modality;
  current: number | null;
  onDone: () => void;
}) {
  const setGoal = useSetStudentWeeklyGoal();
  const [value, setValue] = useState(current ?? modality.weeklyClassGoal);

  const save = (goal: number | null) =>
    setGoal.mutate(
      { membershipId: member.id, modalityId: modality.id, goal },
      {
        onSuccess: () => {
          haptics.success();
          onDone();
        },
        onError: (e) => Alert.alert('Meta semanal', errorMessage(e)),
      },
    );

  return (
    <SheetForm
      title={`Meta semanal · ${modality.name}`}
      actions={
        <>
          <Button title="Salvar" loading={setGoal.isPending} onPress={() => save(value)} />
          {current != null ? (
            <TextButton
              title={`Usar a meta da modalidade (${weeklyGoalLabel(modality.weeklyClassGoal)})`}
              disabled={setGoal.isPending}
              onPress={() => save(null)}
            />
          ) : null}
        </>
      }
    >
      <Text variant="caption">
        Aulas confirmadas por semana que contam como 100% de presença no ranking de {member.fullName}.
      </Text>
      <GoalStepper value={value} onChange={setValue} />
    </SheetForm>
  );
}
