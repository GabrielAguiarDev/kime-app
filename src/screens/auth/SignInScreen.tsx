import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { isValidEmail, normalizeEmail, useSignIn } from '@domain/Auth';
import { AppError, errorMessage } from '@infra';

import { AppleSignInButton } from './AppleSignInButton';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useSignIn();

  const canSubmit = isValidEmail(email) && password.length > 0;

  return (
    <Screen
      footer={
        <>
          <Button
            title="Entrar"
            disabled={!canSubmit}
            loading={isPending}
            onPress={() =>
              mutate(
                { email, password },
                {
                  onError: (e) => {
                    // Signed up but never typed the code: finish the confirmation.
                    if (e instanceof AppError && e.code === 'email_not_confirmed') {
                      router.push({ pathname: '/verify-email', params: { email: normalizeEmail(email) } });
                    }
                  },
                },
              )
            }
          />
          <AppleSignInButton />
          <TextButton title="Criar conta" onPress={() => router.push('/sign-up')} />
        </>
      }
    >
      <Box flex={1} justifyContent="center" gap="s16">
        <Text variant="displayXl">KIMI</Text>
        <Text variant="heading">Entre para ver seus treinos.</Text>
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          errorMessage={error ? errorMessage(error) : undefined}
        />
      </Box>
    </Screen>
  );
}
