import { useState } from 'react';

import { Box, Button, EmptyState, HeaderButton, Screen, Text, Spinner } from '@components';
import {
  addDays,
  classesOn,
  useAcademyToday,
  useMyCheckins,
  useSchedules,
  weekStart,
  type LocalDate,
} from '@domain/Classes';
import { eventsOn, goingCount, myStatus, useEventRsvps, useEvents } from '@domain/Events';
import { DietWeekPicker } from '@screens/diet/DietWeekPicker';
import { EventAgendaRow } from '@screens/events/EventAgendaRow';
import { openEvents } from '@screens/events/parts';
import { ClassCard } from '@screens/student/ClassCard';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';


/**
 * Aulas (student), for the modality picked in the Início header: the days of
 * the week (today selected), the classes of the chosen day with the row of
 * classmates (check-in only today), plus the academy events of that day
 * (type seal, no check-in). No progress here (card and header seal
 * removed by the user; the Jornada stays without access).
 */
export function ClassesScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const events = useEvents(academyId);
  const rsvps = useEventRsvps(academyId);
  const { selected, isLoading: modalitiesLoading } = useActiveModality();
  const [monday, setMonday] = useState<LocalDate | null>(null);
  const [picked, setPicked] = useState<LocalDate | null>(null);

  // Every academy event the student sees (list → detail).
  const headerRight = <HeaderButton icon="party" accessibilityLabel="Eventos da academia" onPress={openEvents} />;

  const queries = [today, schedules, checkins];
  const loading = modalitiesLoading || queries.some((q) => q.isLoading);
  const failed = queries.some((q) => q.isError);

  if (loading || failed || !today.data || !academyId || !userId) {
    return (
      <Screen nativeHeader title="Aulas" bottomInset={false} headerRight={headerRight}>
        {failed ? (
          <EmptyState
            visual="icon"
            icon="offline"
            title="Não foi possível carregar as aulas"
            action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
          />
        ) : (
          <Spinner accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }

  const week = monday ?? weekStart(today.data);
  const date = picked ?? today.data;
  const modalitySchedules = (schedules.data ?? []).filter((s) => s.active && s.modalityId === selected?.id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const allEvents = events.data ?? [];
  const withClasses = new Set(
    days.filter((d) => classesOn(modalitySchedules, d).length > 0 || eventsOn(allEvents, d).length > 0),
  );
  const classes = classesOn(modalitySchedules, date);
  // Events are not classes (no check-in, no count): they only show up on their day.
  const dayEvents = eventsOn(allEvents, date);
  const answers = rsvps.data ?? [];

  return (
    <Screen nativeHeader title="Aulas" bottomInset={false} headerRight={headerRight}>
      <Box gap="s24">
        <DietWeekPicker
          monday={week}
          selected={date}
          today={today.data}
          marked={withClasses}
          unmarkedLabel="sem aulas"
          onSelect={setPicked}
          onChangeWeek={(next) => {
            setMonday(next);
            setPicked(next <= today.data! && today.data! <= addDays(next, 6) ? today.data! : next);
          }}
        />

        <Box gap="s12">
          {dayEvents.map((e) => (
            <EventAgendaRow
              key={e.id}
              event={e}
              going={goingCount(answers, e.id)}
              mineGoing={myStatus(answers, e.id, userId) === 'going'}
            />
          ))}
          {classes.length === 0 ? (
            <Text variant="body" color="textMuted">
              {date === today.data ? 'Sem aulas hoje.' : 'Sem aulas neste dia.'}
            </Text>
          ) : (
            classes.map((schedule) => (
              <ClassCard
                key={schedule.id}
                academyId={academyId}
                userId={userId}
                today={today.data!}
                date={date}
                schedule={schedule}
                checkin={(checkins.data ?? []).find((c) => c.scheduleId === schedule.id && c.classDate === date)}
              />
            ))
          )}
        </Box>

      </Box>
    </Screen>
  );
}
