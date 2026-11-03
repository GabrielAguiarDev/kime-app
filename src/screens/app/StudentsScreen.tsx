import { ActivityIndicator, Alert, Share } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import { useGymInvites, useRotateInvite, type GymInvite, type InviteRole } from '@domain/Gym';
import { roleLabel, useGymMembers, useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
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
        {members.data?.length === 1 ? (
          <Text variant="body" color="textMuted">
            Ninguém entrou ainda. Compartilhe o link de alunos.
          </Text>
        ) : null}
        {members.data?.map((member) => <MemberRow key={member.id} member={member} />)}
      </Box>
    </Screen>
  );
}

function InviteCard({ invite, gymId, gymName }: { invite: GymInvite; gymId: string; gymName: string }) {
  const rotate = useRotateInvite(gymId);
  const copy = INVITE_COPY[invite.role];

  const share = () =>
    Share.share({ message: `Entre na ${gymName} pelo Kimi: ${invite.url}` });

  const confirmRotate = () =>
    Alert.alert(
      'Gerar novo link?',
      'O link atual para de funcionar. Pedidos já enviados continuam valendo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Gerar novo',
          style: 'destructive',
          onPress: () =>
            rotate.mutate(invite.role, { onError: (e) => Alert.alert('Convite', errorMessage(e)) }),
        },
      ],
    );

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">{copy.title}</Text>
        <Text variant="caption">{copy.description}</Text>
      </Box>
      <Button title="Compartilhar link" icon="share" variant="secondary" onPress={share} />
      <TextButton title="Gerar novo link" color="textMuted" onPress={confirmRotate} disabled={rotate.isPending} />
    </Card>
  );
}

function MemberRow({ member }: { member: GymMember }) {
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const isSelf = member.userId === userId;

  const confirmRemove = () =>
    Alert.alert('Remover membro?', `${member.fullName} perde o acesso à academia.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () =>
          remove.mutate(member.id, { onError: (e) => Alert.alert('Membros', errorMessage(e)) }),
      },
    ]);

  return (
    <Card flexDirection="row" alignItems="center" gap="s12">
      <Icon name={member.role === 'professor' ? 'professor' : 'user'} color="textMuted" />
      <Box flex={1}>
        <Text variant="bodyStrong">
          {member.fullName}
          {isSelf ? ' (você)' : ''}
        </Text>
        <Text variant="caption">{roleLabel[member.role]}</Text>
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
      ) : null}
    </Card>
  );
}
