import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Box, Button, Card, Text, TextButton } from '@components';
import { useInviteCompetitor, useRemoveCompetitor } from '@domain/Competition';
import type { GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { formatDate } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { LinkRow, Section } from './shared';

/**
 * Staff, on a student's page: the competition team.
 *  - not on the team: "Convidar para a equipe";
 *  - invited: when, and "Cancelar convite";
 *  - competitor: water plan, weight (and diet), "Tirar da equipe".
 */
export function CompetitorSection({ member }: { member: GymMember }) {
  const invite = useInviteCompetitor();
  const remove = useRemoveCompetitor();
  const confirm = useConfirm();
  const onError = (e: unknown) => Alert.alert('Equipe de competição', errorMessage(e));
  const params = { membershipId: member.id };

  if (member.isCompetitor) {
    const takeOff = async () => {
      const ok = await confirm({
        title: 'Tirar da equipe?',
        message: `${member.fullName} deixa de ver campeonatos e planos, e você deixa de ver o peso e a água dele. Inscrições em campeonatos futuros são removidas.`,
        confirmLabel: 'Tirar da equipe',
        tone: 'danger',
      });
      if (ok) remove.mutate(member.id, { onError });
    };
    return (
      <Section title="Equipe de competição">
        {member.competitorSince ? (
          <Text variant="caption">Na equipe desde {formatDate(member.competitorSince)}</Text>
        ) : null}
        <LinkRow
          title="Plano de água"
          description="Meta em ml para cada dia da semana"
          icon="drop"
          onPress={() => router.push({ pathname: '/athlete/water-plan', params })}
        />
        <LinkRow
          title="Água e peso"
          description="Água dos últimos 7 dias e pesagens"
          icon="barbell"
          onPress={() => router.push({ pathname: '/athlete/progress', params })}
        />
        <LinkRow
          title="Dieta"
          description="Refeições de cada dia"
          icon="diet"
          onPress={() => router.push({ pathname: '/athlete/diet', params })}
        />
        <TextButton title="Tirar da equipe" color="danger" disabled={remove.isPending} onPress={takeOff} />
      </Section>
    );
  }

  if (member.competitorInvitedAt) {
    return (
      <Section title="Equipe de competição">
        <Card gap="s8">
          <Text variant="bodyStrong">Convite enviado</Text>
          <Text variant="caption">
            Em {formatDate(member.competitorInvitedAt)}. {member.fullName} precisa aceitar no app.
          </Text>
        </Card>
        <TextButton
          title="Cancelar convite"
          color="danger"
          disabled={remove.isPending}
          onPress={() => remove.mutate(member.id, { onError })}
        />
      </Section>
    );
  }

  return (
    <Section title="Equipe de competição">
      <Box gap="s12">
        <Text variant="body" color="textMuted">
          Na equipe, o aluno recebe campeonatos, plano de água e dieta. O convite chega no app dele e ele precisa
          aceitar para entrar. Ao aceitar, ele autoriza você a ver o peso e os registros de água dele.
        </Text>
        <Button
          title="Convidar para a equipe"
          variant="secondary"
          icon="trophy"
          loading={invite.isPending}
          onPress={() =>
            invite.mutate(member.id, {
              onSuccess: () => haptics.success(),
              onError,
            })
          }
        />
      </Box>
    </Section>
  );
}
