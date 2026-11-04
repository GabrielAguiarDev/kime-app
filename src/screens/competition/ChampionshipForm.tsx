import { useState } from 'react';

import { Button, Text, TextField } from '@components';
import { parseBrDate, toBrDate, type Championship, type ChampionshipInput } from '@domain/Competition';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';

const NAME_MIN = 2;
const NAME_MAX = 120;
const LOCATION_MAX = 200;

/** Sheet form: create or edit a championship (name, date, location). */
export function ChampionshipForm({
  initial,
  saving,
  error,
  onSave,
  onDelete,
}: {
  initial?: Championship;
  saving: boolean;
  error: unknown;
  onSave: (input: ChampionshipInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial ? toBrDate(initial.eventDate) : '');
  const [location, setLocation] = useState(initial?.location ?? '');

  const trimmed = name.trim();
  const nameError =
    trimmed.length > 0 && (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX)
      ? `Use entre ${NAME_MIN} e ${NAME_MAX} caracteres.`
      : undefined;
  const eventDate = parseBrDate(date);
  const dateError = date.length === 10 && !eventDate ? 'Use uma data válida no formato DD/MM/AAAA.' : undefined;
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX && !!eventDate && location.length <= LOCATION_MAX;

  return (
    <SheetForm
      title={initial ? 'Editar campeonato' : 'Novo campeonato'}
      headerAction={
        onDelete ? { icon: 'trash', accessibilityLabel: 'Remover campeonato', onPress: onDelete, color: 'danger' } : undefined
      }
      actions={
        <Button
          title="Salvar"
          disabled={!valid}
          loading={saving}
          onPress={() => eventDate && onSave({ name: trimmed, eventDate, location })}
        />
      }
    >
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        placeholder="Ex.: Copa Kimi de Jiu-Jitsu"
        maxLength={NAME_MAX}
        errorMessage={nameError}
        autoCapitalize="words"
      />
      <TextField
        label="Data"
        value={date}
        onChangeText={(t) => setDate(maskBirthDate(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        errorMessage={dateError}
      />
      <TextField
        label="Local (opcional)"
        value={location}
        onChangeText={setLocation}
        placeholder="Cidade ou ginásio"
        maxLength={LOCATION_MAX}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
