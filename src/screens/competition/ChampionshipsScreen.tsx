import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BottomSheet, Box, Button, Card, EmptyState, Icon, Screen, Text } from '@components';
import { useAcademyToday } from '@domain/Classes';
import {
  countdownLabel,
  daysBetween,
  formatLocalDate,
  pastChampionships,
  upcomingChampionships,
  useChampionshipEntries,
  useChampionshipMutations,
  useChampionships,
  type Championship,
  type ChampionshipEntry,
} from '@domain/Competition';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

import { ChampionshipForm } from './ChampionshipForm';
import { Section } from './shared';

/** Staff: championships of the academy (upcoming and past) and "Novo campeonato". */
export function ChampionshipsScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const championships = useChampionships(academyId);
  const entries = useChampionshipEntries(academyId);
  const [creating, setCreating] = useState(false);

  if (!academyId) return null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const loading = today.isLoading || championships.isLoading;
  const list = championships.data ?? [];
  const upcoming = today.data ? upcomingChampionships(list, today.data) : [];
  const past = today.data ? pastChampionships(list, today.data) : [];

  return (
    <Screen
      nativeHeader
      title="Campeonatos"
      onBack={back}
      footer={<Button title="Novo campeonato" icon="plus" onPress={() => setCreating(true)} />}
    >
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
      {championships.isError || today.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar os campeonatos"
          action={
            <Button
              title="Tentar de novo"
              variant="secondary"
              onPress={() => {
                void championships.refetch();
                void today.refetch();
              }}
            />
          }
        />
      ) : null}

      {!loading && championships.data && today.data ? (
        list.length === 0 ? (
          <EmptyState
            title="Nenhum campeonato cadastrado."
            description="Cadastre o campeonato e inscreva os atletas da equipe. Eles veem a contagem regressiva no app e no widget."
          />
        ) : (
          <Box gap="s32">
            <Section title={`Próximos (${upcoming.length})`}>
              {upcoming.length === 0 ? (
                <Text variant="body" color="textMuted">
                  Nenhum campeonato marcado.
                </Text>
              ) : null}
              {upcoming.map((c) => (
                <ChampionshipRow key={c.id} championship={c} today={today.data} entries={entries.data ?? []} />
              ))}
            </Section>
            {past.length > 0 ? (
              <Section title="Anteriores">
                {past.map((c) => (
                  <ChampionshipRow key={c.id} championship={c} entries={entries.data ?? []} />
                ))}
              </Section>
            ) : null}
          </Box>
        )
      ) : null}

      <BottomSheet visible={creating} onRequestClose={() => setCreating(false)}>
        <CreateChampionship academyId={academyId} onDone={() => setCreating(false)} />
      </BottomSheet>
    </Screen>
  );
}

function CreateChampionship({ academyId, onDone }: { academyId: string; onDone: () => void }) {
  const { create } = useChampionshipMutations(academyId);
  return (
    <ChampionshipForm
      saving={create.isPending}
      error={create.error}
      onSave={(input) =>
        create.mutate(input, {
          onSuccess: (id) => {
            haptics.success();
            onDone();
            router.push({ pathname: '/academy/championship', params: { id } });
          },
        })
      }
    />
  );
}

function ChampionshipRow({
  championship,
  today,
  entries,
}: {
  championship: Championship;
  /** Upcoming only: shows the countdown. */
  today?: string;
  entries: ChampionshipEntry[];
}) {
  const count = entries.filter((e) => e.championshipId === championship.id).length;
  const when = today ? countdownLabel(daysBetween(today, championship.eventDate)) : null;
  const details = [
    formatLocalDate(championship.eventDate),
    championship.location || null,
    `${count} ${count === 1 ? 'atleta' : 'atletas'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card
      onPress={() => router.push({ pathname: '/academy/championship', params: { id: championship.id } })}
      accessibilityLabel={`${championship.name}. ${when ? `${when}. ` : ''}${details}`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Icon name="trophy" color={today ? 'accent' : 'textMuted'} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{championship.name}</Text>
        <Text variant="caption">{details}</Text>
        {when ? (
          <Text variant="caption" color="accent">
            {when}
          </Text>
        ) : null}
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
