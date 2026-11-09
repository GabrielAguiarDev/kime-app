import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Card, CodeField, Screen, Text, TextField } from '@components';
import { isValidEmail, isValidOtp, OTP_LENGTH, useRequestEmailChange, useVerifyEmailChange } from '@domain/Auth';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

/** Perfil → Meus dados → E-mail: changes the e-mail, confirmed by a code (both addresses in a secure change). */
export function ChangeEmailScreen() {
  const { session } = useSession();
  return (
    <Screen nativeHeader title="E-mail" onBack={() => router.back()}>
      <EmailSection email={session?.user.email ?? ''} />
    </Screen>
  );
}

// ----------------------------------------------------------------- e-mail ---
function EmailSection({ email }: { email: string }) {
  const request = useRequestEmailChange();
  const verify = useVerifyEmailChange();
  const [newEmail, setNewEmail] = useState('');
  // Address whose code is being typed: the new one, then (secure change) the current one.
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [done, setDone] = useState(false);

  const target = newEmail.trim().toLowerCase();
  const canRequest = isValidEmail(target) && target !== email.toLowerCase();

  const submitCode = (digits: string) => {
    if (!codeFor || !isValidOtp(digits)) return;
    verify.mutate(
      { email: codeFor, code: digits },
      {
        onSuccess: (result) => {
          setCode('');
          if (result.pendingEmail) {
            // The other address still has to confirm.
            setCodeFor(codeFor === target ? email : target);
            return;
          }
          haptics.success();
          setCodeFor(null);
          setNewEmail('');
          setDone(true);
        },
      },
    );
  };

  return (
    <Box gap="s16">
      <Card gap="s4">
        <Text variant="caption">E-mail atual</Text>
        <Text variant="bodyStrong">{email}</Text>
      </Card>
      {done ? (
        <Text variant="body" color="success">
          E-mail alterado.
        </Text>
      ) : null}

      {codeFor ? (
        <Box gap="s12">
          <Text variant="body" color="textMuted">
            {`Digite o código de ${OTP_LENGTH} dígitos que enviamos para ${codeFor}.`}
          </Text>
          <CodeField
            label="Código"
            kind="digits"
            length={OTP_LENGTH}
            value={code}
            onChangeText={setCode}
            onComplete={submitCode}
            autoFocus
            errorMessage={verify.error ? errorMessage(verify.error) : undefined}
          />
          <Button
            title="Confirmar código"
            disabled={!isValidOtp(code)}
            loading={verify.isPending}
            onPress={() => submitCode(code)}
          />
          <Button
            title="Cancelar"
            variant="secondary"
            disabled={verify.isPending}
            onPress={() => {
              setCodeFor(null);
              setCode('');
              verify.reset();
            }}
          />
        </Box>
      ) : (
        <Box gap="s12">
          <TextField
            label="Novo e-mail"
            value={newEmail}
            onChangeText={(t) => {
              setNewEmail(t);
              setDone(false);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            errorMessage={request.error ? errorMessage(request.error) : undefined}
          />
          <Button
            title="Alterar e-mail"
            variant="secondary"
            disabled={!canRequest}
            loading={request.isPending}
            onPress={() =>
              request.mutate(target, {
                onSuccess: () => {
                  verify.reset();
                  setCodeFor(target);
                },
              })
            }
          />
        </Box>
      )}
    </Box>
  );
}

