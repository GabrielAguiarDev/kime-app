import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Screen, Text, TextField } from '@components';
import { isValidPassword, PASSWORD_MIN_LENGTH, useChangePassword } from '@domain/Auth';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

/** Apple-only accounts have no password yet: they set one without the current. */
export function useHasPassword() {
  const { session } = useSession();
  return (session?.user.app_metadata?.providers as string[] | undefined)?.includes('email') ?? true;
}

/** Perfil → Meus dados → Senha: changes (or, Apple-only accounts, sets) the password. */
export function ChangePasswordScreen() {
  const { session } = useSession();
  const hasPassword = useHasPassword();
  return (
    <Screen nativeHeader title={hasPassword ? 'Senha' : 'Definir senha'} onBack={() => router.back()}>
      <PasswordSection email={session?.user.email ?? ''} hasPassword={hasPassword} />
    </Screen>
  );
}

// --------------------------------------------------------------- password ---
function PasswordSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);

  const nextError = next && !isValidPassword(next) ? `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined;
  const confirmError = confirmation && confirmation !== next ? 'As senhas não são iguais.' : undefined;
  const valid = (!hasPassword || current.length > 0) && isValidPassword(next) && confirmation === next;

  return (
    <Box gap="s16">
      {hasPassword ? (
        <TextField
          label="Senha atual"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
      ) : (
        <Text variant="body" color="textMuted">
          Sua conta entra com a Apple. Defina uma senha para entrar também com e-mail.
        </Text>
      )}
      <TextField
        label="Nova senha"
        value={next}
        onChangeText={(t) => {
          setNext(t);
          setDone(false);
        }}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        errorMessage={nextError}
      />
      <TextField
        label="Confirmar nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        errorMessage={confirmError}
      />
      {change.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(change.error)}
        </Text>
      ) : null}
      {done ? (
        <Text variant="body" color="success">
          Senha alterada.
        </Text>
      ) : null}
      <Button
        title={hasPassword ? 'Alterar senha' : 'Definir senha'}
        variant="secondary"
        disabled={!valid}
        loading={change.isPending}
        onPress={() =>
          change.mutate(
            { email, currentPassword: hasPassword ? current : null, newPassword: next },
            {
              onSuccess: () => {
                haptics.success();
                setCurrent('');
                setNext('');
                setConfirmation('');
                setDone(true);
              },
            },
          )
        }
      />
    </Box>
  );
}

