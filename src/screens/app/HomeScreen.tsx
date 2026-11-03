import { Box, Card, EmptyState, Screen, Text } from '@components';
import { roleLabel } from '@domain/Membership';
import { useMyProfile } from '@domain/Profile';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

export function HomeScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { data: profile } = useMyProfile(userId);
  const firstName = profile?.fullName.split(' ')[0];

  return (
    <Screen bottomInset={false}>
      <Box gap="s4" marginBottom="s24">
        <Text variant="captionCaps">{active ? `${active.gymName} · ${roleLabel[active.role]}` : ''}</Text>
        <Text variant="title">{firstName ? `Olá, ${firstName}` : 'Olá'}</Text>
      </Box>
      {/* Phase 2+: class progress, water and countdown cards land here. */}
      <Card>
        <EmptyState
          visual="icon"
          icon="barbell"
          title="Seu progresso aparece aqui"
          description="Aulas, faixa e sequência semanal chegam na próxima etapa."
        />
      </Card>
    </Screen>
  );
}
