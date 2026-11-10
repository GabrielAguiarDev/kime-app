import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Box, Button, Card, Text, TextButton } from '@components';
import type { Modality } from '@domain/Classes';
import { useInviteCompetitor, useRemoveCompetitor } from '@domain/Competition';
import type { GymMember, StudentModality } from '@domain/Membership';
import { errorMessage } from '@infra';
import { formatDate } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { LinkRow, Section } from './shared';

/**
 * Staff, on a student's page: the competition team, PER MODALITY.
 *  - per linked modality: "Convidar" / invite sent + "Cancelar convite" /
 *    competitor + "Tirar da equipe";
 *  - water plan, weight and diet are one per athlete in the academy: shown
 *    while the student competes in at least one modality.
 */
export function CompetitorSection({ member, modalities }: { member: GymMember; modalities: Modality[] }) {
  const params = { membershipId: member.id };
  const linked = modalities.flatMap((m) => {
    const link = member.modalities.find((l) => l.modalityId === m.id);
    return link ? [{ modality: m, link }] : [];
  });

  return (
    <Section title="Equipe de competição">
      {!member.isCompetitor && !linked.some((l) => l.link.competitorInvitedAt) ? (
        <Text variant="caption">Convite por modalidade. Ao aceitar, o aluno libera peso e água para você.</Text>
      ) : null}
      {linked.map(({ modality, link }) => (
        <ModalityTeamCard key={modality.id} member={member} modality={modality} link={link} />
      ))}
      {member.isCompetitor ? (
        <>
          <LinkRow
            title="Plano de água"
            description="Meta ou limite em ml para cada dia da semana"
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
        </>
      ) : null}
    </Section>
  );
}

function ModalityTeamCard({ member, modality, link }: { member: GymMember; modality: Modality; link: StudentModality }) {
  const invite = useInviteCompetitor();
  const remove = useRemoveCompetitor();
  const confirm = useConfirm();
  const onError = (e: unknown) => Alert.alert('Equipe de competição', errorMessage(e));
  const target = { membershipId: member.id, modalityId: modality.id };

  if (link.isCompetitor) {
    const competesElsewhere = member.modalities.some((l) => l.isCompetitor && l.modalityId !== modality.id);
    const takeOff = async () => {
      const ok = await confirm({
        title: `Tirar da equipe de ${modality.name}?`,
        message: competesElsewhere
          ? `${member.fullName} sai da equipe de ${modality.name}. Inscrições em campeonatos futuros dessa modalidade são removidas.`
          : `${member.fullName} deixa de ver campeonatos e planos, e você deixa de ver o peso e a água dele. Inscrições em campeonatos futuros são removidas.`,
        confirmLabel: 'Tirar da equipe',
        tone: 'danger',
      });
      if (ok) remove.mutate(target, { onError });
    };
    return (
      <Card gap="s8">
        <Text variant="bodyStrong">{modality.name} · Competidor</Text>
        {link.competitorSince ? (
          <Text variant="caption">Na equipe desde {formatDate(link.competitorSince)}</Text>
        ) : null}
        <TextButton title="Tirar da equipe" color="danger" disabled={remove.isPending} onPress={() => void takeOff()} />
      </Card>
    );
  }

  if (link.competitorInvitedAt) {
    return (
      <Card gap="s8">
        <Text variant="bodyStrong">{modality.name} · Convite enviado</Text>
        <Text variant="caption">
          Em {formatDate(link.competitorInvitedAt)}. {member.fullName} precisa aceitar no app.
        </Text>
        <TextButton
          title="Cancelar convite"
          color="danger"
          disabled={remove.isPending}
          onPress={() => remove.mutate(target, { onError })}
        />
      </Card>
    );
  }

  return (
    <Card gap="s12">
      <Text variant="bodyStrong">{modality.name}</Text>
      <Box>
        <Button
          title="Convidar para a equipe"
          variant="secondary"
          icon="trophy"
          loading={invite.isPending}
          onPress={() => invite.mutate(target, { onSuccess: () => haptics.success(), onError })}
        />
      </Box>
    </Card>
  );
}
