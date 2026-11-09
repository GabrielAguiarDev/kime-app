import { useEffect } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { AcademyLogo, Box, Card, KimiMascot, Screen, StatusBadge, Text, TextButton } from '@components';
import { useLeaveGym } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useSession } from '@services/session';

import { AccountHeader } from './AccountHeader';
import { SignedInFooter } from './SignedInFooter';

/** While waiting, check the request every so often (and on every return to the app). */
const WAITING_REFRESH_MS = 15_000;

/**
 * /aguardando — signed in with a pending request and no approved membership
 * (student or professor code). Refreshes by itself: an approval flips the
 * guard to the tabs; a rejection or "Cancelar pedido" back to the academy
 * code (/academia), which shows the rejection notice.
 */
export function WaitingScreen() {
  const { userId } = useSession();
  const { memberships, pending, refetch } = useActiveGym();
  // Remembers the academy names: a rejected request loses access to its name.
  useJoinRequestNotices(userId, memberships);
  const cancel = useLeaveGym();
  const confirm = useConfirm();
  const [first, ...others] = pending;

  useEffect(() => {
    const id = setInterval(refetch, WAITING_REFRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // Between the cancel and the guard moving on.
  if (!first) {
    return (
      <Screen scrollable={false}>
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator accessibilityLabel="Carregando" />
        </Box>
      </Screen>
    );
  }

  const approver = first.role === 'student' ? 'do professor' : 'do proprietário';
  const ask = async () => {
    const ok = await confirm({
      title: 'Cancelar pedido?',
      message:
        pending.length === 1
          ? `Seu pedido para a ${first.gymName || 'academia'} deixa de existir. Você volta para o código da academia.`
          : 'Seus pedidos deixam de existir. Você volta para o código da academia.',
      confirmLabel: 'Cancelar pedido',
      cancelLabel: 'Manter pedido',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      // Every pending request: the guard only moves on when none is left.
      await Promise.all(pending.map((m) => cancel.mutateAsync(m.id)));
    } catch (e) {
      Alert.alert('Pedido', errorMessage(e));
    }
  };

  return (
    <Screen
      scrollable={false}
      header={<AccountHeader />}
      footer={
        <>
          <TextButton title="Cancelar pedido" disabled={cancel.isPending} onPress={() => void ask()} />
          <SignedInFooter />
        </>
      }
    >
      <Box flex={1} justifyContent="center" alignItems="center" gap="s16">
        <AcademyLogo name={first.gymName} url={first.gymLogoUrl} />
        <Text variant="title" textAlign="center">
          {first.gymName}
        </Text>
        <KimiMascot size="empty" />
        <Text variant="body" color="textMuted" textAlign="center">
          Pedido enviado. Aguardando aprovação {approver}.
        </Text>
        {others.map((m) => (
          <Card key={m.id} flexDirection="row" alignItems="center" gap="s12" alignSelf="stretch">
            <AcademyLogo name={m.gymName} url={m.gymLogoUrl} size="small" />
            <Text variant="bodyStrong" flex={1}>
              {m.gymName}
            </Text>
            <StatusBadge status="pending" />
          </Card>
        ))}
      </Box>
    </Screen>
  );
}
