import { router } from 'expo-router';
import { useNavigationState, useRoute } from 'expo-router/react-navigation';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Box, Button, Screen, Text, TextButton, TextField } from '@components';
import { isValidEmail, normalizeEmail, useSignIn } from '@domain/Auth';
import { AppError, errorMessage } from '@infra';
import { AcademyCard } from '@screens/entry/AcademyCard';
import { entryPath } from '@services/entry';

import { SocialSignInButtons } from './SocialSignInButtons';
import { SignInHero, SignInWave } from './SignInArt';
import { usePendingAcademy } from './usePendingAcademy';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useSignIn();
  const academy = usePendingAcademy();
  const [asProfessor] = useState(() => entryPath.get() === 'instructor');

  const canSubmit = isValidEmail(email) && password.length > 0;

  // Reactive (router.canGoBack() is read once per render: after sign-up → back it kept
  // the arrow). Back only when a screen sits BELOW this one (e.g. the code screen).
  const route = useRoute();
  const hasScreenBelow = useNavigationState((state) => state.routes.findIndex((r) => r.key === route.key) > 0);

  return (
    // First screen when signed out (no back); pushed from the code screen, back returns to it.
    <Screen
      onBack={hasScreenBelow ? () => router.back() : undefined}
    >
      <SignInWave />
      <Box flex={1} justifyContent={academy ? 'center' : 'flex-start'} gap="s16">
        {academy ? (
          <AcademyCard
            gymName={academy.gymName}
            logoUrl={academy.logoUrl}
            codeType={academy.codeType}
            caption="Você vai pedir para entrar em"
          />
        ) : (
          <Box marginTop="s48" marginBottom="s16">
            <SignInHero>
              <Text variant="displayXl">KIMI</Text>
              <Text variant="bodyStrong">
                {asProfessor ? 'Entre para cuidar das suas aulas.' : 'Entre para ver seus treinos.'}
              </Text>
            </SignInHero>
          </Box>
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
      {/* Actions inside the scroll (not a fixed footer): they move with the content.
          Android: same extra room above the system bar as the fixed footers (Screen). */}
      <Box gap="s12" marginTop="s24" marginBottom={Platform.OS === 'android' ? 's16' : undefined}>
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
        <SocialSignInButtons />
        <TextButton title="Criar conta" onPress={() => router.push('/sign-up')} />
      </Box>
    </Screen>
  );
}
