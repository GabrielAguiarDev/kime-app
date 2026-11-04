import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Box, Button, Card, Icon, Screen, StatusBadge, Text, TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, membershipLabel, useLeaveGym } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';

export function ProfileScreen() {
  const { session, userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, pending, active, isStaff, isOwner, selectGym } = useActiveGym();
  const signOut = useSignOut();
  const leave = useLeaveGym();
  const confirm = useConfirm();
  const gyms = activeMemberships(memberships);

  return (
    <Screen title="Perfil" bottomInset={false}>
      {/* Phase 2: belt color personalizes this header. */}
      <Card gap="s4" marginBottom="s32">
        <Text variant="heading">{profile?.fullName || 'Sem nome'}</Text>
        <Text variant="caption">{session?.user.email}</Text>
      </Card>

      <Box gap="s12" marginBottom="s32">
        <Text variant="captionCaps">{gyms.length > 1 ? 'Academias · toque para trocar' : 'Academia'}</Text>
        {gyms.map((m) => {
          const isActive = m.gymId === active?.gymId;
          return (
            <Card
              key={m.id}
              onPress={() => selectGym(m.gymId)}
              selected={isActive}
              disabled={isActive}
              accessibilityLabel={`${m.gymName}, ${membershipLabel(m)}`}
              flexDirection="row"
              alignItems="center"
              gap="s12"
            >
              <Box flex={1}>
                <Text variant="bodyStrong">{m.gymName}</Text>
                <Text variant="caption">{membershipLabel(m)}</Text>
              </Box>
              {isActive ? <Icon name="check" color="accent" active /> : null}
            </Card>
          );
        })}
        {pending.map((m) => (
          <Card key={m.id} flexDirection="row" alignItems="center" gap="s12">
            <Box flex={1}>
              <Text variant="bodyStrong">{m.gymName}</Text>
              <Text variant="caption">Pedido enviado · aguardando aprovação</Text>
            </Box>
            <StatusBadge status="pending" />
          </Card>
        ))}
        {/* Same code flow, already signed in (skips the account step). */}
        <Button title="Entrar em outra academia" variant="secondary" icon="plus" onPress={() => router.push('/entrar')} />
      </Box>

      <Box gap="s12" marginBottom="s32">
        <Text variant="captionCaps">Água</Text>
        <ManageCard title="Garrafa, peso e altura" onPress={() => router.push('/agua/configurar')} />
        <ManageCard title="Água de hoje e widget" onPress={() => router.push('/agua')} />
      </Box>

      {isStaff ? (
        <Box gap="s12" marginBottom="s32">
          <Text variant="captionCaps">Gestão da academia</Text>
          {isOwner ? (
            <ManageCard title="Configurações da academia" onPress={() => router.push('/academy/settings')} />
          ) : null}
          <ManageCard title="Horários das aulas" onPress={() => router.push('/academy/schedules')} />
          {isOwner ? <ManageCard title="Metas de faixa" onPress={() => router.push('/academy/belts')} /> : null}
        </Box>
      ) : null}

      {/* The owner never leaves: they transfer the academy first (Alunos → professor). */}
      {active && !isOwner ? (
        <Box marginBottom="s16">
          <TextButton
            title={`Sair de ${active.gymName}`}
            color="danger"
            disabled={leave.isPending}
            onPress={async () => {
              const ok = await confirm({
                title: 'Sair da academia?',
                message: 'Você perde o acesso às aulas e ao histórico desta academia. Para voltar, vai precisar de um novo código.',
                confirmLabel: 'Sair da academia',
                tone: 'danger',
              });
              if (ok) leave.mutate(active.id, { onError: (e) => Alert.alert('Academia', errorMessage(e)) });
            }}
          />
        </Box>
      ) : null}

      <TextButton
        title="Sair da conta"
        color="danger"
        disabled={signOut.isPending}
        onPress={async () => {
          if (await confirm(SIGN_OUT_CONFIRM)) {
            signOut.mutate(undefined, { onError: (e) => Alert.alert('Sair', errorMessage(e)) });
          }
        }}
      />
    </Screen>
  );
}

function ManageCard({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={title} flexDirection="row" alignItems="center" gap="s12">
      <Text variant="bodyStrong" flex={1}>
        {title}
      </Text>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
