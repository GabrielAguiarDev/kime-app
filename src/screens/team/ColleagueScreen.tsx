import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Avatar, BeltChip, Box, Card, EmptyState, Icon, LoadError, Screen, Text } from '@components';
import { roleLabel } from '@domain/Membership';
import { memberSinceLabel, useClassmates } from '@domain/Team';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * A member seen by a classmate: big photo, name, role, the modalities in
 * common with the belt of each, "Treina aqui desde …" and the competitor seal.
 * Never health data (water, weight, plans) nor attendance history.
 */
export function ColleagueScreen() {
  const { userId: memberId } = useLocalSearchParams<{ userId: string }>();
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { modalities } = useActiveModality();
  const classmates = useClassmates(active?.gymId);
  const member = classmates.data?.find((m) => m.userId === memberId);

  if (classmates.isLoading || !active) {
    return (
      <Screen nativeHeader title="Membro" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (classmates.isError) {
    return (
      <Screen nativeHeader title="Membro" onBack={back}>
        <LoadError title="Não foi possível carregar o membro" onRetry={() => void classmates.refetch()} />
      </Screen>
    );
  }
  if (!member) {
    return (
      <Screen nativeHeader title="Membro" onBack={back}>
        <EmptyState title="Membro não encontrado." description="Ele pode ter saído da academia ou da modalidade." />
      </Screen>
    );
  }

  const competes = member.modalities.some((s) => s.isCompetitor);
  const isStaffMember = member.role !== 'student';
  const shared = member.modalities
    .map((s) => ({ ...s, modality: modalities.find((m) => m.id === s.modalityId) }))
    .filter((s) => !!s.modality);

  return (
    <Screen nativeHeader title="" largeTitle={false} onBack={back}>
      <Box gap="s24">
        <Box alignItems="center" gap="s12">
          <Avatar name={member.fullName} path={member.avatarPath} size="large" />
          <Box alignItems="center" gap="s4">
            <Text variant="title" textAlign="center" accessibilityRole="header">
              {member.userId === userId ? `${member.fullName} (você)` : member.fullName}
            </Text>
            <Text variant="body" color="textMuted">
              {roleLabel[member.role]}
            </Text>
          </Box>
          {competes ? (
            <Box
              flexDirection="row"
              alignItems="center"
              gap="s4"
              paddingHorizontal="s12"
              paddingVertical="s4"
              borderRadius="progress"
              backgroundColor="accentSelected"
            >
              <Icon name="trophy" color="accent" active />
              <Text variant="captionCaps" color="accent">
                Competidor
              </Text>
            </Box>
          ) : null}
          <Text variant="caption" textAlign="center">
            {`${isStaffMember ? 'Na academia' : 'Treina aqui'} desde ${memberSinceLabel(member.memberSince)}`}
          </Text>
        </Box>

        {shared.length ? (
          <Box gap="s8">
            <Text variant="captionCaps">{member.userId === userId ? 'Suas modalidades' : 'Modalidades em comum'}</Text>
            <Card gap="s12">
              {shared.map((s) => (
                <Box key={s.modalityId} flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
                  <Box flexDirection="row" alignItems="center" gap="s8" flex={1}>
                    <Text variant="bodyStrong">{s.modality!.name}</Text>
                    {s.isCompetitor ? <Icon name="trophy" color="accent" active size={16} /> : null}
                  </Box>
                  {s.modality!.usesBelts ? (
                    s.belt ? (
                      <BeltChip belt={s.belt} />
                    ) : (
                      <Text variant="caption">Sem faixa</Text>
                    )
                  ) : null}
                </Box>
              ))}
            </Card>
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
