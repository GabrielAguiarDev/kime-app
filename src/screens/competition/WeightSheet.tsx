import { useState } from 'react';

import { Button, Text, TextField } from '@components';
import {
  formatKg,
  parseBrDate,
  toBrDate,
  useWeightMutations,
  type WeightLog,
} from '@domain/Competition';
import { maskBirthDate } from '@domain/Profile';
import { parseDecimal, WEIGHT_RANGE_KG } from '@domain/Water';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

/**
 * Competitor: log the weight of a day (today by default). One weigh-in per
 * day: picking a day that already has one corrects it. Editing an existing
 * weigh-in also offers to delete it.
 */
export function WeightSheet({
  athleteId,
  today,
  logs,
  editing,
  onDone,
}: {
  athleteId: string;
  today: string;
  logs: WeightLog[];
  /** Weigh-in being corrected (opened from the history). */
  editing?: WeightLog;
  onDone: () => void;
}) {
  const { save, remove } = useWeightMutations(athleteId);
  const confirm = useConfirm();
  const [date, setDate] = useState(toBrDate(editing?.loggedOn ?? today));
  const [kg, setKg] = useState(editing ? formatKg(editing.weightKg) : '');

  const loggedOn = parseBrDate(date);
  const dateError =
    date.length === 10 && !loggedOn
      ? 'Use uma data válida no formato DD/MM/AAAA.'
      : loggedOn && loggedOn > today
        ? 'A data não pode ser no futuro.'
        : undefined;
  const weight = parseDecimal(kg);
  const weightError =
    kg.trim() && (weight === null || weight < WEIGHT_RANGE_KG.min || weight > WEIGHT_RANGE_KG.max)
      ? `Informe um peso entre ${WEIGHT_RANGE_KG.min} e ${WEIGHT_RANGE_KG.max} kg.`
      : undefined;
  const existing = loggedOn ? logs.find((l) => l.loggedOn === loggedOn) : undefined;
  const valid = !!loggedOn && !dateError && weight !== null && !weightError;

  const del = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Apagar pesagem?',
      message: `O peso de ${toBrDate(editing.loggedOn)} sai do seu histórico.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (ok) remove.mutate(editing.id, { onSuccess: onDone });
  };

  return (
    <SheetForm
      title={editing ? 'Corrigir peso' : 'Registrar peso'}
      headerAction={editing ? { icon: 'trash', accessibilityLabel: 'Apagar pesagem', onPress: del, color: 'danger' } : undefined}
      actions={
        <Button
          title="Salvar peso"
          disabled={!valid}
          loading={save.isPending}
          onPress={() =>
            loggedOn &&
            weight !== null &&
            save.mutate(
              { loggedOn, weightKg: Math.round(weight * 100) / 100, existingId: existing?.id },
              {
                onSuccess: () => {
                  haptics.success();
                  onDone();
                },
              },
            )
          }
        />
      }
    >
      <TextField
        label="Peso"
        value={kg}
        onChangeText={(t) => setKg(t.replace(/[^\d,.]/g, '').slice(0, 6))}
        placeholder="Ex.: 78,5"
        keyboardType="decimal-pad"
        unit="kg"
        errorMessage={weightError}
        autoFocus={!editing}
      />
      <TextField
        label="Dia"
        value={date}
        onChangeText={(t) => setDate(maskBirthDate(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        editable={!editing}
        errorMessage={dateError}
      />
      {!editing && existing ? (
        <Text variant="caption">
          Já há {formatKg(existing.weightKg)} kg neste dia. Salvar substitui esse peso.
        </Text>
      ) : null}
      <Text variant="caption">O último peso também atualiza seu perfil e a meta automática de água.</Text>
      {save.error || remove.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(save.error ?? remove.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
