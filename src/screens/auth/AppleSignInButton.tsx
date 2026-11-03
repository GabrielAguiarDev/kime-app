import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { Button } from '@components';
import { useSignInWithApple } from '@domain/Auth';
import { errorMessage } from '@infra';

/** Rendered only where Sign in with Apple is available (iOS). */
export function AppleSignInButton() {
  const [available, setAvailable] = useState(false);
  const { mutate, isPending } = useSignInWithApple();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAvailable);
    }
  }, []);

  if (!available) return null;

  return (
    <Button
      title="Continuar com Apple"
      variant="secondary"
      icon="apple"
      loading={isPending}
      onPress={() => mutate(undefined, { onError: (e) => Alert.alert('Entrar', errorMessage(e)) })}
    />
  );
}
