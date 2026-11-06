import { router } from 'expo-router';

import { Avatar, Box, Card, Text } from '@components';
import { RANKING_CONFIG, type RankingEntry } from '@domain/Ranking';
import { useAppTheme } from '@theme';
import { missing } from '@utils/plural';

export const openTeamRanking = () => router.navigate({ pathname: '/(tabs)/team', params: { view: 'ranking' } });

/**
 * Ranking of the selected modality; opens Equipe → Ranking. Ranked: the
 * student's position and a mini podium with the top 3 photos. Qualifying:
 * the days left to enter.
 */
export function RankingCard({ entries, userId }: { entries: RankingEntry[]; userId: string }) {
  const theme = useAppTheme();
  const own = entries.find((e) => e.userId === userId);
  const podium = entries
    .filter((e) => e.status === 'ranked' && e.position !== null && e.position <= 3)
    .sort((a, b) => a.position! - b.position!);
  // Podium order: 2nd, 1st, 3rd (the winner in the middle, raised).
  const ordered = [podium[1], podium[0], podium[2]].filter((e): e is RankingEntry => !!e);
  const line = !own
    ? 'Treine e cumpra sua água para entrar no ranking.'
    : own.status === 'qualifying'
      ? `${missing(own.daysToQualify, 'dia', 'dias')} para você entrar no ranking.`
      : null;

  return (
    <Card gap="s16" onPress={openTeamRanking} accessibilityLabel="Ranking da modalidade. Abrir">
      <Text variant="captionCaps">Ranking</Text>
      <Box flexDirection="row" alignItems="center" gap="s16">
        <Box flex={1} gap="s4">
          {own?.status === 'ranked' && own.position ? (
            <Text variant="displayLg" color="accent">{`${own.position}º lugar`}</Text>
          ) : null}
          {line ? <Text variant="bodyStrong">{line}</Text> : null}
          <Text variant="caption">{`Últimos ${RANKING_CONFIG.rollingDays} dias`}</Text>
        </Box>
        {ordered.length ? (
          <Box flexDirection="row" alignItems="flex-end" gap="s4" accessible accessibilityLabel={`Pódio: ${podium.map((e) => e.fullName).join(', ')}`}>
            {ordered.map((e) => {
              const first = e.position === 1;
              return (
                <Box key={e.userId} alignItems="center" gap="s4" style={{ marginBottom: first ? theme.spacing.s12 : 0 }}>
                  <Avatar name={e.fullName} path={e.avatarPath} size={first ? 44 : 36} />
                  <Text variant="caption" color={first ? 'accent' : 'textMuted'}>{`${e.position}º`}</Text>
                </Box>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </Card>
  );
}
