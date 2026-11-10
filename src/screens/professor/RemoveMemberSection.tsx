import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { Box, Text, TextButton } from '@components';
import { useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

/**
 * "Remover da academia", at the end in its own area (owner only; never the
 * owner nor yourself). The list in Equipe has no remove button. `children`
 * are other sensitive actions shown above it (e.g. transfer the academy).
 */
export function RemoveMemberSection({ member, children }: { member: GymMember; children?: ReactNode }) {
  const { isOwner } = useActiveGym();
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const confirm = useConfirm();
  const { border } = useAppTheme();
  if (!isOwner || member.role === 'owner' || member.userId === userId) return null;

  const ask = async () => {
    const ok = await confirm({
      title: 'Remover da academia?',
      message: `${member.fullName} perde o acesso à academia. O histórico de aulas fica guardado.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!ok) return;
    remove.mutate(member.id, {
      onSuccess: () => router.back(),
      onError: (e) => Alert.alert('Remover', errorMessage(e)),
    });
  };

  return (
    <Box gap="s12" marginTop="s24" paddingTop="s24" borderTopWidth={border.width} borderColor="border">
      <Text variant="captionCaps">Ações sensíveis</Text>
      {children}
      <TextButton title="Remover da academia" color="danger" disabled={remove.isPending} onPress={ask} />
    </Box>
  );
}
