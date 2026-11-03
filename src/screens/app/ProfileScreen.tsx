import { Alert } from 'react-native';

import { Box, Card, Icon, Screen, Text, TextButton, type IconName } from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, roleLabel } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useAppearancePreference, type AppearancePreference } from '@services/appearance';
import { useSession } from '@services/session';

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string; icon: IconName }[] = [
  { value: 'dark', label: 'Escuro', icon: 'dark' },
  { value: 'light', label: 'Claro', icon: 'light' },
  { value: 'system', label: 'Seguir o sistema', icon: 'device' },
];

export function ProfileScreen() {
  const { session, userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, active, selectGym } = useActiveGym();
  const signOut = useSignOut();
  const gyms = activeMemberships(memberships);
  const [appearance, setAppearance] = useAppearancePreference();

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
              accessibilityLabel={`${m.gymName}, ${roleLabel[m.role]}`}
              flexDirection="row"
              alignItems="center"
              gap="s12"
            >
              <Box flex={1}>
                <Text variant="bodyStrong">{m.gymName}</Text>
                <Text variant="caption">{roleLabel[m.role]}</Text>
              </Box>
              {isActive ? <Icon name="check" color="accent" active /> : null}
            </Card>
          );
        })}
      </Box>

      <Box gap="s12" marginBottom="s32">
        <Text variant="captionCaps">Aparência</Text>
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = option.value === appearance;
          return (
            <Card
              key={option.value}
              onPress={() => setAppearance(option.value)}
              selected={selected}
              disabled={selected}
              accessibilityLabel={`Tema ${option.label}`}
              flexDirection="row"
              alignItems="center"
              gap="s12"
            >
              <Icon name={option.icon} color={selected ? 'accent' : 'textMuted'} active={selected} />
              <Text variant="bodyStrong" flex={1}>
                {option.label}
              </Text>
              {selected ? <Icon name="check" color="accent" active /> : null}
            </Card>
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
