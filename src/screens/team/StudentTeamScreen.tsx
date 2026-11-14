import { router } from 'expo-router';
import { useState } from 'react';

import { BeltChip, Box, Card, EmptyState, LoadError, PersonRow, Screen, Text, TextField, Spinner } from '@components';
import { roleLabel, splitMembers } from '@domain/Membership';
import { useClassmates, type Classmate } from '@domain/Team';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

export const openColleague = (userId: string) => router.push({ pathname: '/colega/[userId]', params: { userId } });

/**
 * Equipe of a student: the members of the modality selected in the Início header
 * (search, Professores and Alunos); a tap opens the colleague view. The ranking
 * has its own screen (/ranking, from the Início card).
 */
export function StudentTeamScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;

  return (
    <Screen nativeHeader title="Equipe" bottomInset={false}>
      {!academyId ? <Spinner accessibilityLabel="Carregando" /> : <Members academyId={academyId} />}
    </Screen>
  );
}

function Members({ academyId }: { academyId: string }) {
  const { userId } = useSession();
  const { selected } = useActiveModality();
  const classmates = useClassmates(academyId);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  if (classmates.isLoading) return <Spinner accessibilityLabel="Carregando" />;
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
