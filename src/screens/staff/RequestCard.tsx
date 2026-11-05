import { Alert } from 'react-native';

import { Box, Button, Card, Text } from '@components';
import { roleLabel, useDecideMembership, type PendingRequest } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

/** A join request: approve (professor requests ask first) or reject. */
export function RequestCard({ request }: { request: PendingRequest }) {
  const decide = useDecideMembership();
  const confirm = useConfirm();

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

  const confirmApprove = async () => {
    if (request.role !== 'instructor') return run(true);
    const ok = await confirm({
      title: 'Aprovar professor?',
      message: `${request.fullName} poderá confirmar check-ins, aprovar alunos, cuidar dos horários e das faixas.`,
      confirmLabel: 'Aprovar',
    });
    if (ok) run(true);
  };

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">{request.fullName}</Text>
        <Text variant="caption">{request.email}</Text>
        <Text variant="captionCaps" color={request.role === 'student' ? 'textMuted' : 'text'}>
          Quer entrar como {roleLabel[request.role].toLowerCase()}
        </Text>
      </Box>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button title="Recusar" variant="secondary" disabled={decide.isPending} onPress={() => run(false)} />
        </Box>
        <Box flex={1}>
          <Button title="Aprovar" variant="primary" loading={decide.isPending} onPress={confirmApprove} />
        </Box>
      </Box>
    </Card>
  );
}
