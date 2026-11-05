import { useState } from 'react';

import { Box, Button, SelectionCard, Text, TextField } from '@components';
import type { Modality } from '@domain/Classes';
import { parseBrDate, toBrDate, type Championship, type ChampionshipInput } from '@domain/Competition';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';

const NAME_MIN = 2;
const NAME_MAX = 120;
const LOCATION_MAX = 200;

/** Sheet form: create or edit a championship (modality — required —, name, date, location). */
export function ChampionshipForm({
  initial,
  modalities,
  saving,
  error,
  onSave,
  onDelete,
}: {
  initial?: Championship;
  /** The academy's modalities; one is required. */
  modalities: Modality[];
  saving: boolean;
  error: unknown;
  onSave: (input: ChampionshipInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial ? toBrDate(initial.eventDate) : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [modalityId, setModalityId] = useState<string | null>(
    initial?.modalityId ?? (modalities.length === 1 ? (modalities[0]?.id ?? null) : null),
  );

  const trimmed = name.trim();
  const nameError =
    trimmed.length > 0 && (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX)
      ? `Use entre ${NAME_MIN} e ${NAME_MAX} caracteres.`
      : undefined;
  const eventDate = parseBrDate(date);
  const dateError = date.length === 10 && !eventDate ? 'Use uma data válida no formato DD/MM/AAAA.' : undefined;
  const valid =
    trimmed.length >= NAME_MIN &&
    trimmed.length <= NAME_MAX &&
    !!eventDate &&
    location.length <= LOCATION_MAX &&
    !!modalityId &&
    modalities.some((m) => m.id === modalityId);
  const movingModality = !!initial && !!modalityId && modalityId !== initial.modalityId;

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
          onPress={() => eventDate && modalityId && onSave({ modalityId, name: trimmed, eventDate, location })}
        />
      }
    >
      <Box gap="s8">
        <Text variant="caption">Modalidade</Text>
        {modalities.map((m) => (
          <SelectionCard key={m.id} label={m.name} selected={modalityId === m.id} onPress={() => setModalityId(m.id)} />
        ))}
        {movingModality ? (
          <Text variant="caption">Atletas que não competem na nova modalidade saem da lista de inscritos.</Text>
        ) : null}
      </Box>
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
