import { Alert, Pressable } from 'react-native';

import { Box, Card, Icon, Screen, Text, TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, roleLabel } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

export function ProfileScreen() {
  const { session, userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, active, selectGym } = useActiveGym();
  const signOut = useSignOut();
  const gyms = activeMemberships(memberships);

  return (
    <Screen title="Perfil" bottomInset={false}>
      {/* Phase 2: belt color personalizes this header. */}
      <Card gap="s4" marginBottom="s32">
        <Text variant="heading">{profile?.fullName || 'Sem nome'}</Text>
        <Text variant="caption">{session?.user.email}</Text>
      </Card>

      <Box gap="s12" marginBottom="s32">
        <Text variant="label">{gyms.length > 1 ? 'Academias · toque para trocar' : 'Academia'}</Text>
        {gyms.map((m) => {
          const isActive = m.gymId === active?.gymId;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => selectGym(m.gymId)}
              disabled={isActive}
            >
              <Card flexDirection="row" alignItems="center" gap="s12" borderColor={isActive ? 'primary' : 'border'}>
                <Box flex={1}>
                  <Text variant="bodyBold">{m.gymName}</Text>
                  <Text variant="caption">{roleLabel[m.role]}</Text>
                </Box>
                {isActive ? <Icon name="checkmark-circle" color="primary" /> : null}
              </Card>
            </Pressable>
          );
        })}
      </Box>

      <TextButton
        title="Sair da conta"
        color="danger"
        disabled={signOut.isPending}
        onPress={() => signOut.mutate(undefined, { onError: (e) => Alert.alert('Sair', errorMessage(e)) })}
      />
    </Screen>
  );
}
