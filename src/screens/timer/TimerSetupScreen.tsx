import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, useWindowDimensions } from 'react-native';

import { BottomSheet, Box, Button, Card, Icon, NativeMenu, RoundButton, Screen, Text } from '@components';
import { useModalities } from '@domain/Classes';
import {
  BUILT_IN_PRESETS,
  formatClock,
  presetForModality,
  sameConfig,
  summaryLine,
  useMyTimerPresets,
  type TimerConfig,
  type TimerPreset,
} from '@domain/Timer';
import { keyValueStorage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { startTimer, timerSoundsAvailable, useTimerSession } from '@services/timer';
import { useAppTheme } from '@theme';

import { AdjustSheet, PresetForm } from './TimerSheets';

const toConfig = (p: TimerConfig): TimerConfig => ({
  rounds: p.rounds,
  roundSeconds: p.roundSeconds,
  restSeconds: p.restSeconds,
  warningSeconds: p.warningSeconds,
});

/** Last preset the user started (adjustments are for one session, so only the id counts). */
function readLastPresetId(userId: string | undefined): string | null {
  try {
    const raw = keyValueStorage.getScoped('timerLast', userId ?? '');
    return raw ? ((JSON.parse(raw) as { presetId?: string }).presetId ?? null) : null;
  } catch {
    return null;
  }
}

/** Every preset removed: the timer still opens, with the first ready-made config. */
const FALLBACK: TimerPreset = { ...BUILT_IN_PRESETS[0]!, id: 'fallback', name: 'Timer' };

type Sheet = { kind: 'adjust' } | { kind: 'create' };

/**
 * Timer (a tab for everyone). Check and start in a few seconds: one pill on
 * top with the selected preset ("Muay Thai ▾") opening the native menu of the
 * user's presets ("Nova predefinição" and "Gerenciar predefinições" at
 * the end), the round length in the middle, "Ajustar" for
 * this session, and a big round start button within thumb reach.
 *
 * Opens with the last preset the user started; without one, a student gets
 * the preset of the modality selected on Início (when the list has one), and
 * coming from a class (`?modality=`) opens that modality's preset.
 */
export function TimerSetupScreen() {
  const { modality: modalityParam } = useLocalSearchParams<{ modality?: string }>();
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { selected: headerModality } = useActiveModality();
  const modalities = useModalities(modalityParam ? active?.gymId : undefined);
  const mine = useMyTimerPresets(userId);
  const running = useTimerSession();
  const confirm = useConfirm();

  const presets = mine.presets;
  const loading = mine.isLoading;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [config, setConfig] = useState<TimerConfig | null>(null);
  // The picked preset's values when last synced: an edit in "Gerenciar" follows here unless adjusted.
  const [base, setBase] = useState<TimerConfig | null>(null);
  const [appliedModality, setAppliedModality] = useState<string | undefined>(undefined);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pick = (p: TimerPreset) => {
    setPickedId(p.id);
    setConfig(toConfig(p));
    setBase(toConfig(p));
  };

  // Adjusted while rendering (React's "adjust state on prop change" pattern), not in effects.
  // First open: the last preset used; else (student) the selected modality's; else the first one.
  if (!pickedId && !loading) {
    const lastId = readLastPresetId(userId);
    const preset =
      presets.find((p) => p.id === lastId) ??
      (!isStaff && headerModality ? presetForModality(presets, headerModality.name) : undefined) ??
      presets[0] ??
      FALLBACK;
    pick(preset);
  }
  // Coming from a class: that modality's preset, when the list has one.
  if (modalityParam && modalityParam !== appliedModality && !loading && modalities.data) {
    setAppliedModality(modalityParam);
    const name = modalities.data.find((m) => m.id === modalityParam)?.name;
    const preset = name ? presetForModality(presets, name) : undefined;
    if (preset) pick(preset);
  }

  const selected = pickedId === FALLBACK.id ? FALLBACK : presets.find((p) => p.id === pickedId);
  // Deleted or removed in "Gerenciar": back to the first one.
  if (pickedId && !loading && !selected) pick(presets[0] ?? FALLBACK);
  // Edited in "Gerenciar": take the new values (unless adjusted for this session).
  if (selected && config && base && !sameConfig(selected, base)) {
    if (sameConfig(config, base)) setConfig(toConfig(selected));
    setBase(toConfig(selected));
  }

  if (!selected || !config) {
    // Same structure as the loaded screen (the footer with the play button, disabled):
    // nothing in the layout changes when the presets arrive.
    return (
      <Screen
        nativeHeader
        title="Timer"
        bottomInset={false}
        footer={
          <Box alignItems="center">
            <RoundButton icon="play" accessibilityLabel="Iniciar timer" disabled onPress={() => undefined} />
          </Box>
        }
      >
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  const adjusted = !sameConfig(config, selected);

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
    keyValueStorage.setScoped('timerLast', userId ?? '', JSON.stringify({ presetId: selected.id }));
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
        <Box alignItems="center" gap="s4" paddingVertical="s24">
          <Box marginBottom="s24">
            <NativeMenu
              accessibilityLabel={`Predefinição: ${selected.name}. Trocar`}
              label={<PresetPill name={selected.name} />}
              options={presets.map((p) => ({ id: p.id, title: p.name }))}
              selectedId={selected.id}
              onSelect={(id) => {
                const p = presets.find((o) => o.id === id);
                if (p) pick(p);
              }}
              actions={
                userId
                  ? [
                      { title: 'Nova predefinição', systemImage: 'plus', onPress: () => openSheet({ kind: 'create' }) },
                      { title: 'Gerenciar predefinições', systemImage: 'list.bullet', onPress: () => router.push('/timer/presets') },
                    ]
                  : undefined
              }
              // Build without the native menu: each tap moves to the next preset.
              onFallbackPress={() => {
                const i = presets.findIndex((p) => p.id === selected.id);
                const next = presets[(i + 1) % presets.length];
                if (next) pick(next);
              }}
            />
          </Box>
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
            onSaveAsPreset={userId ? () => setSheet({ kind: 'create' }) : undefined}
          />
        ) : null}
        {sheet?.kind === 'create' && userId ? (
          <PresetForm
            userId={userId}
            initial={config}
            onRestoreBuiltIns={
              mine.hiddenCount > 0
                ? () => {
                    mine.restoreBuiltIns();
                    setSheetOpen(false);
                  }
                : undefined
            }
            onSaved={(id) => {
              setSheetOpen(false);
              // The list was refetched before this runs: the new preset is in it.
              setPickedId(id);
              setBase(config);
            }}
            onDeleted={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** "Muay Thai ▾": surface pill with the selected preset (the native menu opens on tap). */
function PresetPill({ name }: { name: string }) {
  const { size, border, spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  return (
    <Box
      height={size.touchTarget}
      flexDirection="row"
      alignItems="center"
      gap="s8"
      paddingHorizontal="s16"
      borderWidth={border.width}
      borderColor="border"
      backgroundColor="surface"
      style={{ borderRadius: size.touchTarget / 2, maxWidth: width - spacing.screenMargin * 2 }}
    >
      <Text variant="bodyStrong" numberOfLines={1} flexShrink={1}>
        {name}
      </Text>
      <Icon name="chevronDown" color="textMuted" size={size.iconInline} />
    </Box>
  );
}
