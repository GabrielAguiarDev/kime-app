import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Avatar, BigCounter, Box, Button, Card, EmptyState, Icon, LoadError, StatusBadge, Text } from '@components';
import {
  attendanceCounts,
  classesOn,
  nextClass,
  nowTimeIn,
  startsInLabel,
  useAcademyCheckins,
  useAcademyCheckinsBetween,
  useAcademyToday,
  useClassSessionsBetween,
  useSchedules,
  useModalities,
  WEEKDAY_LABELS,
  weekdayOf,
  weekStart,
  type ClassSchedule,
  type NextClass,
} from '@domain/Classes';
import { countdownLabel, daysBetween, formatLocalDate, upcomingChampionships, useChampionships } from '@domain/Competition';
import { usePendingRequests } from '@domain/Membership';
import { rankingPeriod, useRanking } from '@domain/Ranking';
import { useActiveGym } from '@services/activeGym';

/** Academy calendar (fixed time zone, see academies.timezone). */
const ACADEMY_TIME_ZONE = 'America/Sao_Paulo';
/** Championships within this many days show up as a notice. */
const CHAMPIONSHIP_NOTICE_DAYS = 30;

/**
 * Início (owner / instructor): the next class in focus (attendance and timer),
 * the other classes of the day, notices (join requests, a championship in the
 * next 30 days) only when there are any, and the week summary.
 */
export function StaffHome() {
  const { active, isOwner } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useAcademyCheckins(academyId, today.data);

  if (today.isLoading || schedules.isLoading) return <ActivityIndicator accessibilityLabel="Carregando" />;
  if (today.isError || schedules.isError || !today.data || !academyId) {
    return (
      <LoadError
        title="Não foi possível carregar as aulas de hoje"
        onRetry={() => {
          void today.refetch();
          void schedules.refetch();
        }}
      />
    );
  }

  const all = schedules.data ?? [];
  const next = nextClass(all, today.data, nowTimeIn(ACADEMY_TIME_ZONE));
  const others = classesOn(all, today.data).filter((c) => c.id !== (next?.date === today.data ? next.schedule.id : ''));

  return (
    // Same space above the first card as between the sections (the header has no large title here).
    <Box gap="s32" paddingTop="s32">
      {all.length === 0 ? (
        <EmptyState
          title="Nenhum horário cadastrado."
          description={isOwner ? 'Cadastre as aulas da semana em Aulas.' : 'O proprietário cadastra os horários.'}
        />
      ) : next ? (
        <NextClassCard next={next} counts={attendanceCounts(checkins.data ?? [], next.schedule.id)} />
      ) : null}

      {others.length > 0 ? (
        <Box gap="s12">
          <Text variant="captionCaps">Aulas de hoje</Text>
          {others.map((c) => (
            <TodayClassRow key={c.id} schedule={c} date={today.data!} pending={attendanceCounts(checkins.data ?? [], c.id).pending} />
          ))}
        </Box>
      ) : null}

      <Notices academyId={academyId} today={today.data} />
      <WeekSummary academyId={academyId} today={today.data} />
    </Box>
  );
}

function NextClassCard({ next, counts }: { next: NextClass; counts: { confirmed: number; pending: number } }) {
  const { schedule, date, status } = next;
  const isToday = status !== 'later';
  const when = isToday
    ? startsInLabel(next)
    : `${WEEKDAY_LABELS[weekdayOf(date)].long}, ${formatLocalDate(date).replace(/ \d{4}$/, '')}`;
  return (
    <Card gap="s16" selected={status === 'live'}>
      <Text variant="captionCaps">{isToday ? 'Próxima aula' : 'Próxima aula da semana'}</Text>
      <Box flexDirection="row" alignItems="flex-end" gap="s12">
        <Text variant="displayLg">{schedule.startTime}</Text>
        <Box flex={1} paddingBottom="s4">
          <Text variant="heading">{schedule.modality}</Text>
          <Text variant="body" color={status === 'live' ? 'accent' : 'textMuted'}>
            {when}
          </Text>
        </Box>
      </Box>
      {isToday ? (
        <>
          <Box flexDirection="row" alignItems="center" gap="s12">
            <Text variant="bodyStrong">
              {counts.confirmed} {counts.confirmed === 1 ? 'confirmado' : 'confirmados'}
            </Text>
            {counts.pending > 0 ? (
              <StatusBadge status="pending" label={counts.pending === 1 ? '1 pendente' : `${counts.pending} pendentes`} />
            ) : (
              <Text variant="caption">nenhum pendente</Text>
            )}
          </Box>
          <Box flexDirection="row" gap="s12">
            <Box flex={1}>
              <Button
                title="Presença"
                icon="checks"
                onPress={() => router.push({ pathname: '/presenca', params: { schedule: schedule.id, date } })}
              />
            </Box>
            <Box flex={1}>
              <Button
                title="Timer"
                icon="timer"
                variant="secondary"
                onPress={() => router.navigate({ pathname: '/timer', params: { modality: schedule.modalityId } })}
              />
            </Box>
          </Box>
        </>
      ) : null}
    </Card>
  );
}

function TodayClassRow({ schedule, date, pending }: { schedule: ClassSchedule; date: string; pending: number }) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/presenca', params: { schedule: schedule.id, date } })}
      accessibilityLabel={`${schedule.startTime}, ${schedule.modality}, ${pending} pendentes. Abrir lista de presença`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Text variant="counter">{schedule.startTime}</Text>
      <Text variant="bodyStrong" flex={1}>
        {schedule.modality}
      </Text>
      {pending > 0 ? (
        <StatusBadge status="pending" label={pending === 1 ? '1 pendente' : `${pending} pendentes`} />
      ) : null}
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

/** Only when there is something: join requests waiting, a championship in the next 30 days. */
function Notices({ academyId, today }: { academyId: string; today: string }) {
  const requests = usePendingRequests(academyId);
  const championships = useChampionships(academyId);
  const pendingCount = requests.data?.length ?? 0;
  const soon = upcomingChampionships(championships.data ?? [], today).filter(
    (c) => daysBetween(today, c.eventDate) <= CHAMPIONSHIP_NOTICE_DAYS,
  );
  if (pendingCount === 0 && soon.length === 0) return null;

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Avisos</Text>
      {pendingCount > 0 ? (
        <Card
          onPress={() => router.push('/pedidos')}
          accessibilityLabel={`${pendingCount} pedidos de entrada aguardando. Abrir`}
          flexDirection="row"
          alignItems="center"
          gap="s12"
        >
          <Icon name="users" color="accent" active />
          <Text variant="bodyStrong" flex={1}>
            {pendingCount === 1 ? '1 pedido de entrada aguardando' : `${pendingCount} pedidos de entrada aguardando`}
          </Text>
          <Icon name="chevronRight" color="textMuted" />
        </Card>
      ) : null}
      {soon.map((c) => (
        <Card
          key={c.id}
          onPress={() => router.push({ pathname: '/academy/championship', params: { id: c.id } })}
          accessibilityLabel={`${c.name}: ${countdownLabel(daysBetween(today, c.eventDate))}. Abrir campeonato`}
          flexDirection="row"
          alignItems="center"
          gap="s12"
        >
          <Icon name="trophy" color="accent" active />
          <Box flex={1} gap="s4">
            <Text variant="bodyStrong">{c.name}</Text>
            <Text variant="caption">
              {countdownLabel(daysBetween(today, c.eventDate))} · {formatLocalDate(c.eventDate)}
            </Text>
          </Box>
          <Icon name="chevronRight" color="textMuted" />
        </Card>
      ))}
    </Box>
  );
}

/** Classes given and attendances this week (Monday–today), and the top 3 of the first modality. */
function WeekSummary({ academyId, today }: { academyId: string; today: string }) {
  const from = weekStart(today);
  const sessions = useClassSessionsBetween(academyId, from, today);
  const checkins = useAcademyCheckinsBetween(academyId, from, today);
  const modalities = useModalities(academyId);
  const modality = modalities.data?.[0];
  const ranking = useRanking(academyId, modality?.id, rankingPeriod(today));
  const attendances = (checkins.data ?? []).filter((c) => c.status === 'confirmed').length;
  const top = (ranking.data ?? []).filter((e) => e.status === 'ranked').slice(0, 3);

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Resumo da semana</Text>
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <Card>
            <BigCounter value={sessions.data ? sessions.data.length : '–'} label="Aulas dadas" />
          </Card>
        </Box>
        <Box flex={1}>
          <Card>
            <BigCounter value={checkins.data ? attendances : '–'} label="Presenças" />
          </Card>
        </Box>
      </Box>
      <Card gap="s12" onPress={() => router.push('/ranking')} accessibilityLabel="Ranking por modalidade. Abrir o ranking">
        <Text variant="captionCaps">{modality ? `Ranking · ${modality.name}` : 'Ranking por modalidade'}</Text>
        {modalities.isLoading || ranking.isLoading ? <ActivityIndicator /> : null}
        {ranking.data && top.length === 0 ? (
          <Text variant="body" color="textMuted">
            Nenhum aluno classificado ainda.
          </Text>
        ) : null}
        {top.map((e) => (
          <Box key={e.userId} flexDirection="row" alignItems="center" gap="s12">
            <Text variant="counter" color="accent">
              {e.position}º
            </Text>
            <Avatar name={e.fullName} path={e.avatarPath} />
            <Text variant="bodyStrong" flex={1} numberOfLines={1}>
              {e.fullName}
            </Text>
            <Text variant="caption">{e.rankingScore.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pontos</Text>
          </Box>
        ))}
      </Card>
    </Box>
  );
}
