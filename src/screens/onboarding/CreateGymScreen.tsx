import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { useCreateGym } from '@domain/Gym';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

export function CreateGymScreen() {
  const [name, setName] = useState('');
  const { selectGym } = useActiveGym();
  const { mutate, isPending, error } = useCreateGym();
  const valid = name.trim().length >= 2 && name.trim().length <= 80;

  return (
    <Screen
      title="Sua academia"
      footer={
        <>
          <Button
            title="Criar academia"
            disabled={!valid}
            loading={isPending}
            onPress={() =>
              mutate(name, {
                onSuccess: (gymId) => {
                  haptics.success();
                  // Membership list refetch flips the root guard to (tabs).
                  selectGym(gymId);
                },
              })
            }
          />
          <TextButton title="Voltar" color="textMuted" onPress={() => router.back()} />
        </>
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          Você será o professor responsável. Depois, compartilhe o link de convite com seus alunos.
        </Text>
        <TextField
          label="Nome da academia"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoCapitalize="words"
          errorMessage={error ? errorMessage(error) : undefined}
        />
      </Box>
    </Screen>
  );
}
