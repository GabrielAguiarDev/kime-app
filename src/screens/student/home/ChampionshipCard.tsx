import { router } from 'expo-router';

import { Avatar, Box, Card, Icon, Text, TextButton } from '@components';
import type { LocalDate } from '@domain/Classes';
import { countdownLabel, daysBetween, formatLocalDate, type Championship } from '@domain/Competition';
import { useChampionshipCompetitors } from '@domain/Team';

export const openChampionship = (id: string) => router.push({ pathname: '/campeonato', params: { id } });

/**
 * Nearest championship of the selected modality (registered by staff, not
 * held yet): name, date, days to go and the photos of who is entered.
 * "Torça pela equipe" for spectators. "Ver todos" when there are more.
 */
export function ChampionshipCard({
  championships,
  today,
  userId,
}: {
  /** Upcoming championships of the modality, nearest first (at least one). */
  championships: Championship[];
  today: LocalDate;
  userId: string;
}) {
  const next = championships[0]!;
  const competitors = useChampionshipCompetitors(next.id);
  const people = competitors.data ?? [];
  const entered = people.some((p) => p.userId === userId);
  const days = daysBetween(today, next.eventDate);

  return (
    <Box gap="s8">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">Campeonato</Text>
        {championships.length > 1 ? (
          <TextButton title="Ver todos" fullWidth={false} onPress={() => router.push('/campeonatos')} />
        ) : null}
      </Box>
      <Card gap="s12" onPress={() => openChampionship(next.id)} accessibilityLabel={`${next.name}. ${countdownLabel(days)}. Abrir`}>
        <Box flexDirection="row" alignItems="center" gap="s12">
          <Icon name="trophy" color="accent" active />
          <Box flex={1} gap="s4">
            <Text variant="bodyStrong">{next.name}</Text>
            <Text variant="caption">{formatLocalDate(next.eventDate)}</Text>
          </Box>
          <Text variant="bodyStrong" color="accent">
            {countdownLabel(days)}
          </Text>
        </Box>
        {people.length ? (
          <Box flexDirection="row" alignItems="center" gap="s8">
            <Box flexDirection="row">
              {people.slice(0, 5).map((p, index) => (
                <Box key={p.userId} style={{ marginLeft: index ? -10 : 0 }}>
                  <Avatar name={p.fullName} path={p.avatarPath} size={32} />
                </Box>
              ))}
            </Box>
            <Text variant="caption">
              {people.length === 1 ? '1 competidor inscrito' : `${people.length} competidores inscritos`}
            </Text>
          </Box>
        ) : null}
        {!entered ? <Text variant="bodyStrong">Torça pela equipe</Text> : null}
      </Card>
    </Box>
  );
}
