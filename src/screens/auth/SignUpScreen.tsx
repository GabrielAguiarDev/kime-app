import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { isValidEmail, isValidPassword, normalizeEmail, PASSWORD_MIN_LENGTH, useSignUp } from '@domain/Auth';
import { errorMessage } from '@infra';
import { AcademyCard } from '@screens/entry/AcademyCard';

import { backToSignIn } from './backToSignIn';
import { usePendingAcademy } from './usePendingAcademy';

export function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useSignUp();
  // With a confirmed code, the join request goes out right after sign-up.
  const academy = usePendingAcademy();

  const nameOk = fullName.trim().length >= 2;
  const canSubmit = nameOk && isValidEmail(email) && isValidPassword(password);

  return (
    <Screen
      title="Criar conta"
      onBack={backToSignIn}
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
            // Swaps for the sign-in in the same stack: back still returns to the code.
            onPress={() => router.replace('/sign-in')}
          />
        </>
      }
    >
      <Box gap="s16">
        {academy ? (
          <AcademyCard
            gymName={academy.gymName}
            logoUrl={academy.logoUrl}
            codeType={academy.codeType}
            caption="Você vai pedir para entrar em"
          />
        ) : null}
        <Text variant="body" color="textMuted">
          {academy
            ? 'Crie sua conta para pedir entrada na academia.'
            : 'Crie sua conta. Depois você entra numa academia com o código de convite ou cadastra a sua.'}
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
