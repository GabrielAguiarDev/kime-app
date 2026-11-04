import { useState } from 'react';

import { Button, ChoiceRow, Text, TextField } from '@components';
import { isValidTime } from '@domain/Classes';
import { maskTime, MEAL_DESCRIPTION_MAX, MEAL_NAME_MAX, MEAL_SUGGESTIONS, type DietMeal, type DietMealInput } from '@domain/Diet';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';

/** Sheet form: one meal (name with shortcuts, optional time, what to eat). */
export function MealForm({
  title,
  initial,
  saving,
  error,
  onSave,
  onDelete,
}: {
  title: string;
  initial?: DietMeal;
  saving: boolean;
  error: unknown;
  onSave: (input: DietMealInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [time, setTime] = useState(initial?.mealTime ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const trimmed = name.trim();
  const timeError = time && (time.length < 5 || !isValidTime(time)) ? 'Use o formato HH:MM (ex.: 07:30).' : undefined;
  const valid = trimmed.length > 0 && trimmed.length <= MEAL_NAME_MAX && !timeError;
  const suggestion = MEAL_SUGGESTIONS.find((s) => s === trimmed) ?? '';

  return (
    <SheetForm
      title={title}
      tall
      headerAction={onDelete ? { icon: 'trash', accessibilityLabel: 'Remover refeição', onPress: onDelete, color: 'danger' } : undefined}
      actions={
        <Button
          title="Salvar refeição"
          disabled={!valid}
          loading={saving}
          onPress={() => onSave({ name: trimmed, mealTime: time || null, description })}
        />
      }
    >
      <ChoiceRow
        accessibilityLabel="Sugestões de refeição"
        options={MEAL_SUGGESTIONS.map((s) => ({ value: s, label: s }))}
        value={suggestion}
        onChange={setName}
      />
      <TextField label="Refeição" value={name} onChangeText={setName} maxLength={MEAL_NAME_MAX} placeholder="Ex.: Pré-treino" />
      <TextField
        label="Horário (opcional)"
        value={time}
        onChangeText={(t) => setTime(maskTime(t))}
        placeholder="HH:MM"
        keyboardType="number-pad"
        maxLength={5}
        errorMessage={time.length === 5 ? timeError : undefined}
      />
      <TextField
        label="O que comer"
        value={description}
        onChangeText={setDescription}
        maxLength={MEAL_DESCRIPTION_MAX}
        placeholder="Ex.: 3 ovos, 40 g de aveia, 1 banana"
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
