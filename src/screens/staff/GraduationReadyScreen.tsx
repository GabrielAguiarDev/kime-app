import { router } from 'expo-router';
import { useState } from 'react';

import { BeltChip, Box, Card, EmptyState, LoadError, PersonRow, Screen, Text, Spinner } from '@components';
import { useModalities } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';

import { ModalityFilter } from './ModalityFilter';
import { useGraduationReady } from './useStudentAttention';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Prontos para graduar (owner / instructor, every student): who reached the
 * classes for the next belt in a modality, most over the goal first. The seal
 * goes away when the new belt is registered (the count starts again). Tap =
 * the student's detail, where the belt is changed.
 */
export function GraduationReadyScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const { ready, members, isLoading, isError, refetch } = useGraduationReady(academyId);
  const modalities = useModalities(academyId);
  const [modality, setModality] = useState<string | null>(null);

  if (!academyId || isLoading || modalities.isLoading) {
    return (
      <Screen nativeHeader title="Prontos para graduar" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (isError || modalities.isError) {
    return (
      <Screen nativeHeader title="Prontos para graduar" onBack={back}>
        <LoadError
          title="Não foi possível carregar os alunos"
          onRetry={() => {
            refetch();
            void modalities.refetch();
          }}
        />
      </Screen>
    );
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const names = new Map((modalities.data ?? []).map((m) => [m.id, m.name]));
  const shown = ready.filter((r) => byId.has(r.membershipId) && (!modality || r.modalityId === modality));

  return (
    <Screen nativeHeader title="Prontos para graduar" onBack={back}>
      <Box gap="s24">
        <Text variant="body" color="textMuted">
          Alunos que já fizeram as aulas pedidas para a próxima faixa.
        </Text>
        {(modalities.data ?? []).length > 1 ? (
          <ModalityFilter modalities={modalities.data ?? []} value={modality} onChange={setModality} />
        ) : null}
        {shown.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="belt"
            title={ready.length === 0 ? 'Ninguém pronto para graduar.' : 'Ninguém nessa modalidade.'}
            description="Quando um aluno completar as aulas da faixa, ele aparece aqui."
          />
        ) : (
          <Card>
            {shown.map((r, index) => {
              const member = byId.get(r.membershipId)!;
              return (
                <PersonRow
                  key={`${r.membershipId}:${r.modalityId}`}
                  name={member.fullName}
                  avatarPath={member.avatarPath}
                  last={index === shown.length - 1}
                  secondary={
                    <Box gap="s4">
                      <Box flexDirection="row" alignItems="center" gap="s8">
                        <BeltChip belt={r.nextBelt} />
                        <Text variant="caption">{names.get(r.modalityId) ?? ''}</Text>
                      </Box>
                      <Text variant="caption">
                        {r.done} de {r.required} aulas
                      </Text>
                    </Box>
                  }
                  onPress={() => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })}
                />
              );
            })}
          </Card>
        )}
      </Box>
    </Screen>
  );
}
