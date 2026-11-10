import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, useWindowDimensions, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeltChip, Box, Card, EmptyState, FilterChips, LoadError, PersonRow, Screen, Text, TextField } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { roleLabel, splitMembers } from '@domain/Membership';
import { rankingPeriod, useRanking } from '@domain/Ranking';
import { useClassmates, type Classmate } from '@domain/Team';
import { RankingRow, RankingView } from '@screens/ranking/RankingScreen';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

type View = 'members' | 'ranking';

/** Bars drawn over the scroll content (native header on top, tab bar below), for the "own row off screen" check. */
const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 64;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 80;

export const openColleague = (userId: string) => router.push({ pathname: '/colega/[userId]', params: { userId } });

/**
 * Equipe of a student: Membros | Ranking, always of the modality selected in
 * the Início header. Members: search and person rows (photo, name, belt),
 * Professores and Alunos; a tap opens the member's profile (colleague view).
 * Ranking: the modality ranking; while the student's own row is off screen,
 * a copy is pinned at the bottom, above the tab bar.
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
  const ownEntry = (ranking.data ?? []).find((e) => e.userId === userId);

  const ownRowRef = useRef<ComponentRef<typeof RNView>>(null);
  const [ownOffscreen, setOwnOffscreen] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const checkOwnRow = useCallback(() => {
    const node = ownRowRef.current;
    if (!node) return setOwnOffscreen(false);
    node.measureInWindow((_x, y, _width, height) => {
      if (!height) return;
      const top = insets.top + HEADER_HEIGHT;
      const bottom = windowHeight - insets.bottom - TAB_BAR_HEIGHT;
      setOwnOffscreen(y < top || y + height > bottom);
    });
  }, [insets.top, insets.bottom, windowHeight]);

  const pinned =
    view === 'ranking' && ownOffscreen && ownEntry?.status === 'ranked' && ownEntry.position != null ? ownEntry : null;

  return (
    <Screen
      nativeHeader
      title="Equipe"
      bottomInset={false}
      onScroll={view === 'ranking' ? checkOwnRow : undefined}
      footer={pinned ? <RankingRow entry={pinned} isSelf pinned onOpen={openColleague} /> : undefined}
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
          <RankingView
            academyId={academyId}
            onOpenMember={openColleague}
            ownRowRef={ownRowRef}
            onOwnRowLayout={() => requestAnimationFrame(checkOwnRow)}
          />
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
      competitor={!!shared?.isCompetitor}
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
