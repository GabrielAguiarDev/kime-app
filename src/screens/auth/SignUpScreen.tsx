import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { isValidEmail, isValidPassword, normalizeEmail, PASSWORD_MIN_LENGTH, useSignUp } from '@domain/Auth';
import { errorMessage } from '@infra';
import { pendingInvite } from '@services/pendingInvite';

export function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useSignUp();
  // Without an invite, sign-up leads to creating a gym (professor).
  const [hasInvite] = useState(() => !!pendingInvite.get());

  const nameOk = fullName.trim().length >= 2;
  const canSubmit = nameOk && isValidEmail(email) && isValidPassword(password);

  return (
    <Screen
      title="Criar conta"
      footer={
        <>
          <Button
            title="Criar conta"
            disabled={!canSubmit}
            loading={isPending}
            onPress={() =>
              mutate(
                { fullName, email, password },
                {
                  // signed_in: the root guard moves on by itself.
                  onSuccess: (result) => {
                    if (result === 'needs_confirmation') {
                      router.replace({
                        pathname: '/verify-email',
                        params: { email: normalizeEmail(email), sent: '1' },
                      });
                    }
                  },
                },
              )
            }
          />
          <TextButton
            title="Já tenho conta"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
          />
        </>
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          {hasInvite
            ? 'Crie sua conta para pedir entrada na academia.'
            : 'Crie sua conta e cadastre sua academia. É aluno? Abra o link de convite enviado pelo seu professor.'}
        </Text>
        <TextField
          label="Nome"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
          errorMessage={error ? errorMessage(error) : undefined}
        />
      </Box>
    </Screen>
  );
}
