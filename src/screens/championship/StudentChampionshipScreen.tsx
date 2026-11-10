import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { BeltChip, BigCounter, Box, Card, EmptyState, LoadError, PersonRow, Screen, Text } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { daysBetween, formatLocalDate, useChampionships } from '@domain/Competition';
import { useChampionshipCompetitors } from '@domain/Team';
import { ResultLine } from '@screens/competition/FightRecord';
import { LinkRow } from '@screens/competition/shared';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useOpenPerson } from '@screens/team/useOpenPerson';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * A championship seen by a student of its modality (read only): name, date,
 * place, the countdown in display-xl and "Quem vai lutar" (photo, name, belt;
 * a row opens the member). Once held, the list becomes "Resultados": placement
 * and the tally of each athlete. Entered competitors can open their diet and log weight.
 */
export function StudentChampionshipScreen() {
  const openPerson = useOpenPerson();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const championships = useChampionships(academyId);
  const today = useAcademyToday(academyId);
  const competitors = useChampionshipCompetitors(id);
  const championship = championships.data?.find((c) => c.id === id);

  if (championships.isLoading || today.isLoading || !academyId) {
    return (
      <Screen nativeHeader title=" " onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (championships.isError || today.isError) {
    return (
      <Screen nativeHeader title="Campeonato" onBack={back}>
        <LoadError
          title="Não foi possível carregar o campeonato"
          onRetry={() => {
            void championships.refetch();
            void today.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!championship || !today.data) {
    return (
      <Screen nativeHeader title="Campeonato" onBack={back}>
        <EmptyState title="Campeonato não encontrado." description="Ele pode ter sido removido pelo professor." />
      </Screen>
    );
  }

  const days = daysBetween(today.data, championship.eventDate);
  const people = competitors.data ?? [];
  const entered = people.some((p) => p.userId === userId);
  const held = days < 0;

  return (
    <Screen nativeHeader title={championship.name} onBack={back}>
      <Box gap="s24">
        <Card gap="s16" alignItems="center">
          {days === 0 ? (
            // TODO(motion): countdown reaching zero (championship day).
            <Box alignItems="center" accessible accessibilityLabel="O campeonato é hoje">
              <Text variant="displayXl" color="accent">
                HOJE
              </Text>
              <Text variant="captionCaps">Dia de campeonato</Text>
            </Box>
          ) : days > 0 ? (
            <BigCounter value={days} label={days === 1 ? 'Dia para o campeonato' : 'Dias para o campeonato'} />
          ) : (
            <Text variant="captionCaps">Campeonato realizado</Text>
          )}
          <Text variant="caption" textAlign="center">
            {[formatLocalDate(championship.eventDate), championship.location || null].filter(Boolean).join(' · ')}
          </Text>
        </Card>

        {entered && userId ? <CompetitorActions /> : null}

        <Box gap="s8">
          <Text variant="captionCaps">{held ? 'Resultados' : 'Quem vai lutar'}</Text>
          {competitors.isLoading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
          {competitors.isError ? (
            <LoadError title="Não foi possível carregar os inscritos" onRetry={() => void competitors.refetch()} />
          ) : null}
          {competitors.data && people.length === 0 ? (
            <Text variant="body" color="textMuted">
              O professor ainda não inscreveu ninguém.
            </Text>
          ) : null}
          {people.length ? (
            <Card>
              {people.map((p, index) => (
                <PersonRow
                  key={p.userId}
                  name={p.userId === userId ? `${p.fullName} (você)` : p.fullName}
                  avatarPath={p.avatarPath}
                  last={index === people.length - 1}
                  secondary={
                    held ? (
                      <Box flexDirection="row" alignItems="center" gap="s8">
                        {p.belt ? <BeltChip belt={p.belt} /> : null}
                        <ResultLine placement={p.placement} tally={p.tally} />
                      </Box>
                    ) : p.belt ? (
                      <BeltChip belt={p.belt} />
                    ) : undefined
                  }
                  onPress={openPerson(p.userId)}
                />
              ))}
            </Card>
          ) : null}
        </Box>
      </Box>
    </Screen>
  );
}

function CompetitorActions() {
  return (
    <Box gap="s12">
      <LinkRow title="Dieta" description="Veja as refeições e registre o que cumpriu" icon="diet" onPress={() => router.push('/dieta')} />
      <LinkRow title="Registrar peso" description="Acompanhe suas pesagens para o campeonato" icon="trophy" onPress={() => router.push('/peso')} />
    </Box>
  );
}
