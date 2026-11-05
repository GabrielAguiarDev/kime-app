import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { BottomSheet, Box, Button, Card, EmptyState, Icon, Screen, SelectionCard, Text, TextField } from '@components';
import { beltsOf, sameModality, useBelts, useModalities, useModalityMutations, type Modality } from '@domain/Classes';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';

import { GoalStepper, weeklyGoalLabel } from './GoalStepper';
import { SheetForm } from './shared';

type ModalityEditing = { mode: 'new' } | { mode: 'edit'; modality: Modality };

/**
 * Owner (Perfil → Modalidades): the academy's modalities — add, edit (name,
 * uses belts), remove, and open each modality's belts.
 */
export function ModalitiesScreen() {
  const { active } = useActiveGym();
  if (!active) return null;
  return <ModalitiesList gymId={active.gymId} />;
}

function ModalitiesList({ gymId }: { gymId: string }) {
  const modalities = useModalities(gymId);
  const belts = useBelts(gymId);
  const mutations = useModalityMutations(gymId);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ModalityEditing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Confirmations open after the sheet is gone (one modal at a time).
  const afterClose = useRef<(() => void) | null>(null);
  const list = modalities.data ?? [];
  const { spacing, size } = useAppTheme();

  const open = (next: ModalityEditing) => {
    setEditing(next);
    setSheetOpen(true);
  };

  // From the card (no sheet open) or from the edit sheet (after it closes).
  const askDelete = (modality: Modality) => {
    const run = async () => {
      const ok = await confirm({
        title: 'Remover modalidade?',
        message: `Os alunos vinculados a esta modalidade perdem o vínculo com ela. O histórico de aulas e faixas é mantido. Só é possível remover ${modality.name} sem horários e sem graduações.`,
        confirmLabel: 'Remover',
        tone: 'danger',
      });
      if (ok) mutations.remove.mutate(modality.id);
    };
    if (!sheetOpen) {
      void run();
      return;
    }
    afterClose.current = run;
    setSheetOpen(false);
  };

  return (
    <Screen
      nativeHeader
      title="Modalidades"
      onBack={() => router.back()}
      footer={<Button title="Adicionar modalidade" icon="plus" onPress={() => open({ mode: 'new' })} />}
    >
      <Box gap="s12">
        <Text variant="body" color="textMuted">
          As modalidades que a academia ensina.
        </Text>
        {modalities.isLoading ? <ActivityIndicator /> : null}
        {modalities.isError ? (
          <EmptyState
            visual="icon"
            icon="offline"
            title="Não foi possível carregar as modalidades"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => modalities.refetch()} />}
          />
        ) : null}
        {modalities.data && list.length === 0 ? (
          <EmptyState visual="icon" icon="belt" title="Nenhuma modalidade cadastrada." />
        ) : null}
        {list.map((modality) => {
          const count = beltsOf(belts.data ?? [], modality.id).length;
          return (
            <Card key={modality.id} gap="s12">
              <Box flexDirection="row" alignItems="center" gap="s12">
                <Box flex={1} gap="s4">
                  <Text variant="bodyStrong">{modality.name}</Text>
                  <Text variant="caption">
                    {modality.usesBelts
                      ? count === 0
                        ? 'Com faixas · nenhuma cadastrada'
                        : `Com faixas · ${count} ${count === 1 ? 'faixa' : 'faixas'}`
                      : 'Sem faixas · só conta as aulas'}
                  </Text>
                  <Text variant="caption">Meta: {weeklyGoalLabel(modality.weeklyClassGoal)}</Text>
                </Box>
                <Pressable
                  onPress={() => askDelete(modality)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${modality.name}`}
                  hitSlop={spacing.s8}
                  style={{
                    width: size.touchTarget,
                    height: size.touchTarget,
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="trash" color="danger" />
                </Pressable>
              </Box>
              <Box flexDirection="row" gap="s12">
                <Box flex={1}>
                  <Button
                    title="Editar"
                    icon="edit"
                    variant="secondary"
                    onPress={() => open({ mode: 'edit', modality })}
                  />
                </Box>
                {modality.usesBelts ? (
                  <Box flex={1}>
                    <Button
                      title="Faixas"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/academy/belts', params: { modalidade: modality.id } })}
                    />
                  </Box>
                ) : null}
              </Box>
            </Card>
          );
        })}
        {mutations.remove.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(mutations.remove.error)}
          </Text>
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
            <ModalityForm
              key={editing.mode === 'edit' ? editing.modality.id : 'new'}
              gymId={gymId}
              editing={editing}
              existing={list}
              onDone={() => setSheetOpen(false)}
              onDelete={askDelete}
            />
          ) : null}
        </BottomSheet>
      </Box>
    </Screen>
  );
}

function ModalityForm({
  gymId,
  editing,
  existing,
  onDone,
  onDelete,
}: {
  gymId: string;
  editing: ModalityEditing;
  existing: Modality[];
  onDone: () => void;
  onDelete: (modality: Modality) => void;
}) {
  const current = editing.mode === 'edit' ? editing.modality : null;
  const { create, update, setWeeklyGoal } = useModalityMutations(gymId);
  const [name, setName] = useState(current?.name ?? '');
  const [usesBelts, setUsesBelts] = useState(current?.usesBelts ?? true);
  const [goal, setGoal] = useState(current?.weeklyClassGoal ?? 2);

  const trimmed = name.trim();
  const duplicate = existing.some((m) => m.id !== current?.id && sameModality(m.name, trimmed));
  const goalChanged = !!current && goal !== current.weeklyClassGoal;
  const detailsChanged = !current || trimmed !== current.name || usesBelts !== current.usesBelts;
  const changed = detailsChanged || goalChanged;
  const valid = trimmed.length >= 1 && trimmed.length <= 60 && !duplicate && changed;
  const mutation = current ? (detailsChanged ? update : setWeeklyGoal) : create;
  const options = { onSuccess: () => onDone() };

  const submit = () => {
    if (!valid) return;
    if (current) {
      const saveGoal = () =>
        goalChanged ? setWeeklyGoal.mutate({ id: current.id, goal }, options) : onDone();
      if (detailsChanged) update.mutate({ id: current.id, name: trimmed, usesBelts }, { onSuccess: saveGoal });
      else saveGoal();
    } else {
      const position = existing.length === 0 ? 0 : Math.max(...existing.map((m) => m.position)) + 1;
      create.mutate({ name: trimmed, position, usesBelts }, options);
    }
  };

  return (
    <SheetForm
      title={current ? 'Editar modalidade' : 'Nova modalidade'}
      headerAction={
        current
          ? {
              icon: 'trash',
              color: 'danger',
              accessibilityLabel: 'Remover modalidade',
              onPress: () => onDelete(current),
            }
          : undefined
      }
      actions={<Button title="Salvar" disabled={!valid} loading={mutation.isPending} onPress={submit} />}
    >
      <TextField
        label="Nome da modalidade"
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoCapitalize="words"
        autoFocus={!current}
        errorMessage={
          duplicate ? 'A academia já tem essa modalidade.' : mutation.error ? errorMessage(mutation.error) : undefined
        }
      />
      <Box gap="s8">
        <Text variant="caption">Graduação</Text>
        <SelectionCard
          label="Usa faixas"
          description="Os alunos têm faixa e trilha de graduação nesta modalidade."
          selected={usesBelts}
          onPress={() => setUsesBelts(true)}
        />
        <SelectionCard
          label="Sem faixas"
          description="Os alunos veem só o total de aulas desta modalidade."
          selected={!usesBelts}
          onPress={() => setUsesBelts(false)}
        />
      </Box>
      <Box gap="s8">
        <Text variant="caption">Meta semanal do ranking</Text>
        {current ? (
          <>
            <GoalStepper value={goal} onChange={setGoal} />
            <Text variant="caption">
              Aulas confirmadas por semana que contam como 100% de presença. Pode ser diferente para um aluno, no
              detalhe dele.
            </Text>
          </>
        ) : (
          <Text variant="caption">Começa com {weeklyGoalLabel(2)}; mude depois em Editar.</Text>
        )}
      </Box>
    </SheetForm>
  );
}
