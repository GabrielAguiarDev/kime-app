import { router } from 'expo-router';
import { Alert } from 'react-native';

import { AcademyLogo, Box, Button, Card, Icon, Screen, StatusBadge, Text, TextButton } from '@components';
import { activeMemberships, membershipLabel, useLeaveGym, type Membership } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';

/**
 * Perfil → Academias (moved out of the Perfil: a student is rarely in more
 * than one): the academies (tap switches the active one), pending requests,
 * "Entrar em outra academia" and "Sair de [academia]" (not for the owner).
 */
export function AcademiesScreen() {
  const { memberships, pending, active, isOwner, selectGym } = useActiveGym();
  const leave = useLeaveGym();
  const confirm = useConfirm();
  const gyms = activeMemberships(memberships);

  return (
    <Screen nativeHeader title="Academias" onBack={() => router.back()}>
      <Box gap="s12">
      {gyms.map((m) => {
        const isActive = m.gymId === active?.gymId;
        return (
          <Card
            key={m.id}
            onPress={() => selectGym(m.gymId)}
            selected={isActive}
            disabled={isActive}
            accessibilityLabel={`${m.gymName}, ${membershipLabel(m)}${isActive ? ', academia ativa' : ', tocar para trocar'}`}
            flexDirection="row"
            alignItems="center"
            gap="s12"
          >
            <AcademyLogo name={m.gymName} url={m.gymLogoUrl} size="small" />
            <Box flex={1}>
              <Text variant="bodyStrong">{m.gymName}</Text>
              <Text variant="caption">{membershipLabel(m)}</Text>
            </Box>
            {isActive ? <Icon name="check" color="accent" active /> : null}
          </Card>
        );
      })}
      {pending.map((m) => (
        <PendingRequestCard key={m.id} membership={m} />
      ))}
      {/* Same code flow, already signed in (skips the account step). */}
      <Button title="Entrar em outra academia" variant="secondary" icon="plus" onPress={() => router.push('/entrar')} />
      {/* The owner never leaves: they transfer the academy first (Configurações). */}
      {active && !isOwner ? (
        <TextButton
          title={`Sair de ${active.gymName}`}
          color="danger"
          disabled={leave.isPending}
          onPress={async () => {
            const ok = await confirm({
              title: 'Sair da academia?',
              message:
                'Você perde o acesso às aulas e ao histórico desta academia. Para voltar, vai precisar de um novo código.',
              confirmLabel: 'Sair da academia',
              tone: 'danger',
            });
            if (ok) leave.mutate(active.id, { onError: (e) => Alert.alert('Academia', errorMessage(e)) });
          }}
        />
      ) : null}
      </Box>
    </Screen>
  );
}

/** A request still waiting: never selectable; the user may cancel it. */
function PendingRequestCard({ membership }: { membership: Membership }) {
  const cancel = useLeaveGym();
  const confirm = useConfirm();
  const name = membership.gymName || 'Academia';

  const ask = async () => {
    const ok = await confirm({
      title: 'Cancelar pedido?',
      message: `Seu pedido para a ${name} deixa de existir. Para entrar depois, use o código de novo.`,
      confirmLabel: 'Cancelar pedido',
      cancelLabel: 'Manter pedido',
      tone: 'danger',
    });
    if (ok) cancel.mutate(membership.id, { onError: (e) => Alert.alert('Pedido', errorMessage(e)) });
  };

  return (
    <Card gap="s12" accessibilityLabel={`${name}, aguardando aprovação`}>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <AcademyLogo name={name} url={membership.gymLogoUrl} size="small" />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">{name}</Text>
          <StatusBadge status="pending" label="Aguardando aprovação" />
        </Box>
      </Box>
      <TextButton title="Cancelar pedido" color="danger" disabled={cancel.isPending} onPress={ask} />
    </Card>
  );
}

