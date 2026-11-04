import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Box, Button, CodeField, Screen, Text, TextButton } from '@components';
import { isValidOtp, OTP_LENGTH, useResendSignUpCode, useVerifyEmailCode } from '@domain/Auth';
import { errorMessage } from '@infra';
import { haptics } from '@utils/haptics';

/** Supabase allows one confirmation e-mail per address every 60 s. */
const RESEND_COOLDOWN_S = 60;

/** Sign-up confirmation with the code sent by e-mail (no link / deep link). */
export function VerifyEmailScreen() {
  const { email = '', sent } = useLocalSearchParams<{ email: string; sent?: string }>();
  const [code, setCode] = useState('');
  const verify = useVerifyEmailCode();
  const resend = useResendSignUpCode();
  // Coming from sign-up the code was just sent; from sign-in it may be old.
  const [cooldown, setCooldown] = useState(sent === '1' ? RESEND_COOLDOWN_S : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const error = verify.error ?? resend.error;

  // Success opens the session: the root guard moves on by itself.
  const submit = (digits: string) =>
    verify.mutate({ email, code: digits }, { onSuccess: () => haptics.success() });

  return (
    <Screen
      title="Confirme seu e-mail"
      // Arrow at the top instead of a footer button: no accidental taps next to
      // the primary action. Progress is not lost anyway: signing in or signing up
      // again with the same e-mail comes back here.
      onBack={() => router.replace('/sign-in')}
      footer={
        <>
          <Button
            title="Confirmar"
            disabled={!isValidOtp(code)}
            loading={verify.isPending}
            onPress={() => submit(code)}
          />
          <TextButton
            title={cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
            disabled={cooldown > 0 || resend.isPending}
            onPress={() => resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_S) })}
          />
        </>
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          Enviamos um código de {OTP_LENGTH} dígitos para {email}. Digite-o abaixo para ativar sua conta.
        </Text>
        <CodeField
          label="Código"
          value={code}
          onChangeText={(digits) => {
            setCode(digits);
            if (verify.isError) verify.reset();
          }}
          // Pasted / autofilled code submits on its own.
          onComplete={(digits) => {
            if (!verify.isPending) submit(digits);
          }}
          length={OTP_LENGTH}
          autoFocus
          errorMessage={error ? errorMessage(error) : undefined}
        />
        {resend.isSuccess && !resend.isPending ? (
          <Text variant="caption" color="textMuted">
            Código reenviado. Confira também a caixa de spam.
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
