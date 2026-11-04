import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, SelectionGrid, Text, TextField } from '@components';
import { sameModality, SUGGESTED_MODALITIES } from '@domain/Classes';
import { useCreateGym } from '@domain/Gym';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

const MAX_MODALITIES = 20;

export function CreateGymScreen() {
  const [name, setName] = useState('');
  const [options, setOptions] = useState(SUGGESTED_MODALITIES);
  const [modalities, setModalities] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const { selectGym } = useActiveGym();
  const { mutate, isPending, error } = useCreateGym();

  const nameOk = name.trim().length >= 2 && name.trim().length <= 80;
  const valid = nameOk && modalities.length > 0;

  const toggle = (modality: string) =>
    setModalities((current) =>
      current.includes(modality) ? current.filter((m) => m !== modality) : [...current, modality],
    );

  // A typed modality joins the options already selected (or selects the existing one).
  const addOther = () => {
    const typed = other.trim();
    if (!typed || modalities.length >= MAX_MODALITIES) return;
    const existing = options.find((o) => sameModality(o, typed));
    if (!existing) setOptions((current) => [...current, typed]);
    const value = existing ?? typed;
    setModalities((current) => (current.includes(value) ? current : [...current, value]));
    setOther('');
  };

  return (
    <Screen
      title="Sua academia"
      onBack={() => router.back()}
      footer={
        <Button
          title="Criar academia"
          disabled={!valid}
          loading={isPending}
          onPress={() =>
            mutate(
              { name, modalities },
              {
                onSuccess: (gymId) => {
                  haptics.success();
                  // Membership list refetch flips the root guard to (tabs).
                  selectGym(gymId);
                },
              },
            )
          }
        />
      }
    >
      <Box gap="s24">
        <Box gap="s16">
          <Text variant="body" color="textMuted">
            Você será o professor responsável. Depois, compartilhe o código ou o link de convite com seus alunos.
          </Text>
          <TextField
            label="Nome da academia"
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoCapitalize="words"
          />
        </Box>

        <Box gap="s8">
          <Text variant="caption">Modalidades que a academia ensina</Text>
          <SelectionGrid options={options} selected={modalities} onToggle={toggle} />
          <Box flexDirection="row" alignItems="flex-end" gap="s8" marginTop="s8">
            <Box flex={1}>
              <TextField
                label="Outra modalidade"
                value={other}
                onChangeText={setOther}
                maxLength={60}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={addOther}
              />
            </Box>
            <Button title="Adicionar" variant="secondary" fullWidth={false} disabled={!other.trim()} onPress={addOther} />
          </Box>
          <Text variant="caption">Você pode mudar isso depois nos horários das aulas.</Text>
        </Box>

        {error ? (
          <Text variant="caption" color="danger">
            {errorMessage(error)}
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
