import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { BottomSheet, Box, Button, Card, Icon, Screen, SelectionCard, Text, TextButton, TextField } from '@components';
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
import { errorMessage } from '@infra';
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

/**
 * Timer de rounds: pick a preset (built-in or the academy's), adjust rounds,
 * round, rest and the warning before the end, and start. Staff save the
 * configuration as an academy preset.
 */
export function TimerSetupScreen() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const academyId = active?.gymId;
  const presets = useTimerPresets(academyId);
  const running = useTimerSession();
  const confirm = useConfirm();
  const [picked, setSelected] = useState<TimerPreset>(BUILT_IN_PRESETS[0]!);
  const [fields, setFields] = useState<Fields>(toFields(BUILT_IN_PRESETS[0]!));
  const [saving, setSaving] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Just saved: the academy list brings it back with its real id.
  const selected = picked.id.startsWith('new:') ? (presets.data?.find((p) => p.name === picked.name) ?? picked) : picked;
  const config = toConfig(fields);
  const changed = !!config && describeConfig(config) + config.warningSeconds !== describeConfig(selected) + selected.warningSeconds;
  const all = [...BUILT_IN_PRESETS, ...(presets.data ?? [])];

  const pick = (p: TimerPreset) => {
    setSelected(p);
    setFields(toFields(p));
  };
  const set = (key: keyof Fields) => (text: string) => setFields((f) => ({ ...f, [key]: text }));

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
    await startTimer(changed ? 'Timer' : selected.name, config);
    router.push('/timer/run');
  };

  const roundsError = fields.rounds && !(Number(fields.rounds) >= LIMITS.rounds.min && Number(fields.rounds) <= LIMITS.rounds.max)
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
      title="Timer de rounds"
      onBack={back}
      footer={<Button title="Iniciar" icon="play" disabled={!config} onPress={() => void start()} />}
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
                {running.title} · {running.state.phase === 'done' ? 'terminado' : `round ${running.state.round} de ${running.state.rounds}`}
              </Text>
            </Box>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        ) : null}

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
          <Text variant="captionCaps">Configuração</Text>
          <Box flexDirection="row" gap="s12">
            <Box flex={1}>
              <TextField label="Rounds" value={fields.rounds} onChangeText={set('rounds')} keyboardType="number-pad" maxLength={2} errorMessage={roundsError} />
            </Box>
            <Box flex={1}>
              <TextField label="Aviso antes do fim" value={fields.warning} onChangeText={set('warning')} keyboardType="number-pad" maxLength={2} unit="s" errorMessage={warningError} />
            </Box>
          </Box>
          <Box flexDirection="row" gap="s12">
            <Box flex={1}>
              <TextField label="Round" value={fields.round} onChangeText={set('round')} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="3:00" errorMessage={roundError} />
            </Box>
            <Box flex={1}>
              <TextField label="Descanso" value={fields.rest} onChangeText={set('rest')} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="1:00" errorMessage={restError} />
            </Box>
          </Box>
          <Text variant="caption">
            Antes do primeiro round há 10 s para se preparar. Sino no início do round, três sinos no fim e batidas de madeira no
            aviso. O timer continua com o app fechado ou a tela bloqueada.
          </Text>
        </Box>

        {isStaff && academyId && userId && config ? (
          <PresetActions
            academyId={academyId}
            userId={userId}
            selected={selected}
            config={config}
            changed={changed}
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
            onSaved={(name) => {
              setSaving(false);
              setSelected({ id: `new:${name}`, name, builtIn: false, ...config });
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

function SavePresetForm({
  academyId,
  userId,
  config,
  onSaved,
}: {
  academyId: string;
  userId: string;
  config: TimerConfig;
  onSaved: (name: string) => void;
}) {
  const { create } = useTimerPresetMutations(academyId, userId);
  const [name, setName] = useState('');
  const trimmed = name.trim();
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
              { name: trimmed, config },
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
      {create.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(create.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
