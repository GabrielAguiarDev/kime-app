import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, EmptyState, Screen, Text, TextButton } from '@components';
import { useInvitePreview } from '@domain/Gym';
import { roleLabel, useRequestMembership } from '@domain/Membership';
import { errorMessage } from '@infra';
import { pendingInvite } from '@services/pendingInvite';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

/** Deep link target: kimi://convite/<token> */
export function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const { data: preview, isLoading, isError, refetch } = useInvitePreview(token);
  const request = useRequestMembership();
  const [sent, setSent] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator />
        </Box>
      </Screen>
    );
  }

  if (isError || !preview || !token) {
    return (
      <Screen scrollable={false} footer={<TextButton title="Fechar" onPress={close} />}>
        <Box flex={1} justifyContent="center">
          <EmptyState
            icon="link-outline"
            title={isError ? 'Não foi possível abrir o convite' : 'Convite inválido'}
            description={
              isError
                ? 'Verifique sua conexão e tente de novo.'
                : 'Este link não é mais válido. Peça um novo ao seu professor.'
            }
            action={isError ? <Button title="Tentar de novo" variant="secondary" onPress={() => refetch()} /> : undefined}
          />
        </Box>
      </Screen>
    );
  }

  // Visual state: request sent (celebration moment).
  if (sent) {
    return (
      <Screen scrollable={false} footer={<Button title="Continuar" onPress={() => router.replace('/')} />}>
        <Box flex={1} justifyContent="center" gap="s12">
          {/* TODO(motion): celebration entrance for the "pedido enviado" state. */}
          <Text variant="title">Pedido enviado</Text>
          <Text variant="body" color="textMuted">
            Assim que um professor da {preview.gymName} aprovar, você entra na academia.
          </Text>
        </Box>
      </Screen>
    );
  }

  const signedInActions = (
    <Button
      title="Pedir para entrar"
      loading={request.isPending}
      onPress={() =>
        request.mutate(token, {
          onSuccess: () => {
            haptics.success();
            setSent(true);
          },
        })
      }
    />
  );

  const signedOutActions = (
    <>
      <Button
        title="Criar conta"
        onPress={() => {
          pendingInvite.save(token);
          router.replace('/sign-up');
        }}
      />
      <TextButton
        title="Já tenho conta"
        onPress={() => {
          pendingInvite.save(token);
          router.replace('/sign-in');
        }}
      />
    </>
  );

  return (
    <Screen
      scrollable={false}
      footer={
        <>
          {session ? signedInActions : signedOutActions}
          <TextButton title="Agora não" color="textMuted" onPress={close} />
        </>
      }
    >
      <Box flex={1} justifyContent="center" gap="s16">
        <Text variant="label">Convite</Text>
        <Card gap="s8">
          <Text variant="title">{preview.gymName}</Text>
          <Text variant="bodyBold" color="textMuted">
            Entrar como {roleLabel[preview.role].toLowerCase()}
          </Text>
        </Card>
        <Text variant="body" color="textMuted">
          Depois do pedido, um professor da academia precisa aprovar sua entrada.
        </Text>
        {request.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(request.error)}
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
