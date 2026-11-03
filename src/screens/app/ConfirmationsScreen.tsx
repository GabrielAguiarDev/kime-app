import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, EmptyState, Screen, Text } from '@components';
import { roleLabel, useDecideMembership, usePendingRequests, type PendingRequest } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

/** Professor inbox. Phase 1: join requests. Phase 2 adds class check-ins. */
export function ConfirmationsScreen() {
  const { active } = useActiveGym();
  const requests = usePendingRequests(active?.gymId);

  return (
    <Screen title="Confirmações" bottomInset={false}>
      <Box gap="s12">
        <Text variant="label">Pedidos de entrada</Text>
        {requests.isLoading ? <ActivityIndicator /> : null}
        {requests.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Não foi possível carregar os pedidos"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => requests.refetch()} />}
          />
        ) : null}
        {requests.data?.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title="Tudo em dia" description="Nenhum pedido pendente." />
        ) : null}
        {requests.data?.map((request) => (
          <RequestCard key={request.membershipId} request={request} />
        ))}
      </Box>
    </Screen>
  );
}

function RequestCard({ request }: { request: PendingRequest }) {
  const decide = useDecideMembership();

  const run = (approve: boolean) =>
    decide.mutate(
      { membershipId: request.membershipId, approve },
      {
        onSuccess: () => {
          if (approve) haptics.success();
        },
        onError: (e) => Alert.alert('Pedido', errorMessage(e)),
      },
    );

  const confirmApprove = () => {
    if (request.role !== 'professor') return run(true);
    Alert.alert(
      'Aprovar professor?',
      `${request.fullName} poderá aprovar alunos e gerenciar a academia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: () => run(true) },
      ],
    );
  };

  return (
    <Card gap="s12">
      <Box gap="s2">
        <Text variant="heading">{request.fullName}</Text>
        <Text variant="caption">{request.email}</Text>
        <Text variant="label" color={request.role === 'professor' ? 'warning' : 'textMuted'}>
          Quer entrar como {roleLabel[request.role].toLowerCase()}
        </Text>
      </Box>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button title="Recusar" variant="secondary" disabled={decide.isPending} onPress={() => run(false)} />
        </Box>
        <Box flex={1}>
          <Button title="Aprovar" variant="success" loading={decide.isPending} onPress={confirmApprove} />
        </Box>
      </Box>
    </Card>
  );
}
