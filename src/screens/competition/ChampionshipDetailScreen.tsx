import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Avatar, BigCounter, BottomSheet, Box, Button, Card, EmptyState, Screen, SelectionCard, Text } from '@components';
import { useAcademyToday } from '@domain/Classes';
import {
  countdownLabel,
  daysBetween,
  formatLocalDate,
  useChampionshipEntries,
  useChampionshipMutations,
  useChampionships,
  type Championship,
} from '@domain/Competition';
import { useGymMembers, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { ChampionshipForm } from './ChampionshipForm';
import { Section } from './shared';

/** Staff: one championship — countdown, details (edit / delete) and the athletes entered. */
export function ChampionshipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const championships = useChampionships(academyId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!academyId || !id) return null;
  const championship = championships.data?.find((c) => c.id === id);

  if (championships.isLoading) {
    return (
      <Screen nativeHeader title=" " onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (!championship) {
    return (
      <Screen nativeHeader title="Campeonato" onBack={back}>
        <EmptyState title="Campeonato não encontrado." description="Ele pode ter sido removido." />
      </Screen>
    );
  }
  return <ChampionshipDetail academyId={academyId} championship={championship} onBack={back} />;
}

function ChampionshipDetail({
  academyId,
  championship,
  onBack,
}: {
  academyId: string;
  championship: Championship;
  onBack: () => void;
}) {
  const today = useAcademyToday(academyId);
  const members = useGymMembers(academyId);
  const entries = useChampionshipEntries(academyId);
  const mutations = useChampionshipMutations(academyId);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const entered = useMemo(
    () => (entries.data ?? []).filter((e) => e.championshipId === championship.id).map((e) => e.athleteId),
    [entries.data, championship.id],
  );
  // Local selection; null = untouched (follows the server).
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected = picked ?? new Set(entered);
  const changed = picked !== null && (picked.size !== entered.length || entered.some((a) => !picked.has(a)));

  const all = members.data ?? [];
  const competitors = all.filter((m) => m.isCompetitor);
  // Entered earlier, no longer on the team: listed so staff can take them off.
  const formerIds = entered.filter((a) => !competitors.some((m) => m.userId === a));
  const memberOf = (userId: string) => all.find((m) => m.userId === userId);

  const toggle = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setPicked(next);
  };

  const days = today.data ? daysBetween(today.data, championship.eventDate) : null;
  const isPast = days !== null && days < 0;

  const remove = async () => {
    setEditing(false);
    const ok = await confirm({
      title: 'Remover campeonato?',
      message: `${championship.name} e as inscrições dos atletas serão apagados.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) mutations.remove.mutate(championship.id, { onSuccess: onBack });
  };

  return (
    <Screen
      nativeHeader
      title={championship.name}
      onBack={onBack}
      topAction={{ icon: 'edit', accessibilityLabel: 'Editar campeonato', onPress: () => setEditing(true) }}
      footer={
        <Button
          title="Salvar inscritos"
          disabled={!changed}
          loading={mutations.setEntries.isPending}
          onPress={() =>
            mutations.setEntries.mutate(
              { championshipId: championship.id, athleteIds: [...selected] },
              {
                onSuccess: () => {
                  haptics.success();
                  setPicked(null);
                },
              },
            )
          }
        />
      }
    >
      <Box gap="s24">
        <Card gap="s12" alignItems="center">
          {days !== null && !isPast ? (
            days === 0 ? (
              <Text variant="displayLg" color="accent">
                HOJE
              </Text>
            ) : (
              <BigCounter value={days} label={days === 1 ? 'Dia para o campeonato' : 'Dias para o campeonato'} />
            )
          ) : null}
          <Box alignItems="center" gap="s4">
            <Text variant="bodyStrong">{formatLocalDate(championship.eventDate)}</Text>
            {championship.location ? <Text variant="caption">{championship.location}</Text> : null}
            {isPast ? <Text variant="caption">Já aconteceu</Text> : null}
            {days !== null && !isPast && days > 1 ? (
              <Text variant="caption" color="accent">
                {countdownLabel(days)}
              </Text>
            ) : null}
          </Box>
        </Card>

        <Section title={`Atletas inscritos (${selected.size})`}>
          {members.isLoading || entries.isLoading ? <ActivityIndicator /> : null}
          {members.data && competitors.length === 0 && formerIds.length === 0 ? (
            <EmptyState
              visual="icon"
              icon="trophy"
              title="Nenhum atleta na equipe."
              description="Convide alunos para a equipe de competição pelo perfil deles, em Alunos."
            />
          ) : null}
          {competitors.map((m) => (
            <AthleteOption key={m.id} member={m} selected={selected.has(m.userId)} onPress={() => toggle(m.userId)} />
          ))}
          {formerIds.map((athleteId) => {
            const m = memberOf(athleteId);
            return (
              <SelectionCard
                key={athleteId}
                label={m?.fullName ?? 'Ex-atleta'}
                description="Saiu da equipe"
                selected={selected.has(athleteId)}
                onPress={() => toggle(athleteId)}
              />
            );
          })}
          {mutations.setEntries.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(mutations.setEntries.error)}
            </Text>
          ) : null}
        </Section>
      </Box>

      <BottomSheet visible={editing} onRequestClose={() => setEditing(false)}>
        <ChampionshipForm
          initial={championship}
          saving={mutations.update.isPending}
          error={mutations.update.error ?? mutations.remove.error}
          onSave={(input) =>
            mutations.update.mutate(
              { id: championship.id, input },
              {
                onSuccess: () => {
                  haptics.success();
                  setEditing(false);
                },
              },
            )
          }
          onDelete={remove}
        />
      </BottomSheet>
    </Screen>
  );
}

function AthleteOption({ member, selected, onPress }: { member: GymMember; selected: boolean; onPress: () => void }) {
  return (
    <SelectionCard
      label={member.fullName}
      leading={<Avatar name={member.fullName} path={member.avatarPath} />}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={`${member.fullName}${selected ? ', inscrito' : ''}`}
    />
  );
}
