import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { isValidEmail, normalizeEmail, useSignIn } from '@domain/Auth';
import { AppError, errorMessage } from '@infra';
import { AcademyCard } from '@screens/entry/AcademyCard';
import { entryPath } from '@services/entry';

import { AppleSignInButton } from './AppleSignInButton';
import { usePendingAcademy } from './usePendingAcademy';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useSignIn();
  const academy = usePendingAcademy();
  const [asProfessor] = useState(() => entryPath.get() === 'instructor');

  const canSubmit = isValidEmail(email) && password.length > 0;

  return (
    // First screen when signed out (no back); pushed from the code screen, back returns to it.
    <Screen
      onBack={router.canGoBack() ? () => router.back() : undefined}
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
        {academy ? (
          <AcademyCard
            gymName={academy.gymName}
            logoUrl={academy.logoUrl}
            codeType={academy.codeType}
            caption="Você vai pedir para entrar em"
          />
        ) : (
          <>
            <Text variant="displayXl">KIMI</Text>
            <Text variant="heading">
              {asProfessor ? 'Entre para cuidar das suas aulas.' : 'Entre para ver seus treinos.'}
            </Text>
          </>
        )}
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
