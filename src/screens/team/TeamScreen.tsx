import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  Avatar,
  BeltChip,
  BottomSheet,
  Box,
  Card,
  ChoiceRow,
  EmptyState,
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
import { ChampionshipsView } from '@screens/competition/ChampionshipsScreen';
import { RankingView } from '@screens/ranking/RankingScreen';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { InviteSheet } from './InviteSheet';

type Segment = 'members' | 'ranking' | 'championships';
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'members', label: 'Membros' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'championships', label: 'Campeonatos' },
];
const ALL = 'all';
type Who = 'all' | 'competitors';

/**
 * Equipe (owner / instructor; replaces Alunos): search always on top (by name,
 * every member), join requests banner, and Membros | Ranking | Campeonatos.
 * "Convidar" in the header.
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
  const [segment, setSegment] = useState<Segment>('members');
  const [modality, setModality] = useState<string>(ALL);
  const [who, setWho] = useState<Who>('all');
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
        ) : (
          <Box gap="s24">
            <ChoiceRow accessibilityLabel="Seção" options={SEGMENTS} value={segment} onChange={setSegment} />
            {segment === 'members' && members.data ? (
              <MembersSection
                members={members.data}
                ctx={ctx}
                modality={modality}
                onModality={setModality}
                who={who}
                onWho={setWho}
                isOwner={isOwner}
              />
            ) : null}
            {segment === 'ranking' ? <RankingView academyId={academyId} /> : null}
            {segment === 'championships' ? <ChampionshipsView academyId={academyId} inlineCreate /> : null}
          </Box>
        )}
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
  who,
  onWho,
  isOwner,
}: {
  members: GymMember[];
  ctx: RowContext;
  modality: string;
  onModality: (v: string) => void;
  who: Who;
  onWho: (v: Who) => void;
  isOwner: boolean;
}) {
  const { staff, students } = splitMembers(members);
  const modalityId = modality === ALL ? null : modality;
  const trains = (m: GymMember) =>
    !modalityId ||
    trainedModalities(ctx.modalities, ctx.stats.filter((s) => s.membershipId === m.id)).some((x) => x.id === modalityId);
  const shownStudents = students.filter((m) => (who === 'all' || m.isCompetitor) && trains(m));

  return (
    <Box gap="s24">
      <Box gap="s8">
        {ctx.modalities.length > 1 ? (
          <ChoiceRow
            accessibilityLabel="Modalidade"
            options={[{ value: ALL, label: 'Todas' }, ...ctx.modalities.map((m) => ({ value: m.id, label: m.name }))]}
            value={modality}
            onChange={onModality}
          />
        ) : null}
        <ChoiceRow<Who>
          accessibilityLabel="Quem"
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'competitors', label: 'Só competidores' },
          ]}
          value={who}
          onChange={onWho}
        />
      </Box>

      {who === 'all' && !modalityId ? (
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
          <MemberRow key={m.id} member={m} ctx={ctx} modalityId={modalityId} />
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
