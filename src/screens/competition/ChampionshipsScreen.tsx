import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BottomSheet, Box, Button, Card, EmptyState, Icon, LoadError, Screen, Text } from '@components';
import { useAcademyToday, useModalities, type Modality } from '@domain/Classes';
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
import { ModalityFilter } from '@screens/staff/ModalityFilter';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

import { ChampionshipForm } from './ChampionshipForm';
import { Section } from './shared';

/** Staff: championships of the academy (upcoming and past) and "Novo campeonato". */
export function ChampionshipsScreen() {
  const { active } = useActiveGym();
  const [creating, setCreating] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!active) {
    return (
      <Screen nativeHeader title="Campeonatos" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  return (
    <Screen
      nativeHeader
      title="Campeonatos"
      onBack={back}
      footer={<Button title="Novo campeonato" icon="plus" onPress={() => setCreating(true)} />}
    >
      <ChampionshipsView academyId={active.gymId} />
      <BottomSheet visible={creating} onRequestClose={() => setCreating(false)}>
        <CreateChampionship academyId={active.gymId} onDone={() => setCreating(false)} />
      </BottomSheet>
    </Screen>
  );
}

/** The championship list (upcoming with countdown, past), filtered by modality ("Todas" by default). */
export function ChampionshipsView({ academyId }: { academyId: string }) {
  const today = useAcademyToday(academyId);
  const championships = useChampionships(academyId);
  const entries = useChampionshipEntries(academyId);
  const modalities = useModalities(academyId);
  const [modality, setModality] = useState<string | null>(null);

  const loading = today.isLoading || championships.isLoading;
  const all = championships.data ?? [];
  const list = modality ? all.filter((c) => c.modalityId === modality) : all;
  const mods = modalities.data ?? [];
  const upcoming = today.data ? upcomingChampionships(list, today.data) : [];
  const past = today.data ? pastChampionships(list, today.data) : [];

  return (
    <Box gap="s24">
      <ModalityFilter modalities={mods} value={modality} onChange={setModality} />
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
      {championships.isError || today.isError ? (
        <LoadError
          title="Não foi possível carregar os campeonatos"
          onRetry={() => {
            void championships.refetch();
            void today.refetch();
          }}
        />
      ) : null}

      {!loading && championships.data && today.data ? (
        list.length === 0 && modality ? (
          <Text variant="body" color="textMuted">
            Nenhum campeonato desta modalidade.
          </Text>
        ) : list.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="trophy"
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
                <ChampionshipRow
                  key={c.id}
                  championship={c}
                  today={today.data}
                  entries={entries.data ?? []}
                  modalities={mods}
                />
              ))}
            </Section>
            {past.length > 0 ? (
              <Section title="Anteriores">
                {past.map((c) => (
                  <ChampionshipRow key={c.id} championship={c} entries={entries.data ?? []} modalities={mods} />
                ))}
              </Section>
            ) : null}
          </Box>
        )
      ) : null}

    </Box>
  );
}

function CreateChampionship({ academyId, onDone }: { academyId: string; onDone: () => void }) {
  const { create } = useChampionshipMutations(academyId);
  const modalities = useModalities(academyId);
  return (
    <ChampionshipForm
      modalities={modalities.data ?? []}
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
  modalities,
}: {
  championship: Championship;
  /** Upcoming only: shows the countdown. */
  today?: string;
  entries: ChampionshipEntry[];
  modalities: Modality[];
}) {
  const modalityName = modalities.find((m) => m.id === championship.modalityId)?.name ?? null;
  const count = entries.filter((e) => e.championshipId === championship.id).length;
  const when = today ? countdownLabel(daysBetween(today, championship.eventDate)) : null;
  const details = [
    modalityName,
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
