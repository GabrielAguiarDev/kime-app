import { router } from 'expo-router';
import { ActivityIndicator, Alert, Share } from 'react-native';

import { BeltChip, Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton } from '@components';
import {
  formatCodeExpiry,
  useCreateProfessorCode,
  useProfessorCodes,
  useRegenerateStudentCode,
  useRevokeProfessorCode,
  useStudentCode,
  type ProfessorCode,
} from '@domain/Gym';
import { membershipLabel, splitMembers, useGymMembers, useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';
import { toBelt } from '@screens/professor/shared';
import { useSession } from '@services/session';
import { joinCodeMessage } from '@utils/deepLinks';

export function StudentsScreen() {
  const { active, isOwner } = useActiveGym();
  const members = useGymMembers(active?.gymId);

  // Membership lost (sign-out / removed) while this tab is still mounted.
  if (!active) return null;

  const { staff, students } = splitMembers(members.data ?? []);

  return (
    <Screen title="Alunos" bottomInset={false}>
      {/* Codes are owner-only: professors do not see this section at all. */}
      {isOwner ? <CodesSection gymId={active.gymId} gymName={active.gymName} /> : null}

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
              <MemberRow key={member.id} member={member} canRemove={isOwner} />
            ))}
          </Box>

          <Box gap="s12">
            <Text variant="captionCaps">Alunos ({students.length})</Text>
            {students.length === 0 ? (
              <EmptyState
                visual="icon"
                icon="users"
                title="Nenhum aluno ainda."
                description={isOwner ? 'Compartilhe o código para alunos.' : 'Peça ao proprietário o código para alunos.'}
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

function CodesSection({ gymId, gymName }: { gymId: string; gymName: string }) {
  return (
    <Box gap="s12" marginBottom="s32">
      <Text variant="captionCaps">Códigos de entrada</Text>
      <StudentCodeCard gymId={gymId} gymName={gymName} />
      <ProfessorCodesCard gymId={gymId} gymName={gymName} />
    </Box>
  );
}

/** One fixed code per academy. Joining still needs approval. */
function StudentCodeCard({ gymId, gymName }: { gymId: string; gymName: string }) {
  const code = useStudentCode(gymId);
  const regenerate = useRegenerateStudentCode(gymId);
  const confirm = useConfirm();

  const confirmRegenerate = async () => {
    const ok = await confirm({
      title: 'Gerar novo código?',
      message: 'O código atual para de funcionar. Pedidos já enviados com ele continuam valendo.',
      confirmLabel: 'Gerar novo código',
      tone: 'danger',
    });
    if (ok) regenerate.mutate(undefined, { onError: (e) => Alert.alert('Código', errorMessage(e)) });
  };

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">Código para alunos</Text>
        {code.isLoading ? <ActivityIndicator /> : null}
        {code.isError ? (
          <Text variant="caption" color="danger">
            Não foi possível carregar o código.
          </Text>
        ) : null}
        {code.data ? (
          <Text variant="displayXl" selectable accessibilityLabel={`Código ${code.data.split('').join(' ')}`}>
            {code.data}
          </Text>
        ) : null}
        <Text variant="caption">O aluno digita este código no app e entra depois da aprovação.</Text>
      </Box>
      <Button
        title="Compartilhar código"
        icon="share"
        variant="secondary"
        disabled={!code.data}
        onPress={() => code.data && Share.share({ message: joinCodeMessage(gymName, code.data, 'student') })}
      />
      <TextButton title="Gerar novo código" onPress={confirmRegenerate} disabled={regenerate.isPending || !code.data} />
    </Card>
  );
}

/** Single-use codes, 7 days. Only the owner sees, creates and revokes them. */
function ProfessorCodesCard({ gymId, gymName }: { gymId: string; gymName: string }) {
  const codes = useProfessorCodes(gymId);
  const create = useCreateProfessorCode(gymId);

  return (
    <Card gap="s12">
      <Box gap="s4">
        <Text variant="heading">Códigos para professores</Text>
        <Text variant="caption">
          Cada código vale para uma pessoa e expira em 7 dias. Você aprova o pedido depois.
        </Text>
      </Box>
      {codes.isLoading ? <ActivityIndicator /> : null}
      {codes.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar os códigos"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => codes.refetch()} />}
        />
      ) : null}
      {codes.data?.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhum código ativo.
        </Text>
      ) : null}
      {codes.data?.map((c) => <ProfessorCodeRow key={c.id} code={c} gymId={gymId} gymName={gymName} />)}
      <Button
        title="Gerar código de professor"
        icon="plus"
        variant="secondary"
        loading={create.isPending}
        onPress={() =>
          create.mutate(undefined, {
            onSuccess: (c) => {
              haptics.success();
              Share.share({ message: joinCodeMessage(gymName, c.code, 'professor') });
            },
            onError: (e) => Alert.alert('Código', errorMessage(e)),
          })
        }
      />
    </Card>
  );
}

function ProfessorCodeRow({ code, gymId, gymName }: { code: ProfessorCode; gymId: string; gymName: string }) {
  const revoke = useRevokeProfessorCode(gymId);
  const confirm = useConfirm();

  const confirmRevoke = async () => {
    const ok = await confirm({
      title: 'Revogar código?',
      message: `O código ${code.code} para de funcionar na hora.`,
      confirmLabel: 'Revogar',
      tone: 'danger',
    });
    if (ok) revoke.mutate(code.id, { onError: (e) => Alert.alert('Código', errorMessage(e)) });
  };

  return (
    <Box gap="s8" padding="s12" borderRadius="md" backgroundColor="surfaceRaised">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Text variant="heading" selectable>
          {code.code}
        </Text>
        <Text variant="caption">expira em {formatCodeExpiry(code.expiresAt)}</Text>
      </Box>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Button
            title="Compartilhar"
            icon="share"
            variant="secondary"
            onPress={() => Share.share({ message: joinCodeMessage(gymName, code.code, 'professor') })}
          />
        </Box>
        <Box flex={1}>
          <TextButton title="Revogar" color="danger" onPress={confirmRevoke} disabled={revoke.isPending} />
        </Box>
      </Box>
    </Box>
  );
}

function MemberRow({ member, canRemove }: { member: GymMember; canRemove: boolean }) {
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const confirm = useConfirm();
  const isSelf = member.userId === userId;
  // The owner removes everyone but themselves; professors never see the action.
  const showRemove = canRemove && !isSelf && member.role !== 'owner';
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
      <Icon
        name={member.role === 'owner' ? 'owner' : member.role === 'professor' ? 'professor' : 'user'}
        color={member.role === 'owner' ? 'accent' : 'textMuted'}
        active={member.role === 'owner'}
      />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">
          {member.fullName}
          {isSelf ? ' (você)' : ''}
        </Text>
        <Text variant="caption">{membershipLabel(member)}</Text>
        {belt ? <BeltChip belt={belt} /> : null}
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
