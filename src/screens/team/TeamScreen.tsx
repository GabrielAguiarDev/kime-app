import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  BeltChip,
  BottomSheet,
  Box,
  Card,
  EmptyState,
  HeaderButton,
  Icon,
  LoadError,
  PersonRow,
  Screen,
  Text,
  TextField,
} from '@components';
import {
  latestBelt,
  useBelts,
  useModalities,
  useModalityStats,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { membershipLabel, splitMembers, useGymMembers, usePendingRequests, type GymMember } from '@domain/Membership';
import { ModalityFilter } from '@screens/staff/ModalityFilter';
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
          <InviteSheet gymId={academyId} gymName={active.gymName} isOwner={isOwner} />
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
      <Card>{members.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)).map((m, index, all) => (
        <MemberRow key={m.id} member={m} ctx={ctx} modalityId={null} last={index === all.length - 1} />
      ))}</Card>
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
  // The student's active links decide the modality filter; "Só competidores"
  // means competing in the filtered modality (any modality with "Todas").
  const link = (m: GymMember) => (modality ? m.modalities.find((l) => l.modalityId === modality) : null);
  const trains = (m: GymMember) => !modality || !!link(m);
  const competes = (m: GymMember) => (modality ? !!link(m)?.isCompetitor : m.isCompetitor);
  const shownStudents = students.filter((m) => (!onlyCompetitors || competes(m)) && trains(m));
  const filtering = !!modality || onlyCompetitors;

  return (
    <Box gap="s24">
      {/* Always two chips, however many modalities: the list opens in a sheet. */}
      <ModalityFilter
        modalities={ctx.modalities}
        value={modality}
        onChange={onModality}
        extraChips={[
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
          <Card>{staff.map((m, index) => <MemberRow key={m.id} member={m} ctx={ctx} modalityId={null} last={index === staff.length - 1} />)}</Card>
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
        {shownStudents.length ? <Card>{shownStudents.map((m, index) => <MemberRow key={m.id} member={m} ctx={ctx} modalityId={modality} last={index === shownStudents.length - 1} />)}</Card> : null}
      </Box>
    </Box>
  );
}

/** Photo, name, belt chip (of the filtered modality, else the latest) and role. No remove here. */
function MemberRow({ member, ctx, modalityId, last }: { member: GymMember; ctx: RowContext; modalityId: string | null; last?: boolean }) {
  const { userId } = useSession();
  const own = ctx.stats.filter((s) => s.membershipId === member.id);
  const belt =
    member.role !== 'student'
      ? null
      : modalityId
        ? (ctx.belts.find((b) => b.id === own.find((s) => s.modalityId === modalityId)?.beltId) ?? null)
        : latestBelt(own, ctx.belts);
  const invited = member.modalities.some((l) => l.competitorInvitedAt);
  const role = `${membershipLabel(member)}${invited ? ' · convidado para a equipe' : ''}`;

  return (
    <PersonRow
      name={`${member.fullName}${member.userId === userId ? ' (você)' : ''}`}
      avatarPath={member.avatarPath}
      last={last}
      secondary={<Box flexDirection="row" alignItems="center" gap="s8">{belt ? <BeltChip belt={belt} /> : null}<Text variant="caption">{role}</Text></Box>}
      onPress={() => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })}
    />
  );
}
