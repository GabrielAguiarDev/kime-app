import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Avatar, BeltChip, Box, Card, EmptyState, LoadError, Screen, Text } from '@components';
import { useFightSummary } from '@domain/Competition';
import { roleLabel } from '@domain/Membership';
import { memberSinceLabel, useClassmates } from '@domain/Team';
import { FightRecordCard } from '@screens/competition/FightRecord';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * A member seen by a classmate, for the modality selected in the Início
 * header only (user decision: no list of modalities): big photo, name, the
 * cartel (competitor: always right after the name; the trophy badge on the
 * photo marks it), role, "Treina aqui desde …", the graduation
 * (belt in it) and, for a competitor, the cartel summary of it (never the
 * fights in detail). Never health data (water, weight, reach, plans) nor
 * attendance history.
 */
export function ColleagueScreen() {
  const { userId: memberId } = useLocalSearchParams<{ userId: string }>();
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { selected } = useActiveModality();
  const classmates = useClassmates(active?.gymId);
  const member = classmates.data?.find((m) => m.userId === memberId);
  const link = selected ? member?.modalities.find((s) => s.modalityId === selected.id) : undefined;
  const competes = !!member && member.role === 'student' && !!link?.isCompetitor;
  const record = useFightSummary(active?.gymId, memberId, competes);
  const cartel = record.data?.find((r) => r.modalityId === selected?.id);

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

  const isStaffMember = member.role !== 'student';
  const showBelt = !isStaffMember && !!link && !!selected?.usesBelts;

  return (
    <Screen nativeHeader title="" largeTitle={false} onBack={back}>
      <Box gap="s24">
        <Box alignItems="center" gap="s12">
          <Avatar name={member.fullName} path={member.avatarPath} size="large" competitor={competes} />
          <Text variant="title" textAlign="center" accessibilityRole="header">
            {member.userId === userId ? `${member.fullName} (você)` : member.fullName}
          </Text>
        </Box>

        {/* A competitor's cartel comes right after the name (user decision, 2026-11-10). */}
        {competes ? (
          <Box gap="s8">
            <Text variant="captionCaps">{`Cartel · ${selected!.name}`}</Text>
            {record.isLoading ? <ActivityIndicator accessibilityLabel="Carregando cartel" /> : null}
            {cartel ? <FightRecordCard record={cartel} /> : null}
          </Box>
        ) : null}

        <Box alignItems="center" gap="s12">
          <Text variant="body" color="textMuted">
            {roleLabel[member.role]}
          </Text>
          <Text variant="caption" textAlign="center">
            {`${isStaffMember ? 'Na academia' : 'Treina aqui'} desde ${memberSinceLabel(member.memberSince)}`}
          </Text>
        </Box>

        {showBelt ? (
          <Box gap="s8">
            <Text variant="captionCaps">{`Graduação · ${selected!.name}`}</Text>
            <Card>{link!.belt ? <BeltChip belt={link!.belt} /> : <Text variant="body">Sem faixa</Text>}</Card>
          </Box>
        ) : null}

      </Box>
    </Screen>
  );
}
