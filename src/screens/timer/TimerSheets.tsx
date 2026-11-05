import { useState } from 'react';
import { Pressable } from 'react-native';

import { Box, Button, ChoiceRow, Icon, Text, TextField, type IconName } from '@components';
import { useModalities } from '@domain/Classes';
import {
  formatClock,
  stepConfig,
  useTimerPresetMutations,
  type TimerConfig,
  type TimerField,
  type TimerPreset,
} from '@domain/Timer';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

const ROWS: { field: TimerField; label: string; format: (c: TimerConfig) => string }[] = [
  { field: 'rounds', label: 'Rounds', format: (c) => String(c.rounds) },
  { field: 'roundSeconds', label: 'Round', format: (c) => formatClock(c.roundSeconds * 1000) },
  {
    field: 'restSeconds',
    label: 'Descanso',
    format: (c) => (c.restSeconds > 0 ? formatClock(c.restSeconds * 1000) : 'Sem'),
  },
  {
    field: 'warningSeconds',
    label: 'Aviso antes do fim',
    format: (c) => (c.warningSeconds > 0 ? `${c.warningSeconds} s` : 'Sem'),
  },
];

/** The four steppers (no keyboard): rounds ±1, round/rest ±30 s, warning ±5 s. */
export function ConfigSteppers({ config, onChange }: { config: TimerConfig; onChange: (c: TimerConfig) => void }) {
  const { size } = useAppTheme();
  // Wide enough for "10:00" in display-lg, so the buttons don't move.
  const valueWidth = size.button * 2;
  return (
    <Box gap="s16">
      {ROWS.map((row) => {
        const less = stepConfig(config, row.field, -1);
        const more = stepConfig(config, row.field, 1);
        const value = row.format(config);
        return (
          <Box key={row.field} flexDirection="row" alignItems="center" gap="s12">
            <Text variant="bodyStrong" flex={1}>
              {row.label}
            </Text>
            <StepButton icon="minus" label={`Menos ${row.label.toLowerCase()}`} disabled={!less} onPress={() => less && onChange(less)} />
            <Box width={valueWidth} alignItems="center" accessible accessibilityLabel={`${row.label}: ${value}`} accessibilityLiveRegion="polite">
              <Text variant="displayLg" numberOfLines={1} adjustsFontSizeToFit>
                {value}
              </Text>
            </Box>
            <StepButton icon="plus" label={`Mais ${row.label.toLowerCase()}`} disabled={!more} onPress={() => more && onChange(more)} />
          </Box>
        );
      })}
    </Box>
  );
}

/** Square secondary tactile button (3.1, secondary) holding only − or +. */
function StepButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  const { size, border } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      {({ pressed }) => {
        // TODO(motion): step button sinking on press and rising back.
        const edge = disabled || pressed ? 0 : border.edgeWidth;
        return (
          <Box style={{ paddingTop: border.edgeWidth - edge }}>
            <Box backgroundColor={edge > 0 ? 'edge' : 'transparent'} borderRadius="md" style={{ paddingBottom: edge }}>
              <Box
                width={size.button}
                height={size.button}
                borderRadius="md"
                borderWidth={border.width}
                borderColor={disabled ? 'disabled' : 'border'}
                backgroundColor={disabled ? 'disabled' : 'surface'}
                alignItems="center"
                justifyContent="center"
              >
                <Icon name={icon} color={disabled ? 'textMuted' : 'text'} />
              </Box>
            </Box>
          </Box>
        );
      }}
    </Pressable>
  );
}

/** "Ajustar": changes for this session only; the owner can save them as a preset. */
export function AdjustSheet({
  config,
  onChange,
  onSaveAsPreset,
}: {
  config: TimerConfig;
  onChange: (c: TimerConfig) => void;
  /** Owner only. */
  onSaveAsPreset?: () => void;
}) {
  return (
    <SheetForm
      title="Ajustar"
      actions={onSaveAsPreset ? <Button title="Salvar como predefinição" variant="secondary" icon="plus" onPress={onSaveAsPreset} /> : undefined}
    >
      <Box gap="s16">
        <ConfigSteppers config={config} onChange={onChange} />
        <Text variant="caption">Vale só para esta sessão.</Text>
      </Box>
    </SheetForm>
  );
}

const NO_MODALITY = 'none';

/**
 * Owner: create a preset (from "+" or "Salvar como predefinição") or edit /
 * delete one (long press on its chip).
 */
export function PresetForm({
  academyId,
  userId,
  initial,
  editing,
  taken,
  onSaved,
  onDeleted,
}: {
  academyId: string;
  userId: string;
  initial: TimerConfig;
  /** Editing this academy preset; creating when absent. */
  editing?: TimerPreset;
  /** Modalities that already have a preset (one per modality). */
  taken: Set<string>;
  onSaved: (name: string, config: TimerConfig) => void;
  onDeleted: () => void;
}) {
  const { create, update, remove } = useTimerPresetMutations(academyId, userId);
  const modalities = useModalities(academyId);
  const confirm = useConfirm();
  const [name, setName] = useState(editing?.name ?? '');
  const [config, setConfig] = useState(initial);
  const [modality, setModality] = useState<string>(NO_MODALITY);
  const trimmed = name.trim();
  const options = [
    { value: NO_MODALITY, label: 'Nenhuma' },
    ...(modalities.data ?? []).filter((m) => !taken.has(m.id)).map((m) => ({ value: m.id, label: m.name })),
  ];
  const error = create.error ?? update.error ?? remove.error;
  const done = () => {
    haptics.success();
    onSaved(trimmed, config);
  };

  const del = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Apagar predefinição?',
      message: `"${editing.name}" sai da lista da academia.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (ok) remove.mutate(editing.id, { onSuccess: onDeleted });
  };

  return (
    <SheetForm
      tall
      title={editing ? 'Editar predefinição' : 'Nova predefinição'}
      headerAction={editing ? { icon: 'trash', accessibilityLabel: 'Apagar predefinição', onPress: () => void del(), color: 'danger' } : undefined}
      actions={
        <Button
          title="Salvar"
          disabled={trimmed.length === 0}
          loading={create.isPending || update.isPending}
          onPress={() =>
            editing
              ? update.mutate({ id: editing.id, name: trimmed, config }, { onSuccess: done })
              : create.mutate(
                  { name: trimmed, config, modalityId: modality === NO_MODALITY ? null : modality },
                  { onSuccess: done },
                )
          }
        />
      }
    >
      <Box gap="s24">
        <TextField label="Nome" value={name} onChangeText={setName} maxLength={40} placeholder="Ex.: Sparring de quinta" />
        <ConfigSteppers config={config} onChange={setConfig} />
        {!editing && options.length > 1 ? (
          <Box gap="s8">
            <Text variant="captionCaps">Usar nas aulas de</Text>
            <ChoiceRow accessibilityLabel="Modalidade da predefinição" options={options} value={modality} onChange={setModality} />
            <Text variant="caption">O botão Timer de uma aula dessa modalidade abre esta predefinição.</Text>
          </Box>
        ) : null}
        <Text variant="caption">Todos da academia veem esta predefinição.</Text>
        {error ? (
          <Text variant="caption" color="danger">
            {errorMessage(error)}
          </Text>
        ) : null}
      </Box>
    </SheetForm>
  );
}
