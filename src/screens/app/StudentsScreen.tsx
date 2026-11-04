import { router } from 'expo-router';
import { ActivityIndicator, Alert, Share } from 'react-native';

import { BeltChip, Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import { useGymInviteCode, useGymInvites, useRotateInvite, type GymInvite, type InviteRole } from '@domain/Gym';
import { membershipLabel, useGymMembers, useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { toBelt } from '@screens/professor/shared';
import { useSession } from '@services/session';

const INVITE_COPY: Record<InviteRole, { title: string; description: string }> = {
  student: {
    title: 'Link para alunos',
    description: 'Quem entrar por este link vira aluno após sua aprovação.',
  },
  professor: {
    title: 'Link para professores',
    description: 'Dá acesso de professor após aprovação. Compartilhe só com quem confia.',
  },
};

export function StudentsScreen() {
  const { active } = useActiveGym();
  const invites = useGymInvites(active?.gymId);
  const members = useGymMembers(active?.gymId);

  // Membership lost (sign-out / removed) while this tab is still mounted.
  if (!active) return null;

  return (
    <Screen title="Alunos" bottomInset={false}>
      <Box gap="s12" marginBottom="s32">
        <Text variant="captionCaps">Convites</Text>
        {invites.isLoading ? <ActivityIndicator /> : null}
        {invites.isError ? (
          <EmptyState
            visual="icon"
            icon="offline"
            title="Não foi possível carregar os convites"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => invites.refetch()} />}
          />
        ) : null}
        <InviteCodeCard gymId={active.gymId} gymName={active.gymName} />
        {invites.data?.map((invite) => (
          <InviteCard key={invite.id} invite={invite} gymId={active.gymId} gymName={active.gymName} />
        ))}
      </Box>

      <Box gap="s12">
        <Text variant="captionCaps">Membros ({members.data?.length ?? 0})</Text>
        {members.isLoading ? <ActivityIndicator /> : null}
        {members.isError ? (
          <EmptyState
            visual="icon"
            icon="offline"
            title="Não foi possível carregar os membros"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => members.refetch()} />}
          />
        ) : null}
        {/* Only the professor so far: nobody else joined. */}
        {members.data?.length === 1 ? (
          <EmptyState title="Ninguém entrou ainda." description="Compartilhe o código ou o link para alunos." />
        ) : null}
        {members.data?.map((member) => <MemberRow key={member.id} member={member} />)}
      </Box>
    </Screen>
  );
}

/** Short code a student types in "Entrar com código". Joining still needs approval. */
function InviteCodeCard({ gymId, gymName }: { gymId: string; gymName: string }) {
  const { data: code } = useGymInviteCode(gymId);
  if (!code) return null;

  const share = () =>
    Share.share({ message: `Entre na ${gymName} pelo Kimi com o código ${code}` });

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">Código para alunos</Text>
        <Text variant="title" selectable>
          {code}
        </Text>
        <Text variant="caption">O aluno digita este código no app e entra após sua aprovação.</Text>
      </Box>
      <Button title="Compartilhar código" icon="share" variant="secondary" onPress={share} />
    </Card>
  );
}

function InviteCard({ invite, gymId, gymName }: { invite: GymInvite; gymId: string; gymName: string }) {
  const rotate = useRotateInvite(gymId);
  const confirm = useConfirm();
  const copy = INVITE_COPY[invite.role];

  const share = () =>
    Share.share({ message: `Entre na ${gymName} pelo Kimi: ${invite.url}` });

  const confirmRotate = async () => {
    const ok = await confirm({
      title: 'Gerar novo link?',
      message: 'O link atual para de funcionar. Pedidos já enviados continuam valendo.',
      confirmLabel: 'Gerar novo link',
      tone: 'danger',
    });
    if (ok) rotate.mutate(invite.role, { onError: (e) => Alert.alert('Convite', errorMessage(e)) });
  };

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">{copy.title}</Text>
        <Text variant="caption">{copy.description}</Text>
      </Box>
      <Button title="Compartilhar link" icon="share" variant="secondary" onPress={share} />
      <TextButton title="Gerar novo link" onPress={confirmRotate} disabled={rotate.isPending} />
    </Card>
  );
}

function MemberRow({ member }: { member: GymMember }) {
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const confirm = useConfirm();
  const isSelf = member.userId === userId;
  const belt = toBelt(member.belt);

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
      accessibilityLabel={`${member.fullName}, ${membershipLabel(member)}. Ver aulas e faixa`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Icon name={member.role === 'professor' ? 'professor' : 'user'} color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">
          {member.fullName}
          {isSelf ? ' (você)' : ''}
        </Text>
        <Text variant="caption">{membershipLabel(member)}</Text>
        {belt ? <BeltChip belt={belt} /> : null}
      </Box>
      {!isSelf ? (
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
