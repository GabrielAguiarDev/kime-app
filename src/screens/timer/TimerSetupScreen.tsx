import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';

import { BottomSheet, Box, Button, Card, Icon, RoundButton, Screen, Text } from '@components';
import { useModalities } from '@domain/Classes';
import {
  builtInFor,
  builtInsForAcademy,
  formatClock,
  sameConfig,
  summaryLine,
  useTimerPresets,
  type TimerConfig,
  type TimerPreset,
} from '@domain/Timer';
import { keyValueStorage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { startTimer, timerSoundsAvailable, useTimerSession } from '@services/timer';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { AdjustSheet, PresetForm } from './TimerSheets';

const toConfig = (p: TimerConfig): TimerConfig => ({
  rounds: p.rounds,
  roundSeconds: p.roundSeconds,
  restSeconds: p.restSeconds,
  warningSeconds: p.warningSeconds,
});

/** Last preset started (adjustments are for one session, so only the id counts). */
function readLastPresetId(scope: string): string | null {
  try {
    const raw = keyValueStorage.getScoped('timerLast', scope);
    return raw ? ((JSON.parse(raw) as { presetId?: string }).presetId ?? null) : null;
  } catch {
    return null;
  }
}

type Sheet = { kind: 'adjust' } | { kind: 'create' } | { kind: 'edit'; preset: TimerPreset };

/**
 * Timer (tab for staff; students open it from Aulas). Check and start in a
 * few seconds: preset chips on top (the last one used is selected), the
 * round length in the middle, "Ajustar" for this session, and a big round
 * start button within thumb reach. The owner creates presets with "+" and
 * edits / deletes them with a long press on the chip.
 */
export function TimerSetupScreen() {
  const { modality: modalityParam } = useLocalSearchParams<{ modality?: string }>();
  const { userId } = useSession();
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const presets = useTimerPresets(academyId);
  const modalities = useModalities(academyId);
  const running = useTimerSession();
  const confirm = useConfirm();
  const scope = `${userId ?? ''}.${academyId ?? ''}`;

  // Ready-made presets only for the academy's modalities (all of them when none matches).
  const builtIns = builtInsForAcademy((modalities.data ?? []).map((m) => m.name));
  const all = [...(presets.data ?? []), ...builtIns];
  const loading = presets.isLoading || modalities.isLoading;
  const [picked, setPicked] = useState<TimerPreset | null>(null);
  const [config, setConfig] = useState<TimerConfig | null>(null);
  const [appliedModality, setAppliedModality] = useState<string | undefined>(undefined);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Adjusted while rendering (React's "adjust state on prop change" pattern), not in effects.
  // First open: the last preset used, else the first one.
  if (!picked && !loading) {
    const lastId = readLastPresetId(scope);
    const preset = all.find((p) => p.id === lastId) ?? all[0]!;
    setPicked(preset);
    setConfig(toConfig(preset));
  }
  // Coming from a class: that modality's preset, when the academy has one.
  if (modalityParam && modalityParam !== appliedModality && presets.data && modalities.data) {
    setAppliedModality(modalityParam);
    const name = modalities.data.find((m) => m.id === modalityParam)?.name;
    // The academy's preset of the modality, else the ready-made one for it.
    const preset = presets.data.find((p) => p.modalityId === modalityParam) ?? (name ? builtInFor(name) : undefined);
    if (preset) {
      setPicked(preset);
      setConfig(toConfig(preset));
    }
  }

  if (!picked || !config) {
    return (
      <Screen nativeHeader title="Timer" bottomInset={false}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  // Just saved: the academy list brings it back with its real id.
  const selected = picked.id.startsWith('new:') ? (presets.data?.find((p) => p.name === picked.name) ?? picked) : picked;
  const adjusted = !sameConfig(config, selected);
  const canManage = isOwner && !!academyId && !!userId;

  const pick = (p: TimerPreset) => {
    setPicked(p);
    setConfig(toConfig(p));
  };
  const openSheet = (next: Sheet) => {
    setSheet(next);
    setSheetOpen(true);
  };

  const start = async () => {
    if (running && running.state.phase !== 'done') {
      const ok = await confirm({
        title: 'Trocar o timer?',
        message: 'Já existe um timer em andamento. Ele será encerrado.',
        confirmLabel: 'Iniciar novo',
      });
      if (!ok) return;
    }
    keyValueStorage.setScoped('timerLast', scope, JSON.stringify({ presetId: selected.id }));
    await startTimer(selected.name, config);
    router.push('/timer/run');
  };

  return (
    <Screen
      nativeHeader
      title="Timer"
      bottomInset={false}
      footer={
        <Box alignItems="center">
          <RoundButton icon="play" accessibilityLabel={`Iniciar ${selected.name}`} onPress={() => void start()} />
        </Box>
      }
    >
      <Box gap="s24">
        <PresetChips
          presets={all}
          selectedId={selected.id}
          onPick={pick}
          onLongPress={canManage ? (p) => openSheet({ kind: 'edit', preset: p }) : undefined}
          onCreate={canManage ? () => openSheet({ kind: 'create' }) : undefined}
        />

        {running && running.state.phase !== 'done' ? (
          <Card
            selected
            onPress={() => router.push('/timer/run')}
            accessibilityLabel={`Timer em andamento: ${running.title}. Abrir`}
            flexDirection="row"
            alignItems="center"
            gap="s12"
          >
            <Icon name="timer" color="accent" active />
            <Box flex={1} gap="s4">
              <Text variant="bodyStrong">Timer em andamento</Text>
              <Text variant="caption">
                {running.title} · round {running.state.round} de {running.state.rounds}
              </Text>
            </Box>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        ) : null}

        {/* What is about to start. */}
        <Box alignItems="center" gap="s4" paddingVertical="s48">
          <Text variant="displayXl" accessibilityLabel={`Round de ${formatClock(config.roundSeconds * 1000)}`}>
            {formatClock(config.roundSeconds * 1000)}
          </Text>
          <Text variant="body" color="textMuted">
            {summaryLine(config)}
          </Text>
          {adjusted ? <Text variant="caption">Ajustado para esta sessão</Text> : null}
          <Box marginTop="s16">
            <Button title="Ajustar" variant="ghost" fullWidth={false} onPress={() => openSheet({ kind: 'adjust' })} />
          </Box>
        </Box>

        {!timerSoundsAvailable ? (
          <Text variant="caption" color="warning" textAlign="center">
            Os sinos e o timer em segundo plano chegam com a próxima atualização do app.
          </Text>
        ) : null}
      </Box>

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} onClosed={() => setSheet(null)}>
        {sheet?.kind === 'adjust' ? (
          <AdjustSheet
            config={config}
            onChange={setConfig}
            onSaveAsPreset={canManage ? () => setSheet({ kind: 'create' }) : undefined}
          />
        ) : null}
        {(sheet?.kind === 'create' || sheet?.kind === 'edit') && academyId && userId ? (
          <PresetForm
            key={sheet.kind === 'edit' ? sheet.preset.id : 'create'}
            academyId={academyId}
            userId={userId}
            initial={sheet.kind === 'edit' ? toConfig(sheet.preset) : config}
            editing={sheet.kind === 'edit' ? sheet.preset : undefined}
            taken={new Set((presets.data ?? []).map((p) => p.modalityId).filter((m): m is string => !!m))}
            onSaved={(name, saved) => {
              setSheetOpen(false);
              if (sheet.kind === 'create') {
                setPicked({ id: `new:${name}`, name, builtIn: false, ...saved });
                setConfig(saved);
              } else if (sheet.preset.id === selected.id) {
                setPicked({ ...sheet.preset, name, ...saved });
                setConfig(saved);
              }
            }}
            onDeleted={() => {
              setSheetOpen(false);
              if (sheet.kind === 'edit' && sheet.preset.id === selected.id) {
                const next = all.find((p) => p.id !== sheet.preset.id);
                if (next) pick(next);
              }
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/**
 * One horizontal line of compact selection chips (name only), scrolling
 * sideways without a bar. Selected: accent border + accent at 8%. Owner:
 * "+" at the end creates; a long press on an academy preset edits it.
 */
function PresetChips({
  presets,
  selectedId,
  onPick,
  onLongPress,
  onCreate,
}: {
  presets: TimerPreset[];
  selectedId: string;
  onPick: (p: TimerPreset) => void;
  onLongPress?: (p: TimerPreset) => void;
  onCreate?: () => void;
}) {
  const { spacing } = useAppTheme();
  return (
    // Bleeds to the screen edges so chips scroll under the margins.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.screenMargin }}
      contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, gap: spacing.s8 }}
      accessibilityLabel="Predefinições"
    >
      {presets.map((p) => {
        const editable = !!onLongPress && !p.builtIn && !p.id.startsWith('new:');
        return (
          <Chip
            key={p.id}
            label={p.name}
            selected={p.id === selectedId}
            onPress={() => onPick(p)}
            onLongPress={
              editable
                ? () => {
                    haptics.tap();
                    onLongPress(p);
                  }
                : undefined
            }
            accessibilityHint={editable ? 'Toque longo para editar ou apagar' : undefined}
          />
        );
      })}
      {onCreate ? <Chip icon="plus" label="Nova predefinição" selected={false} onPress={onCreate} /> : null}
    </ScrollView>
  );
}

function Chip({
  label,
  icon,
  selected,
  onPress,
  onLongPress,
  accessibilityHint,
}: {
  label: string;
  /** Icon-only chip ("+"); `label` becomes its accessibility label. */
  icon?: 'plus';
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
}) {
  const { size, border } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
    >
      {({ pressed }) => (
        // TODO(motion): chip selection changing (border / fill).
        <Box
          height={size.touchTarget}
          minWidth={size.touchTarget}
          paddingHorizontal={icon ? 's8' : 's16'}
          alignItems="center"
          justifyContent="center"
          borderRadius="sm"
          borderWidth={border.width}
          borderColor={selected ? 'accent' : 'border'}
          backgroundColor={selected ? 'accentSelected' : pressed ? 'surfaceRaised' : 'surface'}
        >
          {icon ? (
            <Icon name={icon} color="accent" />
          ) : (
            <Text variant="bodyStrong" color={selected ? 'accent' : 'text'} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Box>
      )}
    </Pressable>
  );
}
