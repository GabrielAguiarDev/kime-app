import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  Avatar,
  BeltChip,
  BottomSheet,
  Box,
  Card,
  EmptyState,
  FilterChips,
  HeaderButton,
  Icon,
  LoadError,
  Screen,
  Text,
  TextField,
} from '@components';
import {
  latestBelt,
  trainedModalities,
  useBelts,
  useModalities,
  useModalityStats,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { membershipLabel, splitMembers, useGymMembers, usePendingRequests, type GymMember } from '@domain/Membership';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { InviteSheet } from './InviteSheet';


/**
 * Equipe (owner / instructor; replaces Alunos): search always on top (by name,
 * every member), join requests banner, compact filters (modality, competitors)
 * and the members. "Convidar" in the header. Ranking opens from Início;
 * championships from Perfil.
 */
export function TeamScreen() {
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const members = useGymMembers(academyId);
  const requests = usePendingRequests(academyId);
  const modalities = useModalities(academyId);
  const stats = useModalityStats(academyId);
  const belts = useBelts(academyId);
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState<string | null>(null);
  const [onlyCompetitors, setOnlyCompetitors] = useState(false);
  const [inviting, setInviting] = useState(false);

  if (!active || !academyId) return null;

  const q = query.trim().toLowerCase();
  const pending = requests.data?.length ?? 0;
  const ctx: RowContext = { stats: stats.data ?? [], belts: belts.data ?? [], modalities: modalities.data ?? [] };

  return (
    <Screen
      nativeHeader
      title="Equipe"
      bottomInset={false}
      headerRight={
        <HeaderButton accessibilityLabel="Convidar alunos" onPress={() => setInviting(true)}>
          <Box flexDirection="row" alignItems="center" gap="s4" paddingHorizontal="s4">
            <Icon name="share" color="text" />
            <Text variant="bodyStrong">Convidar</Text>
          </Box>
        </HeaderButton>
      }
    >
      <Box gap="s24">
        <TextField
          label="Buscar"
          value={query}
          onChangeText={setQuery}
          placeholder="Nome de um membro"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {pending > 0 ? (
          <Card
            selected
            onPress={() => router.push('/pedidos')}
            accessibilityLabel={`${pending} pedidos de entrada aguardando. Abrir`}
            flexDirection="row"
            alignItems="center"
            gap="s12"
          >
            <Icon name="users" color="accent" active />
            <Text variant="bodyStrong" flex={1}>
              {pending === 1 ? '1 pedido de entrada aguardando' : `${pending} pedidos de entrada aguardando`}
            </Text>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        ) : null}

        {members.isLoading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
        {members.isError ? (
          <LoadError title="Não foi possível carregar os membros" onRetry={() => void members.refetch()} />
        ) : null}

        {q && members.data ? (
          <SearchResults members={members.data.filter((m) => m.fullName.toLowerCase().includes(q))} ctx={ctx} />
        ) : members.data ? (
          <MembersSection
            members={members.data}
            ctx={ctx}
            modality={modality}
            onModality={setModality}
            onlyCompetitors={onlyCompetitors}
            onOnlyCompetitors={setOnlyCompetitors}
            isOwner={isOwner}
          />
        ) : null}
      </Box>

      <BottomSheet visible={inviting} onRequestClose={() => setInviting(false)}>
        {inviting ? (
          <InviteSheet gymId={academyId} gymName={active.gymName} isOwner={isOwner} onClose={() => setInviting(false)} />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

interface RowContext {
  stats: ModalityStats[];
  belts: ModalityBelt[];
  modalities: Modality[];
}

function SearchResults({ members, ctx }: { members: GymMember[]; ctx: RowContext }) {
  if (members.length === 0) return <EmptyState visual="icon" icon="users" title="Ninguém com esse nome." />;
  return (
    <Box gap="s8">
      <Text variant="captionCaps">Resultados ({members.length})</Text>
      {members
        .slice()
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((m) => (
          <MemberRow key={m.id} member={m} ctx={ctx} modalityId={null} />
        ))}
    </Box>
  );
}

function MembersSection({
  members,
  ctx,
  modality,
  onModality,
  onlyCompetitors,
  onOnlyCompetitors,
  isOwner,
}: {
  members: GymMember[];
  ctx: RowContext;
  modality: string | null;
  onModality: (v: string | null) => void;
  onlyCompetitors: boolean;
  onOnlyCompetitors: (v: boolean) => void;
  isOwner: boolean;
}) {
  const { staff, students } = splitMembers(members);
  const trains = (m: GymMember) =>
    !modality ||
    trainedModalities(ctx.modalities, ctx.stats.filter((s) => s.membershipId === m.id)).some((x) => x.id === modality);
  const shownStudents = students.filter((m) => (!onlyCompetitors || m.isCompetitor) && trains(m));
  const filtering = !!modality || onlyCompetitors;

  return (
    <Box gap="s24">
      {/* One compact row; tapping a selected chip clears it. */}
      <FilterChips
        accessibilityLabel="Filtros"
        chips={[
          ...(ctx.modalities.length > 1
            ? ctx.modalities.map((m) => ({
                key: m.id,
                label: m.name,
                selected: modality === m.id,
                onPress: () => onModality(modality === m.id ? null : m.id),
              }))
            : []),
          {
            key: 'competitors',
            label: 'Só competidores',
            selected: onlyCompetitors,
            onPress: () => onOnlyCompetitors(!onlyCompetitors),
          },
        ]}
      />

      {!filtering ? (
        <Box gap="s8">
          <Text variant="captionCaps">Professores ({staff.length})</Text>
          {staff.map((m) => (
            <MemberRow key={m.id} member={m} ctx={ctx} modalityId={null} />
          ))}
        </Box>
      ) : null}

      <Box gap="s8">
        <Text variant="captionCaps">Alunos ({shownStudents.length})</Text>
        {students.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="users"
            title="Nenhum aluno ainda."
            description={isOwner ? 'Toque em Convidar e compartilhe o código.' : 'Toque em Convidar e compartilhe o código da academia.'}
          />
        ) : shownStudents.length === 0 ? (
          <Text variant="body" color="textMuted">
            Ninguém com esses filtros.
          </Text>
        ) : null}
        {shownStudents.map((m) => (
          <MemberRow key={m.id} member={m} ctx={ctx} modalityId={modality} />
        ))}
      </Box>
    </Box>
  );
}

/** Photo, name, belt chip (of the filtered modality, else the latest) and role. No remove here. */
function MemberRow({ member, ctx, modalityId }: { member: GymMember; ctx: RowContext; modalityId: string | null }) {
  const { userId } = useSession();
  const own = ctx.stats.filter((s) => s.membershipId === member.id);
  const belt =
    member.role !== 'student'
      ? null
      : modalityId
        ? (ctx.belts.find((b) => b.id === own.find((s) => s.modalityId === modalityId)?.beltId) ?? null)
        : latestBelt(own, ctx.belts);
  const role = `${membershipLabel(member)}${member.competitorInvitedAt ? ' · convidado para a equipe' : ''}`;

  return (
    <Card
      onPress={() => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })}
      accessibilityLabel={`${member.fullName}, ${role}`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Avatar name={member.fullName} path={member.avatarPath} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong" numberOfLines={1}>
          {member.fullName}
          {member.userId === userId ? ' (você)' : ''}
        </Text>
        <Box flexDirection="row" alignItems="center" gap="s8" flexWrap="wrap">
          {belt ? <BeltChip belt={belt} /> : null}
          <Text variant="caption">{role}</Text>
        </Box>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
