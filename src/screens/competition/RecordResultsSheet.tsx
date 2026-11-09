import { useState } from 'react';

import { BottomSheet, Box, Button, SelectionGrid, Text, TextButton, TextField } from '@components';
import {
  FIGHT_METHODS,
  FIGHT_NOTE_MAX,
  FIGHT_OPPONENT_MAX,
  FIGHT_RESULTS,
  FIGHT_STAGES,
  optionalText,
  PLACEMENTS,
  useResultMutations,
  type EntryResults,
  type Fight,
  type FightMethod,
  type FightResult,
  type FightStage,
} from '@domain/Competition';
import { errorMessage } from '@infra';
import { SheetForm, type SheetHeaderAction } from '@screens/professor/shared';
import { haptics } from '@utils/haptics';

import { FightRow } from './FightRecord';

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T | null) =>
  value ? (list.find((o) => o.value === value)?.label ?? null) : null;
const valueOf = <T extends string>(list: { value: T; label: string }[], label: string) =>
  list.find((o) => o.label === label)?.value ?? null;

/**
 * Staff, championship page (from the event day on): "Registrar lutas" of one
 * entered athlete — placement (saved on tap; tap again to clear) and the list
 * of fights, with "Adicionar luta" / edit / delete in the same sheet.
 */
export function RecordResultsSheet({
  entry,
  athleteName,
  onClose,
}: {
  entry: EntryResults | null;
  athleteName: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={!!entry} onRequestClose={onClose}>
      {entry ? <RecordResultsContent entry={entry} title={`Lutas de ${athleteName}`} /> : null}
    </BottomSheet>
  );
}

/**
 * Body of "Registrar lutas" (inside a sheet): placement and fights, or the
 * fight form. `headerAction` goes on the list (e.g. edit the championship).
 */
export function RecordResultsContent({
  entry,
  title,
  headerAction,
}: {
  entry: EntryResults;
  title: string;
  headerAction?: SheetHeaderAction;
}) {
  // null = the list; { fight: null } = new fight; { fight } = editing.
  const [form, setForm] = useState<{ fight: Fight | null } | null>(null);
  return form ? (
    <FightForm key={form.fight?.id ?? 'new'} entryId={entry.entryId} fight={form.fight} onDone={() => setForm(null)} />
  ) : (
    <ResultsList
      entry={entry}
      title={title}
      headerAction={headerAction}
      onAdd={() => setForm({ fight: null })}
      onEdit={(fight) => setForm({ fight })}
    />
  );
}

function ResultsList({
  entry,
  title,
  headerAction,
  onAdd,
  onEdit,
}: {
  entry: EntryResults;
  title: string;
  headerAction?: SheetHeaderAction;
  onAdd: () => void;
  onEdit: (fight: Fight) => void;
}) {
  const { setPlacement } = useResultMutations();
  const current = labelOf(PLACEMENTS, entry.placement);
  return (
    <SheetForm title={title} tall headerAction={headerAction} actions={<Button title="Adicionar luta" icon="plus" onPress={onAdd} />}>
      <Box gap="s8">
        <Text variant="captionCaps">Colocação</Text>
        <SelectionGrid
          options={PLACEMENTS.map((p) => p.label)}
          selected={current ? [current] : []}
          onToggle={(label) => {
            if (setPlacement.isPending) return;
            const next = label === current ? null : valueOf(PLACEMENTS, label);
            setPlacement.mutate({ entryId: entry.entryId, placement: next }, { onSuccess: () => haptics.success() });
          }}
        />
        {setPlacement.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(setPlacement.error)}
          </Text>
        ) : (
          <Text variant="caption">Toque de novo na colocação escolhida para limpar.</Text>
        )}
      </Box>
      <Box gap="s8">
        <Text variant="captionCaps">{`Lutas (${entry.fights.length})`}</Text>
        {entry.fights.length === 0 ? (
          <Text variant="body" color="textMuted">
            Nenhuma luta registrada. Toque em Adicionar luta.
          </Text>
        ) : (
          <Box>
            {entry.fights.map((f, i) => (
              <FightRow key={f.id} fight={f} onPress={() => onEdit(f)} last={i === entry.fights.length - 1} />
            ))}
          </Box>
        )}
      </Box>
    </SheetForm>
  );
}

function FightForm({ entryId, fight, onDone }: { entryId: string; fight: Fight | null; onDone: () => void }) {
  const { addFight, updateFight, deleteFight } = useResultMutations();
  // Delete is confirmed inside this sheet (a second sheet would stack modals).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [result, setResult] = useState<FightResult | null>(fight?.result ?? null);
  const [method, setMethod] = useState<FightMethod | null>(fight?.method ?? null);
  const [stage, setStage] = useState<FightStage | null>(fight?.stage ?? null);
  const [opponent, setOpponent] = useState(fight?.opponentName ?? '');
  const [note, setNote] = useState(fight?.note ?? '');
  const saving = addFight.isPending || updateFight.isPending || deleteFight.isPending;
  const error = addFight.error ?? updateFight.error ?? deleteFight.error;

  const save = () => {
    if (!result || !method) return;
    const input = { result, method, stage, opponentName: optionalText(opponent), note: optionalText(note) };
    const onSuccess = () => {
      haptics.success();
      onDone();
    };
    if (fight) updateFight.mutate({ id: fight.id, input }, { onSuccess });
    else addFight.mutate({ entryId, input }, { onSuccess });
  };

  const remove = () => {
    if (fight) deleteFight.mutate(fight.id, { onSuccess: onDone });
  };

  const resultLabel = labelOf(FIGHT_RESULTS, result);
  const methodLabel = labelOf(FIGHT_METHODS, method);
  const stageLabel = labelOf(FIGHT_STAGES, stage);

  return (
    <SheetForm
      title={fight ? 'Editar luta' : 'Adicionar luta'}
      tall
      headerAction={
        fight && !confirmingDelete
          ? { icon: 'trash', accessibilityLabel: 'Apagar luta', color: 'danger', onPress: () => setConfirmingDelete(true) }
          : undefined
      }
      actions={
        confirmingDelete ? (
          <>
            <Text variant="body" color="textMuted">
              Apagar esta luta? Ela sai do cartel do atleta.
            </Text>
            <TextButton title="Apagar luta" color="danger" disabled={saving} onPress={remove} />
            <Button title="Cancelar" variant="secondary" disabled={saving} onPress={() => setConfirmingDelete(false)} />
          </>
        ) : (
          <>
            <Button title="Salvar luta" disabled={!result || !method} loading={saving} onPress={save} />
            <Button title="Voltar" variant="secondary" disabled={saving} onPress={onDone} />
          </>
        )
      }
    >
      <Box gap="s8">
        <Text variant="captionCaps">Resultado</Text>
        <SelectionGrid
          options={FIGHT_RESULTS.map((o) => o.label)}
          selected={resultLabel ? [resultLabel] : []}
          onToggle={(label) => setResult(valueOf(FIGHT_RESULTS, label))}
          columns={3}
        />
      </Box>
      <Box gap="s8">
        <Text variant="captionCaps">Método</Text>
        <SelectionGrid
          options={FIGHT_METHODS.map((o) => o.label)}
          selected={methodLabel ? [methodLabel] : []}
          onToggle={(label) => setMethod(valueOf(FIGHT_METHODS, label))}
        />
      </Box>
      <Box gap="s8">
        <Text variant="captionCaps">Fase (opcional)</Text>
        <SelectionGrid
          options={FIGHT_STAGES.map((o) => o.label)}
          selected={stageLabel ? [stageLabel] : []}
          onToggle={(label) => setStage(label === stageLabel ? null : valueOf(FIGHT_STAGES, label))}
        />
      </Box>
      <TextField
        label="Adversário (opcional)"
        value={opponent}
        onChangeText={setOpponent}
        maxLength={FIGHT_OPPONENT_MAX}
        autoCapitalize="words"
      />
      <TextField
        label="Observação (opcional)"
        value={note}
        onChangeText={setNote}
        maxLength={FIGHT_NOTE_MAX}
        multiline
      />
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
