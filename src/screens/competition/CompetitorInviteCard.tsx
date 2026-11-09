import { useState } from 'react';
import { Alert } from 'react-native';

import { BottomSheet, Box, Button, Card, Icon, Text, TextButton } from '@components';
import { useRespondCompetitorInvite } from '@domain/Competition';
import type { Membership } from '@domain/Membership';
import { errorMessage } from '@infra';
import type { LinkedModality } from '@services/activeModality';
import { SheetForm } from '@screens/professor/shared';
import { haptics } from '@utils/haptics';

/**
 * Student, on Início: pending invite to the competition team of one modality
 * (one card per invite). The sheet says what accepting means (staff start
 * reading weight, water and the plans) and offers "Aceitar convite" / "Recusar".
 * `onAccepted`: the Início shows "Bem-vindo à equipe." (this card is gone by then).
 */
export function CompetitorInviteCard({
  membership,
  modality,
  onAccepted,
}: {
  membership: Membership;
  modality: LinkedModality;
  onAccepted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const respond = useRespondCompetitorInvite();

  // mutateAsync, not mutate's callbacks: the refetch drops the invite and unmounts
  // this card before they would run, so `onAccepted` would never fire.
  const answer = (accept: boolean) =>
    respond.mutateAsync({ membershipId: membership.id, modalityId: modality.id, accept }).then(
      () => {
        setOpen(false);
        if (accept) {
          haptics.success();
          onAccepted();
        }
      },
      (e: unknown) => Alert.alert('Equipe de competição', errorMessage(e)),
    );

  return (
    <>
      <Card
        onPress={() => setOpen(true)}
        accessibilityLabel={`Convite para a equipe de competição de ${modality.name} da ${membership.gymName}. Ver convite`}
        flexDirection="row"
        alignItems="center"
        gap="s12"
      >
        <Icon name="trophy" color="accent" active />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Convite para a equipe de {modality.name}</Text>
          <Text variant="caption">{membership.gymName} quer você na equipe de competição.</Text>
        </Box>
        <Icon name="chevronRight" color="textMuted" />
      </Card>

      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        <SheetForm
          title={`Equipe de ${modality.name}`}
          actions={
            <>
              <Button title="Aceitar convite" loading={respond.isPending && respond.variables?.accept} onPress={() => answer(true)} />
              <TextButton title="Recusar" color="danger" disabled={respond.isPending} onPress={() => answer(false)} />
            </>
          }
        >
          <Text variant="body">
            Na equipe de {modality.name} da {membership.gymName}, você recebe os campeonatos de {modality.name} em que
            for inscrito, um plano de água por dia da semana e plano de dieta.
          </Text>
          <Card gap="s8">
            <Box flexDirection="row" alignItems="center" gap="s8">
              <Icon name="warning" color="warning" />
              <Text variant="bodyStrong" flex={1}>
                Ao aceitar
              </Text>
            </Box>
            <Text variant="body">
              Os professores da academia passam a ver seu peso, seus registros de água e seus planos de dieta. Você pode
              sair da equipe quando quiser, na aba Competição.
            </Text>
          </Card>
        </SheetForm>
      </BottomSheet>
    </>
  );
}
