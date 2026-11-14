import { router } from 'expo-router';

import { Box, Card, EmptyState, Icon, LoadError, Screen, Text, Spinner } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { countdownLabel, daysBetween, formatLocalDate, upcomingChampionships, useChampionships } from '@domain/Competition';
import { openChampionship } from '@screens/student/home/ChampionshipCard';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Upcoming championships of the selected modality ("Ver todos" on Início). */
export function StudentChampionshipsScreen() {
  const { active } = useActiveGym();
  const { selected } = useActiveModality();
  const championships = useChampionships(active?.gymId);
  const today = useAcademyToday(active?.gymId);

  const loading = championships.isLoading || today.isLoading;
  const list =
    championships.data && today.data
      ? upcomingChampionships(championships.data.filter((c) => c.modalityId === selected?.id), today.data)
      : [];

  return (
    <Screen nativeHeader title="Campeonatos" onBack={back}>
      {loading ? <Spinner accessibilityLabel="Carregando" /> : null}
      {championships.isError || today.isError ? (
        <LoadError title="Não foi possível carregar os campeonatos" onRetry={() => void championships.refetch()} />
      ) : null}
      {!loading && championships.data && list.length === 0 ? (
        <EmptyState visual="icon" icon="trophy" title="Nenhum campeonato marcado." />
      ) : null}
      <Box gap="s12">
        {list.map((c) => {
          const when = countdownLabel(daysBetween(today.data!, c.eventDate));
          const details = [formatLocalDate(c.eventDate), c.location || null].filter(Boolean).join(' · ');
          return (
            <Card
              key={c.id}
              flexDirection="row"
              alignItems="center"
              gap="s12"
              onPress={() => openChampionship(c.id)}
              accessibilityLabel={`${c.name}. ${details}. ${when}`}
            >
              <Icon name="trophy" color="accent" />
              <Box flex={1} gap="s4">
                <Text variant="bodyStrong">{c.name}</Text>
                <Text variant="caption">{details}</Text>
              </Box>
              <Text variant="caption" color="accent">
                {when}
              </Text>
            </Card>
          );
        })}
      </Box>
    </Screen>
  );
}
