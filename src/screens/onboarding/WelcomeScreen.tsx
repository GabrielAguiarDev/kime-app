import { router } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { roleLabel } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useIsConsumingInvite } from '@services/useConsumePendingInvite';

/** Signed in without an active gym: waiting approval, or create a gym. */
export function WelcomeScreen() {
  const { pending, isError, refetch, isLoading, isFetching } = useActiveGym();
  const consumingInvite = useIsConsumingInvite();
  const signOut = useSignOut();

  // Right after sign-in: memberships still loading or the saved invite is being sent.
  if (isLoading || consumingInvite) {
    return (
      <Screen scrollable={false}>
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator accessibilityLabel="Carregando" />
        </Box>
      </Screen>
    );
  }

  const footer = (
    <>
      <Button title="Criar minha academia" onPress={() => router.push('/create-gym')} />
      <TextButton
        title="Sair"
        color="textMuted"
        disabled={signOut.isPending}
        onPress={() => signOut.mutate(undefined, { onError: (e) => Alert.alert('Sair', errorMessage(e)) })}
      />
    </>
  );

  if (isError) {
    return (
      <Screen scrollable={false} footer={footer}>
        <Box flex={1} justifyContent="center">
          <EmptyState
            icon="cloud-offline-outline"
            title="Não foi possível carregar suas academias"
            description="Verifique sua conexão."
            action={<Button title="Tentar de novo" variant="secondary" onPress={refetch} />}
          />
        </Box>
      </Screen>
    );
  }

  if (pending.length > 0) {
    return (
      <Screen title="Aguardando aprovação" footer={footer}>
        <Box gap="s12">
          <Text variant="body" color="textMuted">
            Seu pedido foi enviado. Quando o professor aprovar, a academia aparece aqui.
          </Text>
          {pending.map((m) => (
            <Card key={m.id} flexDirection="row" alignItems="center" gap="s12">
              <Icon name="time-outline" color="warning" />
              <Box flex={1}>
                <Text variant="bodyBold">{m.gymName}</Text>
                <Text variant="caption">{roleLabel[m.role]} · pendente</Text>
              </Box>
            </Card>
          ))}
          <Box marginTop="s8">
            <Button
              title="Atualizar"
              variant="secondary"
              icon="refresh"
              loading={isFetching}
              onPress={refetch}
            />
          </Box>
        </Box>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} footer={footer}>
      <Box flex={1} justifyContent="center" gap="s12">
        <Text variant="title">Bem-vindo ao Kimi</Text>
        <Text variant="body" color="textMuted">
          Professor? Cadastre sua academia e convide seus alunos.
        </Text>
        <Text variant="body" color="textMuted">
          Aluno? Abra o link de convite enviado pelo seu professor.
        </Text>
      </Box>
    </Screen>
  );
}
