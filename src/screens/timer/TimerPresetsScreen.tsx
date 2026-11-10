import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { BottomSheet, Box, Button, Icon, LoadError, ReorderList, Screen, Text, TextButton, type IconName } from '@components';
import {
  BUILT_IN_PRESETS,
  orderPresets,
  presetSummary,
  usePersonalTimerPresetMutations,
  useMyTimerPresets,
  type TimerPreset,
} from '@domain/Timer';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { PresetForm } from './TimerSheets';

/** Wait after the last move before saving the order (a drag moves the row many times). */
const SAVE_ORDER_MS = 600;

type Sheet = { kind: 'create' } | { kind: 'edit'; preset: TimerPreset };

/**
 * "Gerenciar predefinições" (from the Timer's menu): the user's list in rows,
 * in the menu's order. Hold and drag to reorder (saved on its own), pencil to
 * edit their own presets, trash to delete one (a ready-made preset is only
 * removed from the list; "Restaurar predefinições prontas" brings it back).
 */
export function TimerPresetsScreen() {
  const { userId } = useSession();
  const mine = useMyTimerPresets(userId);
  const { remove } = usePersonalTimerPresetMutations(userId ?? '');
  const confirm = useConfirm();
  const [order, setOrder] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Order being dragged: shown at once, saved shortly after the last move (and on leaving).
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; ids: string[] } | null>(null);
  const { reorder } = mine;
  const reorderRef = useRef(reorder);
  useEffect(() => {
    reorderRef.current = reorder;
  });
  useEffect(
    () => () => {
      if (!pending.current) return;
      clearTimeout(pending.current.timer);
      reorderRef.current(pending.current.ids);
    },
    [],
  );
  const changeOrder = (items: TimerPreset[]) => {
    const ids = items.map((p) => p.id);
    setOrder(ids);
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      ids,
      timer: setTimeout(() => {
        pending.current = null;
        reorderRef.current(ids);
      }, SAVE_ORDER_MS),
    };
  };
  const list = order ? orderPresets(mine.presets, order) : mine.presets;

  const openSheet = (next: Sheet) => {
    setSheet(next);
    setSheetOpen(true);
  };

  const del = async (p: TimerPreset) => {
    const ok = await confirm({
      title: p.builtIn ? 'Remover predefinição?' : 'Apagar predefinição?',
      message: p.builtIn
        ? `"${p.name}" sai da sua lista. Para trazer de volta, use "Restaurar predefinições prontas".`
        : `"${p.name}" sai da sua lista.`,
      confirmLabel: p.builtIn ? 'Remover' : 'Apagar',
      tone: 'danger',
    });
    if (!ok) return;
    if (p.builtIn) mine.hideBuiltIn(p.id);
    else remove.mutate(p.id);
  };

  const error = mine.prefsError ?? remove.error;

  return (
    <Screen nativeHeader title="Predefinições" onBack={() => router.back()}>
      {mine.isLoading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
      {mine.isError ? <LoadError title="Não foi possível carregar as predefinições" onRetry={mine.refetch} /> : null}
      {!mine.isLoading && !mine.isError ? (
        <Box gap="s16">
          {list.length > 1 ? (
            <Text variant="body" color="textMuted">
              Segure uma predefinição e arraste para mudar a ordem do menu.
            </Text>
          ) : null}
          {list.length === 0 ? (
            <Text variant="body" color="textMuted">
              Nenhuma predefinição na sua lista.
            </Text>
          ) : null}
          <ReorderList
            items={list}
            keyOf={(p) => p.id}
            labelOf={(p) => `${p.name}, ${presetSummary(p)}`}
            onChange={changeOrder}
            actionsOf={(p) => [
              ...(p.builtIn ? [] : [{ label: 'Editar', onPress: () => openSheet({ kind: 'edit', preset: p }) }]),
              { label: p.builtIn ? 'Remover' : 'Apagar', onPress: () => void del(p) },
            ]}
            renderItem={(p) => (
              <>
                <Box flex={1} gap="s4">
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {presetSummary(p)}
                  </Text>
                </Box>
                {!p.builtIn ? (
                  <RowAction icon="edit" label={`Editar ${p.name}`} onPress={() => openSheet({ kind: 'edit', preset: p })} />
                ) : null}
                <RowAction
                  icon="trash"
                  label={p.builtIn ? `Remover ${p.name}` : `Apagar ${p.name}`}
                  onPress={() => void del(p)}
                />
              </>
            )}
          />
          {error ? (
            <Text variant="caption" color="danger">
              {errorMessage(error)}
            </Text>
          ) : null}
          {userId ? (
            <Button title="Nova predefinição" variant="secondary" icon="plus" onPress={() => openSheet({ kind: 'create' })} />
          ) : null}
          {mine.hiddenCount > 0 ? (
            <TextButton title="Restaurar predefinições prontas" onPress={mine.restoreBuiltIns} />
          ) : null}
        </Box>
      ) : null}

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} onClosed={() => setSheet(null)}>
        {sheet && userId ? (
          <PresetForm
            key={sheet.kind === 'edit' ? sheet.preset.id : 'create'}
            userId={userId}
            initial={sheet.kind === 'edit' ? sheet.preset : BUILT_IN_PRESETS[0]!}
            editing={sheet.kind === 'edit' ? sheet.preset : undefined}
            onSaved={() => setSheetOpen(false)}
            onDeleted={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** Icon-only action inside a row (44pt target). */
function RowAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { size } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color={icon === 'trash' ? 'danger' : 'textMuted'} />
    </Pressable>
  );
}
