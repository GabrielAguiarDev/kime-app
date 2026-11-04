import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import {
  BELTS,
  BeltChip,
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
  type Belt,
  type IconName,
} from '@components';
import { useBeltGoalMutations, useBeltGoals, type BeltGoal } from '@domain/Classes';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { SheetForm } from './shared';

const MAX_CLASSES = 2000;

type Editing = { mode: 'new' } | { mode: 'edit'; goal: BeltGoal };

/** Professor: belts of the academy, in order, with the classes each one requires. */
export function BeltGoalsScreen() {
  const { active } = useActiveGym();
  const goals = useBeltGoals(active?.gymId);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!active) return null;

  const list = goals.data ?? [];
  const available = (Object.keys(BELTS) as Belt[]).filter((b) => !list.some((g) => g.belt === b));
  const open = (next: Editing) => {
    setEditing(next);
    setSheetOpen(true);
  };

  return (
    <Screen
      title="Metas de faixa"
      onBack={() => router.back()}
      footer={
        <Button
          title="Adicionar faixa"
          icon="plus"
          disabled={available.length === 0}
          onPress={() => open({ mode: 'new' })}
        />
      }
    >
      <Text variant="body" color="textMuted" marginBottom="s16">
        Aulas confirmadas necessárias para cada faixa, contadas desde a última graduação do aluno.
      </Text>
      {goals.isLoading ? <ActivityIndicator /> : null}
      {goals.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar as faixas"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => goals.refetch()} />}
        />
      ) : null}
      {goals.data && list.length === 0 ? (
        <EmptyState title="Nenhuma faixa cadastrada." description="Adicione as faixas na ordem da graduação." />
      ) : null}
      <Box gap="s12">
        {list.map((goal, index) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            index={index}
            list={list}
            academyId={active.gymId}
            onEdit={() => open({ mode: 'edit', goal })}
          />
        ))}
      </Box>

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} onClosed={() => setEditing(null)}>
        {editing ? (
          <GoalForm
            key={editing.mode === 'edit' ? editing.goal.id : 'new'}
            academyId={active.gymId}
            editing={editing}
            available={available}
            nextPosition={list.length === 0 ? 0 : Math.max(...list.map((g) => g.position)) + 1}
            onDone={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function GoalRow({
  goal,
  index,
  list,
  academyId,
  onEdit,
}: {
  goal: BeltGoal;
  index: number;
  list: BeltGoal[];
  academyId: string;
  onEdit: () => void;
}) {
  const { reorder, remove } = useBeltGoalMutations(academyId);
  const confirm = useConfirm();
  const busy = reorder.isPending || remove.isPending;

  const move = (delta: -1 | 1) => {
    const ids = list.map((g) => g.id);
    const target = index + delta;
    const a = ids[index];
    const b = ids[target];
    if (a === undefined || b === undefined) return;
    ids[index] = b;
    ids[target] = a;
    reorder.mutate(ids);
  };

  const confirmRemove = async () => {
    const ok = await confirm({
      title: `Remover faixa ${BELTS[goal.belt].label.toLowerCase()}?`,
      message: 'Ela sai da trilha de graduação. Faixas já entregues aos alunos continuam no histórico deles.',
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) remove.mutate(goal.id);
  };

  const error = reorder.error ?? remove.error;

  return (
    <Card gap="s12">
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Box flex={1} gap="s4">
          <BeltChip belt={goal.belt} />
          <Text variant="bodyStrong">{goal.classesRequired} aulas</Text>
        </Box>
        <IconButton icon="arrowUp" label="Subir" disabled={index === 0 || busy} onPress={() => move(-1)} />
        <IconButton
          icon="arrowDown"
          label="Descer"
          disabled={index === list.length - 1 || busy}
          onPress={() => move(1)}
        />
      </Box>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button title="Editar" icon="edit" variant="secondary" onPress={onEdit} />
        </Box>
        <Box flex={1}>
          <TextButton title="Remover" color="danger" onPress={confirmRemove} disabled={busy} />
        </Box>
      </Box>
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </Card>
  );
}

/** Icon-only control with a 44×44 touch area (section 10). */
function IconButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { size } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color={disabled ? 'disabled' : 'accent'} />
    </Pressable>
  );
}

function GoalForm({
  academyId,
  editing,
  available,
  nextPosition,
  onDone,
}: {
  academyId: string;
  editing: Editing;
  available: Belt[];
  nextPosition: number;
  onDone: () => void;
}) {
  const initial = editing.mode === 'edit' ? editing.goal : null;
  const { create, update } = useBeltGoalMutations(academyId);
  const [belt, setBelt] = useState<Belt | null>(initial?.belt ?? null);
  const [classes, setClasses] = useState(initial ? String(initial.classesRequired) : '');
  const count = Number(classes);
  const countOk = Number.isInteger(count) && count > 0 && count <= MAX_CLASSES;
  const valid = !!belt && countOk;
  const mutation = initial ? update : create;

  const submit = () => {
    if (!valid || !belt) return;
    const options = {
      onSuccess: () => {
        haptics.success();
        onDone();
      },
    };
    if (initial) update.mutate({ id: initial.id, classesRequired: count }, options);
    else create.mutate({ belt, position: nextPosition, classesRequired: count }, options);
  };

  return (
    <SheetForm
      title={initial ? `Faixa ${BELTS[initial.belt].label.toLowerCase()}` : 'Nova faixa'}
      actions={
        <>
          <Button title="Salvar" disabled={!valid} loading={mutation.isPending} onPress={submit} />
        </>
      }
    >
      {!initial ? (
        <Box gap="s8">
          <Text variant="caption">Faixa</Text>
          {available.map((b) => (
            <SelectionCard
              key={b}
              label={BELTS[b].label}
              leading={<BeltChip belt={b} label="" />}
              selected={belt === b}
              onPress={() => setBelt(b)}
            />
          ))}
        </Box>
      ) : null}
      <TextField
        label="Aulas necessárias"
        value={classes}
        onChangeText={(t) => setClasses(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        unit="aulas"
        placeholder="120"
        errorMessage={
          classes && !countOk
            ? `Use um número entre 1 e ${MAX_CLASSES}.`
            : mutation.error
              ? errorMessage(mutation.error)
              : undefined
        }
      />
    </SheetForm>
  );
}
