import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Box, Card, Icon, Screen, Text, TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, membershipLabel } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';

export function ProfileScreen() {
  const { session, userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, active, role, selectGym } = useActiveGym();
  const signOut = useSignOut();
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
      </Box>

      {role === 'professor' ? (
        <Box gap="s12" marginBottom="s32">
          <Text variant="captionCaps">Gestão da academia</Text>
          <ManageCard title="Configurações da academia" onPress={() => router.push('/academy/settings')} />
          <ManageCard title="Horários das aulas" onPress={() => router.push('/academy/schedules')} />
          <ManageCard title="Metas de faixa" onPress={() => router.push('/academy/belts')} />
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
