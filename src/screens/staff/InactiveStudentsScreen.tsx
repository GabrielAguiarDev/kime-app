import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Card, EmptyState, LoadError, PersonRow, Screen, Text, Spinner } from '@components';
import { useAcademyToday, useModalities } from '@domain/Classes';
import { useGymSettings } from '@domain/Gym';
import { inactiveLabel } from '@domain/Membership';
import { useActiveGym } from '@services/activeGym';

import { ModalityFilter } from './ModalityFilter';
import { useInactiveMembers } from './useStudentAttention';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Alunos sumidos (owner / instructor, every student): active students with no
 * confirmed class in the academy for the owner's threshold (Configurações da
 * academia), the longest absence first. The filter keeps the students linked
 * to a modality. Tap = the student's detail.
 */
export function InactiveStudentsScreen() {
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const { list, isLoading, isError, refetch } = useInactiveMembers(academyId);
  const settings = useGymSettings(academyId);
  const modalities = useModalities(academyId);
  const today = useAcademyToday(academyId);
  const [modality, setModality] = useState<string | null>(null);

  if (!academyId || isLoading || today.isLoading || modalities.isLoading) {
    return (
      <Screen nativeHeader title="Alunos sumidos" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (isError || today.isError || !today.data || modalities.isError) {
    return (
      <Screen nativeHeader title="Alunos sumidos" onBack={back}>
        <LoadError
          title="Não foi possível carregar os alunos"
          onRetry={() => {
            refetch();
            void today.refetch();
            void modalities.refetch();
          }}
        />
      </Screen>
    );
  }

  const days = settings.data?.inactiveAfterDays;
  const shown = list.filter(({ member }) => !modality || member.modalities.some((l) => l.modalityId === modality));

  return (
    <Screen nativeHeader title="Alunos sumidos" onBack={back}>
      <Box gap="s24">
        <Text variant="body" color="textMuted">
          {days ? `Sem aula confirmada há ${days} dias ou mais.` : 'Sem aula confirmada há um tempo.'}
          {isOwner ? ' Mude o prazo em Configurações da academia.' : ''}
        </Text>
        {(modalities.data ?? []).length > 1 ? (
          <ModalityFilter modalities={modalities.data ?? []} value={modality} onChange={setModality} />
        ) : null}
        {shown.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="inactive"
            title={list.length === 0 ? 'Ninguém sumido.' : 'Ninguém nessa modalidade.'}
            description="Todos os alunos treinaram nesse período."
          />
        ) : (
          <Card>
            {shown.map(({ student, member }, index) => (
              <PersonRow
                key={member.id}
                name={member.fullName}
                avatarPath={member.avatarPath}
                competitor={member.isCompetitor}
                last={index === shown.length - 1}
                secondary={<Text variant="caption">{inactiveLabel(student, today.data!)}</Text>}
                onPress={() => router.push({ pathname: '/member/[membershipId]', params: { membershipId: member.id } })}
              />
            ))}
          </Card>
        )}
      </Box>
    </Screen>
  );
}
