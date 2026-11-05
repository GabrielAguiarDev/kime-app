import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { Avatar, BigCounter, BottomSheet, Box, Button, Card, EmptyState, Icon, LoadError, Screen, SelectionCard, Text, TextField } from '@components';
import { useAcademyToday, useModalities } from '@domain/Classes';
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
import { SheetForm } from '@screens/professor/shared';
import { useAppTheme } from '@theme';
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
  if (championships.isError && !championship) {
    return (
      <Screen nativeHeader title="Campeonato" onBack={back}>
        <LoadError title="Não foi possível carregar o campeonato" onRetry={() => void championships.refetch()} />
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
  const modalities = useModalities(academyId);
  const modalityName = modalities.data?.find((m) => m.id === championship.modalityId)?.name ?? null;
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());

  const entered = useMemo(
    () => (entries.data ?? []).filter((e) => e.championshipId === championship.id).map((e) => e.athleteId),
    [entries.data, championship.id],
  );
  const selected = new Set(entered);

  const all = members.data ?? [];
  // Only competitors of the championship's modality can be entered.
  const competitors = all.filter((m) =>
    m.modalities.some((l) => l.modalityId === championship.modalityId && l.isCompetitor),
  );
  // Entered earlier, no longer on the team: listed so staff can take them off.
  const formerIds = [...selected].filter((a) => !competitors.some((m) => m.userId === a));
  const available = competitors.filter((m) => !selected.has(m.userId));
  const matching = available.filter((m) => m.fullName.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  const athletesReady = members.isSuccess && entries.isSuccess;
  const memberOf = (userId: string) => all.find((m) => m.userId === userId);

  const removeAthlete = async (athleteId: string, name: string) => {
    if (!athletesReady || mutations.setEntries.isPending) return;
    const ok = await confirm({
      title: 'Remover atleta do campeonato?',
      message: `Remover ${name} de ${championship.name}?`,
      confirmLabel: 'Remover atleta',
      tone: 'danger',
    });
    if (ok) {
      mutations.setEntries.mutate(
        { championshipId: championship.id, athleteIds: entered.filter((id) => id !== athleteId) },
        { onSuccess: () => haptics.success() },
      );
    }
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
            {modalityName ? <Text variant="captionCaps">{modalityName}</Text> : null}
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
          <Button
            title="Incluir atletas"
            icon="plus"
            variant="secondary"
            disabled={!athletesReady || mutations.setEntries.isPending}
            onPress={() => {
              setSearch('');
              setToAdd(new Set());
              setAdding(true);
            }}
          />
          {members.isLoading || entries.isLoading ? <ActivityIndicator /> : null}
          {members.isError || entries.isError ? (
            <LoadError
              title="Não foi possível carregar os atletas"
              onRetry={() => {
                void members.refetch();
                void entries.refetch();
              }}
            />
          ) : null}
          {athletesReady && selected.size === 0 ? (
            <EmptyState
              visual="icon"
              icon="trophy"
              title="Nenhum atleta inscrito."
              description="Toque em Incluir atletas para adicionar participantes ao campeonato."
            />
          ) : null}
          {entered.map((athleteId) => {
            const member = memberOf(athleteId);
            const name = member?.fullName ?? 'Ex-atleta';
            return (
              <EnteredAthlete
                key={athleteId}
                name={name}
                avatarPath={member?.avatarPath}
                former={formerIds.includes(athleteId)}
                disabled={!athletesReady || mutations.setEntries.isPending}
                onRemove={() => void removeAthlete(athleteId, name)}
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

      <BottomSheet visible={adding} onRequestClose={() => setAdding(false)}>
        <SheetForm
          title="Incluir atletas"
          actions={
            <Button
              title={toAdd.size > 0 ? `Incluir selecionados (${toAdd.size})` : 'Incluir selecionados'}
              disabled={toAdd.size === 0 || !athletesReady}
              loading={mutations.setEntries.isPending}
              onPress={() => {
                const next = new Set(selected);
                available.forEach((m) => {
                  if (toAdd.has(m.userId)) next.add(m.userId);
                });
                mutations.setEntries.mutate(
                  { championshipId: championship.id, athleteIds: [...next] },
                  { onSuccess: () => {
                    haptics.success();
                    setAdding(false);
                    setToAdd(new Set());
                  } },
                );
              }}
            />
          }
        >
          <TextField label="Buscar atleta" placeholder="Nome do atleta" value={search} onChangeText={setSearch} autoCorrect={false} />
          <Text variant="caption">Ao incluir os selecionados, a inscrição será salva automaticamente.</Text>
          {mutations.setEntries.error ? (
            <Text variant="caption" color="danger">{errorMessage(mutations.setEntries.error)}</Text>
          ) : null}
          {available.length === 0 ? (
            <EmptyState
              title={
                competitors.length === 0
                  ? `Nenhum atleta na equipe${modalityName ? ` de ${modalityName}` : ''}.`
                  : 'Todos os atletas já foram incluídos.'
              }
              description={
                competitors.length === 0
                  ? 'Convide alunos para a equipe de competição desta modalidade pelo perfil deles, em Equipe.'
                  : undefined
              }
            />
          ) : matching.length === 0 ? (
            <EmptyState title="Nenhum atleta encontrado." description="Tente buscar por outro nome." />
          ) : matching.map((m) => (
            <AthleteOption
              key={m.id}
              member={m}
              selected={toAdd.has(m.userId)}
              disabled={mutations.setEntries.isPending}
              onPress={() => setToAdd((current) => {
                const next = new Set(current);
                if (next.has(m.userId)) next.delete(m.userId);
                else next.add(m.userId);
                return next;
              })}
            />
          ))}
        </SheetForm>
      </BottomSheet>

      <BottomSheet visible={editing} onRequestClose={() => setEditing(false)}>
        <ChampionshipForm
          initial={championship}
          modalities={modalities.data ?? []}
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

function AthleteOption({ member, selected, onPress, disabled }: { member: GymMember; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <SelectionCard
      disabled={disabled}
      label={member.fullName}
      leading={<Avatar name={member.fullName} path={member.avatarPath} />}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={`${member.fullName}${selected ? ', inscrito' : ''}`}
    />
  );
}

function EnteredAthlete({ name, avatarPath, former, disabled, onRemove }: {
  name: string;
  avatarPath?: GymMember['avatarPath'];
  former: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { size } = useAppTheme();
  return (
    <Card flexDirection="row" alignItems="center" gap="s12">
      <Avatar name={name} path={avatarPath} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{name}</Text>
        {former ? <Text variant="caption">Saiu da equipe</Text> : null}
      </Box>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${name} do campeonato`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRemove}
        style={{ minWidth: size.touchTarget, minHeight: size.touchTarget, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
      >
        <Icon name="trash" color="danger" />
      </Pressable>
    </Card>
  );
}
