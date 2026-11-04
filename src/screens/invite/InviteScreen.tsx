import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AcademyLogo, Box, Button, Card, EmptyState, FeedbackSheet, Screen, Text, TextButton } from '@components';
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
  // The preview RPC is not exposed to anon: signed out, the academy name shows after sign-in.
  const { data: preview, isLoading, isError, refetch } = useInvitePreview(session ? token : undefined);
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

  if (!token || (session && (isError || !preview))) {
    return (
      <Screen scrollable={false} footer={<TextButton title="Fechar" onPress={close} />}>
        <Box flex={1} justifyContent="center">
          <EmptyState
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

  // Visual state: request sent (celebration moment) — feedback sheet at the bottom.
  const sentFeedback = sent ? (
    <FeedbackSheet
      tone="success"
      title="Pedido enviado"
      message={`Assim que um professor da ${preview?.gymName ?? 'academia'} aprovar, você entra na academia.`}
      actionLabel="Continuar"
      onAction={() => router.replace('/')}
    />
  ) : undefined;

  return (
    <Screen
      scrollable={false}
      feedback={sentFeedback}
      footer={
        <>
          {session ? signedInActions : signedOutActions}
          <TextButton title="Agora não" onPress={close} />
        </>
      }
    >
      <Box flex={1} justifyContent="center" gap="s16">
        <Text variant="captionCaps">Convite</Text>
        <Card flexDirection="row" alignItems="center" gap="s16">
          {preview ? <AcademyLogo name={preview.gymName} url={preview.logoUrl} /> : null}
          <Box flex={1} gap="s8">
            <Text variant="title">{preview?.gymName ?? 'Convite para uma academia'}</Text>
            <Text variant="bodyStrong" color="textMuted">
              {preview
                ? `Entrar como ${roleLabel[preview.role].toLowerCase()}`
                : 'Entre ou crie sua conta para ver o convite.'}
            </Text>
          </Box>
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
