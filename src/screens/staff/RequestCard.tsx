import { useState } from 'react';
import { Alert } from 'react-native';

import { Box, Button, Card, Text } from '@components';
import { useModalities } from '@domain/Classes';
import { roleLabel, useApproveStudent, useDecideMembership, type PendingRequest } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { ModalitiesSheet } from './ModalitiesSheet';

/**
 * A join request: approve or reject (always asks first). A student is approved
 * with their modalities (sheet, at least one); a professor request asks first.
 */
export function RequestCard({ request }: { request: PendingRequest }) {
  const decide = useDecideMembership();
  const approveStudent = useApproveStudent();
  const confirm = useConfirm();
  const { active } = useActiveGym();
  const modalities = useModalities(active?.gymId);
  const [picking, setPicking] = useState(false);

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

  const approveWith = (modalityIds: string[]) =>
    approveStudent.mutate(
      { membershipId: request.membershipId, modalityIds },
      {
        onSuccess: () => {
          setPicking(false);
          haptics.success();
        },
        onError: (e) => Alert.alert('Pedido', errorMessage(e)),
      },
    );

  const confirmApprove = async () => {
    if (request.role === 'student') return setPicking(true);
    const ok = await confirm({
      title: 'Aprovar professor?',
      message: `${request.fullName} poderá confirmar check-ins, aprovar alunos, cuidar dos horários e das faixas.`,
      confirmLabel: 'Aprovar',
    });
    if (ok) run(true);
  };

  const confirmReject = async () => {
    const ok = await confirm({
      title: 'Recusar pedido?',
      message: `${request.fullName} não entra na academia. Para tentar de novo, precisará enviar outro pedido.`,
      confirmLabel: 'Recusar',
      tone: 'danger',
    });
    if (ok) run(false);
  };

  const busy = decide.isPending || approveStudent.isPending;

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
          <Button title="Recusar" variant="secondary" disabled={busy} onPress={() => void confirmReject()} />
        </Box>
        <Box flex={1}>
          <Button title="Aprovar" variant="primary" loading={busy} onPress={() => void confirmApprove()} />
        </Box>
      </Box>
      <ModalitiesSheet
        visible={picking}
        title="Modalidades do aluno"
        caption={`Escolha em quais modalidades ${request.fullName} vai treinar.`}
        modalities={modalities.data ?? []}
        initial={modalities.data?.length === 1 && modalities.data[0] ? [modalities.data[0].id] : []}
        confirmLabel="Aprovar"
        loading={approveStudent.isPending}
        onConfirm={approveWith}
        onClose={() => setPicking(false)}
      />
    </Card>
  );
}
