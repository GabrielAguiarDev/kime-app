import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BeltChip, Box, Card, EmptyState, FilterChips, LoadError, PersonRow, Screen, Text, TextField } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { roleLabel, splitMembers } from '@domain/Membership';
import { rankingPeriod, useRanking, visibleRanking } from '@domain/Ranking';
import { useClassmates, type Classmate } from '@domain/Team';
import { RankingRow, RankingView } from '@screens/ranking/RankingScreen';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

type View = 'members' | 'ranking';

/** From this position on, the student's own row is pinned at the bottom (it would be off screen). */
const PIN_OWN_FROM = 8;

export const openColleague = (userId: string) => router.push({ pathname: '/colega/[userId]', params: { userId } });

/**
 * Equipe of a student: Membros | Ranking, always of the modality selected in
 * the Início header. Members: search and person rows (photo, name, belt),
 * Professores and Alunos; a tap opens the member's profile (colleague view).
 * Ranking: the modality ranking; the student's own row is pinned at the
 * bottom when it sits far down the list.
 */
export function StudentTeamScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View>(params.view === 'ranking' ? 'ranking' : 'members');
  const [appliedParam, setAppliedParam] = useState(params.view);
  // Opened again from Início's Ranking shortcut while the tab is mounted.
  if (params.view !== appliedParam) {
    setAppliedParam(params.view);
    if (params.view === 'ranking' || params.view === 'members') setView(params.view);
  }

  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const { selected } = useActiveModality();
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const ranking = useRanking(academyId, view === 'ranking' ? selected?.id : undefined, period);
  const { own } = visibleRanking(ranking.data ?? [], userId);
  const ownEntry = (ranking.data ?? []).find((e) => e.userId === userId);
  const pinned = view === 'ranking' && ownEntry && (own || (ownEntry.position ?? 0) >= PIN_OWN_FROM) ? ownEntry : null;

  return (
    <Screen
      nativeHeader
      title="Equipe"
      bottomInset={false}
      footer={
        pinned ? (
          <Card>
            <RankingRow entry={pinned} isSelf last />
          </Card>
        ) : undefined
      }
    >
      <Box gap="s24">
        <FilterChips
          accessibilityLabel="Membros ou ranking"
          chips={[
            { key: 'members', label: 'Membros', selected: view === 'members', onPress: () => setView('members') },
            { key: 'ranking', label: 'Ranking', selected: view === 'ranking', onPress: () => setView('ranking') },
          ]}
        />
        {!academyId ? (
          <ActivityIndicator accessibilityLabel="Carregando" />
        ) : view === 'members' ? (
          <Members academyId={academyId} />
        ) : (
          <RankingView academyId={academyId} onOpenMember={openColleague} hideOwnBelow={!!pinned} />
        )}
      </Box>
    </Screen>
  );
}

function Members({ academyId }: { academyId: string }) {
  const { userId } = useSession();
  const { selected } = useActiveModality();
  const classmates = useClassmates(academyId);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  if (classmates.isLoading) return <ActivityIndicator accessibilityLabel="Carregando" />;
  if (classmates.isError || !classmates.data) {
    return <LoadError title="Não foi possível carregar a equipe" onRetry={() => void classmates.refetch()} />;
  }

  // Staff teach every modality; students only when they train the selected one.
  const ofModality = classmates.data.filter(
    (m) => m.role !== 'student' || !selected || m.modalities.some((s) => s.modalityId === selected.id),
  );
  const shown = q ? ofModality.filter((m) => m.fullName.toLowerCase().includes(q)) : ofModality;
  const { staff, students } = splitMembers(shown);

  return (
    <Box gap="s24">
      <TextField
        label="Buscar"
        value={query}
        onChangeText={setQuery}
        placeholder="Nome de um colega"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {q && shown.length === 0 ? <EmptyState visual="icon" icon="users" title="Ninguém com esse nome." /> : null}
      {staff.length ? (
        <Box gap="s8">
          <Text variant="captionCaps">Professores ({staff.length})</Text>
          <Card>
            {staff.map((m, index) => (
              <ColleagueRow key={m.userId} member={m} modalityId={null} self={m.userId === userId} last={index === staff.length - 1} />
            ))}
          </Card>
        </Box>
      ) : null}
      {students.length ? (
        <Box gap="s8">
          <Text variant="captionCaps">Alunos ({students.length})</Text>
          <Card>
            {students.map((m, index) => (
              <ColleagueRow
                key={m.userId}
                member={m}
                modalityId={selected?.id ?? null}
                self={m.userId === userId}
                last={index === students.length - 1}
              />
            ))}
          </Card>
        </Box>
      ) : null}
    </Box>
  );
}

/** Photo, name, belt of the selected modality and role; opens the colleague view. */
function ColleagueRow({ member, modalityId, self, last }: { member: Classmate; modalityId: string | null; self: boolean; last: boolean }) {
  const shared = modalityId ? member.modalities.find((s) => s.modalityId === modalityId) : undefined;
  const role = shared?.isCompetitor ? 'Competidor' : roleLabel[member.role];
  return (
    <PersonRow
      name={`${member.fullName}${self ? ' (você)' : ''}`}
      avatarPath={member.avatarPath}
      last={last}
      secondary={
        <Box flexDirection="row" alignItems="center" gap="s8">
          {shared?.belt ? <BeltChip belt={shared.belt} /> : null}
          <Text variant="caption">{role}</Text>
        </Box>
      }
      onPress={() => openColleague(member.userId)}
    />
  );
}
