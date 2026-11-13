import { router, useLocalSearchParams } from 'expo-router';

import { Avatar, BeltChip, Box, Card, EmptyState, LoadError, Screen, Text, Spinner } from '@components';
import { useFightSummary } from '@domain/Competition';
import { useAcademyToday } from '@domain/Classes';
import { rankingPeriod, useRanking } from '@domain/Ranking';
import { memberSinceLabel, useClassmates } from '@domain/Team';
import { FightRecordCard } from '@screens/competition/FightRecord';
import { InstructorProfileScreen } from '@screens/instructor/InstructorProfileScreen';
import { days, points } from '@screens/ranking/rankingFormat';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * A member seen by a classmate (owner / instructor: InstructorProfileScreen),
 * for the modality selected in the Início
 * header only (user decision: no list of modalities): big photo, name, the
 * cartel (competitor: always right after the name; the trophy badge on the
 * photo marks it), role, "Treina aqui desde …", the graduation
 * (belt in it) and, for a competitor, the cartel summary of it (never the
 * fights in detail) and the member's position in the modality ranking.
 * Never health data (water, weight, reach, plans) nor
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
  const today = useAcademyToday(active?.gymId);
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const isStudent = member?.role === 'student' && !!link;
  const ranking = useRanking(active?.gymId, isStudent ? selected?.id : undefined, period);
  const rankEntry = ranking.data?.find((e) => e.userId === memberId);

  if (classmates.isLoading || !active) {
    return (
      <Screen nativeHeader title="Membro" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
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

  // Owner / instructor: the instructor profile, the same screen the staff sees.
  if (member.role !== 'student') {
    return <InstructorProfileScreen academyId={active.gymId} userId={member.userId} onBack={back} />;
  }

  const showBelt = !!link && !!selected?.usesBelts;

  return (
    <Screen
      nativeHeader
      title=""
      largeTitle={false}
      onBack={back}
      // Since when: at the end of the scroll, like a footer (same as the instructor profile).
      endFooter={
        <Text variant="caption" textAlign="center">
          {`Treina aqui desde ${memberSinceLabel(member.memberSince)}`}
        </Text>
      }
    >
      <Box gap="s24">
        <Box alignItems="center" gap="s12">
          <Avatar name={member.fullName} path={member.avatarPath} size="large" competitor={competes} expandable />
          <Text variant="title" textAlign="center" accessibilityRole="header">
            {member.userId === userId ? `${member.fullName} (você)` : member.fullName}
          </Text>
        </Box>

        {/* A competitor's cartel comes right after the name (user decision, 2026-11-10). */}
        {competes ? (
          <Box gap="s8">
            <Text variant="captionCaps">{`Cartel · ${selected!.name}`}</Text>
            {record.isLoading ? <Spinner accessibilityLabel="Carregando cartel" /> : null}
            {cartel ? <FightRecordCard record={cartel} /> : null}
          </Box>
        ) : null}

        {showBelt ? (
          <Box gap="s8">
            <Text variant="captionCaps">{`Graduação · ${selected!.name}`}</Text>
            <Card>{link!.belt ? <BeltChip belt={link!.belt} /> : <Text variant="body">Sem faixa</Text>}</Card>
          </Box>
        ) : null}

        {isStudent && rankEntry ? (
          <Box gap="s8">
            <Text variant="captionCaps">{`Ranking · ${selected!.name}`}</Text>
            <Card>
              {rankEntry.status === 'ranked' && rankEntry.position != null ? (
                <Box
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  accessible
                  accessibilityLabel={`${rankEntry.position}º lugar, ${points(rankEntry.rankingScore)} pontos`}
                >
                  <Text variant="body">{`${rankEntry.position}º lugar`}</Text>
                  <Text variant="counter">{`${points(rankEntry.rankingScore)} pts`}</Text>
                </Box>
              ) : (
                <Text variant="body">{`Em classificação · faltam ${days(rankEntry.daysToQualify)}`}</Text>
              )}
            </Card>
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
