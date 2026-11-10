import { useState } from 'react';
import { Switch } from 'react-native';

import { Box, Button, Card, SelectionCard, Text, TextField } from '@components';
import type { Modality } from '@domain/Classes';
import type { LocalDate } from '@domain/Classes/classesTypes';
import { isPastDate, parseBrDate, toBrDate, type ChampionshipInput } from '@domain/Competition';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useAppTheme } from '@theme';

const NAME_MIN = 2;
const NAME_MAX = 120;
const LOCATION_MAX = 200;

/**
 * Sheet form: create or edit a championship (modality — required —, name, date, location and
 * whether it counts in the athletes' record: an internal championship does not).
 * `pastBefore` (academy-local today): a previous championship, whose date must be before it.
 */
export function ChampionshipForm({
  initial,
  modalities,
  saving,
  error,
  onSave,
  onDelete,
  title,
  pastBefore,
}: {
  initial?: ChampionshipInput;
  /** Overrides "Novo campeonato" / "Editar campeonato". */
  title?: string;
  pastBefore?: LocalDate;
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
  const [countsInRecord, setCountsInRecord] = useState(initial?.countsInRecord ?? true);
  const { colors } = useAppTheme();
  const [modalityId, setModalityId] = useState<string | null>(
    initial?.modalityId ?? (modalities.length === 1 ? (modalities[0]?.id ?? null) : null),
  );

  const trimmed = name.trim();
  const nameError =
    trimmed.length > 0 && (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX)
      ? `Use entre ${NAME_MIN} e ${NAME_MAX} caracteres.`
      : undefined;
  const eventDate = parseBrDate(date);
  const notPast = !!eventDate && !!pastBefore && !isPastDate(pastBefore, eventDate);
  const dateError =
    date.length === 10 && !eventDate
      ? 'Use uma data válida no formato DD/MM/AAAA.'
      : notPast
        ? 'Use uma data anterior a hoje.'
        : undefined;
  const valid =
    trimmed.length >= NAME_MIN &&
    trimmed.length <= NAME_MAX &&
    !!eventDate &&
    !notPast &&
    location.length <= LOCATION_MAX &&
    !!modalityId &&
    modalities.some((m) => m.id === modalityId);
  // A previous championship has only its athlete: nobody leaves the list.
  const movingModality = !pastBefore && !!initial && !!modalityId && modalityId !== initial.modalityId;

  return (
    <SheetForm
      title={title ?? (initial ? 'Editar campeonato' : 'Novo campeonato')}
      headerAction={
        onDelete ? { icon: 'trash', accessibilityLabel: 'Remover campeonato', onPress: onDelete, color: 'danger' } : undefined
      }
      actions={
        <Button
          title="Salvar"
          disabled={!valid}
          loading={saving}
          onPress={() => eventDate && modalityId && onSave({ modalityId, name: trimmed, eventDate, location, countsInRecord })}
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
      <Card flexDirection="row" alignItems="center" gap="s12">
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Conta no cartel</Text>
          <Text variant="caption">Desligue para um campeonato interno: as lutas não somam no cartel.</Text>
        </Box>
        <Switch
          value={countsInRecord}
          onValueChange={setCountsInRecord}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.border}
          accessibilityLabel="Conta no cartel"
        />
      </Card>
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
