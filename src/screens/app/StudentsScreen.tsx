import { router } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';

import { Avatar, Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import { useInstructorStats } from '@domain/Classes';
import { membershipLabel, splitMembers, useGymMembers, useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';

export function StudentsScreen() {
  const { active, isOwner } = useActiveGym();
  const members = useGymMembers(active?.gymId);
  const instructorStats = useInstructorStats(active?.gymId);

  // Membership lost (sign-out / removed) while this tab is still mounted.
  if (!active) return null;

  const { staff, students } = splitMembers(members.data ?? []);

  return (
    <Screen nativeHeader title="Alunos" bottomInset={false}>
      <Box marginBottom="s32" gap="s12">
        <Button
          title="Campeonatos"
          icon="trophy"
          variant="secondary"
          onPress={() => router.push('/academy/championships')}
        />
        <Button title="Ranking" icon="users" variant="secondary" onPress={() => router.push('/ranking')} />
        {/* Codes are owner-only and live in the academy settings. */}
        {isOwner ? (
          <Button
            title="Códigos de convite"
            icon="share"
            variant="secondary"
            onPress={() => router.push('/academy/settings')}
          />
        ) : null}
      </Box>

      {members.isLoading ? <ActivityIndicator /> : null}
      {members.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar os membros"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => members.refetch()} />}
        />
      ) : null}

      {members.data ? (
        <Box gap="s32">
          <Box gap="s12">
            <Text variant="captionCaps">Professores ({staff.length})</Text>
            {staff.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canRemove={isOwner}
                classesTaught={instructorStats.data?.find((x) => x.membershipId === member.id)?.classesTaught}
              />
            ))}
          </Box>

          <Box gap="s12">
            <Text variant="captionCaps">Alunos ({students.length})</Text>
            {students.length === 0 ? (
              <EmptyState
                visual="icon"
                icon="users"
                title="Nenhum aluno ainda."
                description={isOwner ? 'Compartilhe o código para alunos (Códigos de convite).' : 'Peça ao proprietário o código para alunos.'}
              />
            ) : null}
            {students.map((member) => (
              <MemberRow key={member.id} member={member} canRemove={isOwner} />
            ))}
          </Box>
        </Box>
      ) : null}
    </Screen>
  );
}

function MemberRow({
  member,
  canRemove,
  classesTaught,
}: {
  member: GymMember;
  canRemove: boolean;
  /** Owner / instructor: classes they taught. */
  classesTaught?: number;
}) {
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const confirm = useConfirm();
  const isSelf = member.userId === userId;
  // The owner removes everyone but themselves; professors never see the action.
  const showRemove = canRemove && !isSelf && member.role !== 'owner';

  const confirmRemove = async () => {
    const ok = await confirm({
      title: 'Remover membro?',
      message: `${member.fullName} perde o acesso à academia.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) remove.mutate(member.id, { onError: (e) => Alert.alert('Membros', errorMessage(e)) });
  };

  return (
    <Card
      onPress={() => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })}
      accessibilityLabel={`${member.fullName}, ${membershipLabel(member)}${member.role === 'student' ? '. Ver aulas e faixas' : ''}`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Avatar name={member.fullName} path={member.avatarPath} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">
          {member.fullName}
          {isSelf ? ' (você)' : ''}
        </Text>
        <Text variant="caption">
          {membershipLabel(member)}
          {member.competitorInvitedAt ? ' · convidado para a equipe' : ''}
          {classesTaught !== undefined ? ` · ${classesTaught} ${classesTaught === 1 ? 'aula dada' : 'aulas dadas'}` : ''}
        </Text>
      </Box>
      {showRemove ? (
        <TextButton
          title="Remover"
          color="danger"
          fullWidth={false}
          onPress={confirmRemove}
          disabled={remove.isPending}
          accessibilityLabel={`Remover ${member.fullName}`}
        />
      ) : (
        <Icon name="chevronRight" color="textMuted" />
      )}
    </Card>
  );
}
