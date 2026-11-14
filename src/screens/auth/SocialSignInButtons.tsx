import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { Box, Button } from '@components';
import { authService, useSignInWithApple, useSignInWithGoogle } from '@domain/Auth';
import { errorMessage } from '@infra';

/**
 * Sign in with Apple (iOS, where available) and with Google (when configured).
 * Both available: side by side with short titles. Only one: full width.
 */
export function SocialSignInButtons() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = authService.isGoogleSignInAvailable();
  const apple = useSignInWithApple();
  const google = useSignInWithGoogle();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  if (!appleAvailable && !googleAvailable) return null;

  const both = appleAvailable && googleAvailable;
  const busy = apple.isPending || google.isPending;
  const onError = (e: unknown) => Alert.alert('Entrar', errorMessage(e));

  const appleButton = appleAvailable ? (
    <Button
      title={both ? 'Apple' : 'Continuar com Apple'}
      accessibilityLabel="Continuar com Apple"
      variant="secondary"
      icon="apple"
      loading={apple.isPending}
      disabled={busy && !apple.isPending}
      onPress={() => apple.mutate(undefined, { onError })}
    />
  ) : null;

  const googleButton = googleAvailable ? (
    <Button
      title={both ? 'Google' : 'Continuar com Google'}
      accessibilityLabel="Continuar com Google"
      variant="secondary"
      icon="google"
      loading={google.isPending}
      disabled={busy && !google.isPending}
      onPress={() => google.mutate(undefined, { onError })}
    />
  ) : null;

  if (!both) return appleButton ?? googleButton;

  return (
    <Box flexDirection="row" gap="s12">
      <Box flex={1}>{googleButton}</Box>
      <Box flex={1}>{appleButton}</Box>
    </Box>
  );
}
