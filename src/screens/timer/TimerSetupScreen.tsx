import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import {
  BottomSheet,
  Box,
  Button,
  Card,
  ChoiceRow,
  Icon,
  Screen,
  SelectionCard,
  Text,
  TextButton,
  TextField,
} from '@components';
import { useModalities } from '@domain/Classes';
import {
  BUILT_IN_PRESETS,
  describeConfig,
  formatClock,
  isValidConfig,
  LIMITS,
  parseDuration,
  useTimerPresetMutations,
  useTimerPresets,
  type TimerConfig,
  type TimerPreset,
} from '@domain/Timer';
import { errorMessage, keyValueStorage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { startTimer, timerSoundsAvailable, useTimerSession } from '@services/timer';
import { haptics } from '@utils/haptics';

interface Fields {
  rounds: string;
  round: string;
  rest: string;
  warning: string;
}

const toFields = (c: TimerConfig): Fields => ({
  rounds: String(c.rounds),
  round: formatClock(c.roundSeconds * 1000),
  rest: formatClock(c.restSeconds * 1000),
  warning: String(c.warningSeconds),
});

function toConfig(f: Fields): TimerConfig | null {
  const rounds = Number(f.rounds);
  const roundSeconds = parseDuration(f.round);
  const restSeconds = parseDuration(f.rest);
  const warningSeconds = f.warning.trim() === '' ? 0 : Number(f.warning);
  if (!Number.isInteger(rounds) || roundSeconds === null || restSeconds === null || !Number.isInteger(warningSeconds)) {
    return null;
  }
  const config = { rounds, roundSeconds, restSeconds, warningSeconds };
  return isValidConfig(config) ? config : null;
}

const sameConfig = (a: TimerConfig, b: TimerConfig) =>
  a.rounds === b.rounds &&
  a.roundSeconds === b.roundSeconds &&
  a.restSeconds === b.restSeconds &&
  a.warningSeconds === b.warningSeconds;

interface LastUsed {
  presetId: string;
  config: TimerConfig;
}

function readLast(scope: string): LastUsed | null {
  try {
    const raw = keyValueStorage.getScoped('timerLast', scope);
    return raw ? (JSON.parse(raw) as LastUsed) : null;
  } catch {
    return null;
  }
}

/**
 * Timer (tab for staff; students open it from Aulas). Opens on the last preset
 * used — or the modality's preset when coming from a class ("Timer") — with
 * "Iniciar" in focus. Presets switch with one tap; adjustments are for this
 * session. The owner saves the academy's presets (optionally for a modality).
 */
export function TimerSetupScreen() {
  const { modality: modalityParam } = useLocalSearchParams<{ modality?: string }>();
  const { userId } = useSession();
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const presets = useTimerPresets(academyId);
  const running = useTimerSession();
  const confirm = useConfirm();
  const scope = `${userId ?? ''}.${academyId ?? ''}`;

  const all = [...(presets.data ?? []), ...BUILT_IN_PRESETS];
  const [picked, setPicked] = useState<TimerPreset | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [appliedModality, setAppliedModality] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Adjusted while rendering (React's "adjust state on prop change" pattern), not in effects.
  // First open: the last preset used (with its adjustments), else the first one.
  if (!picked && !presets.isLoading) {
    const last = readLast(scope);
    const preset = (last && all.find((p) => p.id === last.presetId)) ?? all[0]!;
    setPicked(preset);
    setFields(toFields(last && last.presetId === preset.id ? last.config : preset));
  }
  // Coming from a class: that modality's preset, when the academy has one.
  if (modalityParam && modalityParam !== appliedModality && presets.data) {
    setAppliedModality(modalityParam);
    const preset = presets.data.find((p) => p.modalityId === modalityParam);
    if (preset) {
      setPicked(preset);
      setFields(toFields(preset));
    }
  }

  if (!picked || !fields) {
    return (
      <Screen nativeHeader title="Timer" bottomInset={false}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  // Just saved: the academy list brings it back with its real id.
  const selected = picked.id.startsWith('new:') ? (presets.data?.find((p) => p.name === picked.name) ?? picked) : picked;
  const config = toConfig(fields);
  const adjusted = !!config && !sameConfig(config, selected);

  const pick = (p: TimerPreset) => {
    setPicked(p);
    setFields(toFields(p));
  };
  const set = (key: keyof Fields) => (text: string) => setFields((f) => (f ? { ...f, [key]: text } : f));

  const start = async () => {
    if (!config) return;
    if (running && running.state.phase !== 'done') {
      const ok = await confirm({
        title: 'Trocar o timer?',
        message: 'Já existe um timer em andamento. Ele será encerrado.',
        confirmLabel: 'Iniciar novo',
      });
      if (!ok) return;
    }
    haptics.tap();
    keyValueStorage.setScoped('timerLast', scope, JSON.stringify({ presetId: selected.id, config } satisfies LastUsed));
    await startTimer(selected.name, config);
    router.push('/timer/run');
  };

  const roundsError =
    fields.rounds && !(Number(fields.rounds) >= LIMITS.rounds.min && Number(fields.rounds) <= LIMITS.rounds.max)
      ? `De ${LIMITS.rounds.min} a ${LIMITS.rounds.max}.`
      : undefined;
  const roundError = fields.round && parseDuration(fields.round) === null ? 'Use M:SS (ex.: 3:00).' : undefined;
  const restError = fields.rest && parseDuration(fields.rest) === null ? 'Use M:SS (ex.: 1:00).' : undefined;
  const warningError =
    fields.warning && config === null && !roundsError && !roundError && !restError
      ? 'O aviso precisa ser menor que o round (até 60 s).'
      : undefined;

  return (
    <Screen
      nativeHeader
      title="Timer"
      bottomInset={false}
      footer={<Button title={`Iniciar · ${selected.name}`} icon="play" disabled={!config} onPress={() => void start()} />}
    >
      <Box gap="s24">
        {running ? (
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
                {running.title} ·{' '}
                {running.state.phase === 'done' ? 'terminado' : `round ${running.state.round} de ${running.state.rounds}`}
              </Text>
            </Box>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        ) : null}

        {/* The configuration about to start. */}
        <Card gap="s4">
          <Text variant="captionCaps">{adjusted ? 'Ajustado para esta sessão' : 'Pronto para iniciar'}</Text>
          <Text variant="title">{selected.name}</Text>
          <Text variant="body" color="textMuted">
            {config
              ? `${describeConfig(config)}${config.warningSeconds ? ` · aviso ${config.warningSeconds} s` : ''}`
              : 'Configuração inválida'}
          </Text>
        </Card>

        {!timerSoundsAvailable ? (
          <Text variant="caption" color="warning">
            Os sinos e o timer em segundo plano chegam com a próxima atualização do app.
          </Text>
        ) : null}

        <Box gap="s12">
          <Text variant="captionCaps">Predefinições</Text>
          {presets.isLoading ? <ActivityIndicator /> : null}
          {all.map((p) => (
            <SelectionCard
              key={p.id}
              label={p.name}
              description={`${describeConfig(p)}${p.warningSeconds ? ` · aviso ${p.warningSeconds} s` : ''}${p.builtIn ? '' : ' · da academia'}`}
              selected={selected.id === p.id}
              onPress={() => pick(p)}
            />
          ))}
        </Box>

        <Box gap="s12">
          <Text variant="captionCaps">{isOwner ? 'Configuração' : 'Ajustar só nesta sessão'}</Text>
          <Box flexDirection="row" gap="s12">
            <Box flex={1}>
              <TextField
                label="Rounds"
                value={fields.rounds}
                onChangeText={set('rounds')}
                keyboardType="number-pad"
                maxLength={2}
                errorMessage={roundsError}
              />
            </Box>
            <Box flex={1}>
              <TextField
                label="Aviso antes do fim"
                value={fields.warning}
                onChangeText={set('warning')}
                keyboardType="number-pad"
                maxLength={2}
                unit="s"
                errorMessage={warningError}
              />
            </Box>
          </Box>
          <Box flexDirection="row" gap="s12">
            <Box flex={1}>
              <TextField
                label="Round"
                value={fields.round}
                onChangeText={set('round')}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                placeholder="3:00"
                errorMessage={roundError}
              />
            </Box>
            <Box flex={1}>
              <TextField
                label="Descanso"
                value={fields.rest}
                onChangeText={set('rest')}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                placeholder="1:00"
                errorMessage={restError}
              />
            </Box>
          </Box>
          <Text variant="caption">
            Antes do primeiro round há 10 s para se preparar. Sino no início do round, três sinos no fim e batidas de madeira no
            aviso. O timer continua com o app fechado ou a tela bloqueada.
          </Text>
        </Box>

        {isOwner && academyId && userId && config ? (
          <PresetActions
            academyId={academyId}
            userId={userId}
            selected={selected}
            config={config}
            changed={adjusted}
            onOpenSave={() => setSaving(true)}
            onDeleted={() => pick(BUILT_IN_PRESETS[0]!)}
          />
        ) : null}
      </Box>

      <BottomSheet visible={saving} onRequestClose={() => setSaving(false)}>
        {saving && academyId && userId && config ? (
          <SavePresetForm
            academyId={academyId}
            userId={userId}
            config={config}
            taken={new Set((presets.data ?? []).map((p) => p.modalityId).filter((m): m is string => !!m))}
            onSaved={(name) => {
              setSaving(false);
              setPicked({ id: `new:${name}`, name, builtIn: false, ...config });
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function PresetActions({
  academyId,
  userId,
  selected,
  config,
  changed,
  onOpenSave,
  onDeleted,
}: {
  academyId: string;
  userId: string;
  selected: TimerPreset;
  config: TimerConfig;
  changed: boolean;
  onOpenSave: () => void;
  onDeleted: () => void;
}) {
  const { update, remove } = useTimerPresetMutations(academyId, userId);
  const confirm = useConfirm();
  const own = !selected.builtIn && !selected.id.startsWith('new:');
  const onError = (e: unknown) => Alert.alert('Predefinições', errorMessage(e));
  return (
    <Box gap="s8">
      <TextButton title="Salvar como predefinição da academia" icon="plus" onPress={onOpenSave} />
      {own && changed ? (
        <TextButton
          title={`Atualizar "${selected.name}"`}
          disabled={update.isPending}
          onPress={() => update.mutate({ id: selected.id, config }, { onSuccess: () => haptics.success(), onError })}
        />
      ) : null}
      {own ? (
        <TextButton
          title={`Apagar "${selected.name}"`}
          color="danger"
          disabled={remove.isPending}
          onPress={async () => {
            const ok = await confirm({
              title: 'Apagar predefinição?',
              message: `"${selected.name}" sai da lista da academia.`,
              confirmLabel: 'Apagar',
              tone: 'danger',
            });
            if (ok) remove.mutate(selected.id, { onSuccess: onDeleted, onError });
          }}
        />
      ) : null}
    </Box>
  );
}

const NO_MODALITY = 'none';

function SavePresetForm({
  academyId,
  userId,
  config,
  taken,
  onSaved,
}: {
  academyId: string;
  userId: string;
  config: TimerConfig;
  /** Modalities that already have a preset (one per modality). */
  taken: Set<string>;
  onSaved: (name: string) => void;
}) {
  const { create } = useTimerPresetMutations(academyId, userId);
  const modalities = useModalities(academyId);
  const [name, setName] = useState('');
  const [modality, setModality] = useState<string>(NO_MODALITY);
  const trimmed = name.trim();
  const options = [
    { value: NO_MODALITY, label: 'Nenhuma' },
    ...(modalities.data ?? []).filter((m) => !taken.has(m.id)).map((m) => ({ value: m.id, label: m.name })),
  ];
  return (
    <SheetForm
      title="Nova predefinição"
      actions={
        <Button
          title="Salvar"
          disabled={trimmed.length === 0}
          loading={create.isPending}
          onPress={() =>
            create.mutate(
              { name: trimmed, config, modalityId: modality === NO_MODALITY ? null : modality },
              {
                onSuccess: () => {
                  haptics.success();
                  onSaved(trimmed);
                },
              },
            )
          }
        />
      }
    >
      <Text variant="body" color="textMuted">
        {describeConfig(config)}
        {config.warningSeconds ? ` · aviso ${config.warningSeconds} s` : ''}. Todos da academia veem esta predefinição.
      </Text>
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={40} placeholder="Ex.: Sparring de quinta" autoFocus />
      {options.length > 1 ? (
        <Box gap="s8">
          <Text variant="captionCaps">Usar nas aulas de</Text>
          <ChoiceRow accessibilityLabel="Modalidade da predefinição" options={options} value={modality} onChange={setModality} />
          <Text variant="caption">O botão Timer de uma aula dessa modalidade abre esta predefinição.</Text>
        </Box>
      ) : null}
      {create.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(create.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
