import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { eventsService as service } from '../eventsService';
import type { EventInput, EventPerson, RsvpStatus } from '../eventsTypes';

/** Events of the academy the caller sees (staff: all; student: their modalities and "all"). */
export function useEvents(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyEvents, academyId],
    queryFn: () => service.listEvents(academyId!),
    enabled: !!academyId,
  });
}

/** Answers visible to the caller: counts ("12 vão") and the caller's own answer. */
export function useEventRsvps(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.EventRsvps, academyId],
    queryFn: () => service.listRsvps(academyId!),
    enabled: !!academyId,
  });
}

/** Audience of one event (staff: everyone with attendance and payment; member: who is going). */
export function useEventPeople(eventId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.EventPeople, eventId],
    queryFn: () => service.listPeople(eventId!),
    enabled: !!eventId,
  });
}

function useInvalidateEvents(academyId: string | undefined) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.AcademyEvents, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EventRsvps, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EventPeople] }),
    ]);
}

/** The member's own answer ("Vou" / "Não vou"). */
export function useRespondEvent(academyId: string | undefined, userId: string | undefined) {
  const onSettled = useInvalidateEvents(academyId);
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: RsvpStatus }) => service.respond(academyId!, eventId, userId!, status),
    onSettled,
  });
}

/** Staff: create, edit, cancel; attendance and payment. */
export function useEventMutations(academyId: string) {
  const onSuccess = useInvalidateEvents(academyId);
  const queryClient = useQueryClient();
  const onPeople = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.EventPeople] });
  type Mark = { eventId: string; userIds: string[]; on: boolean };
  // Optimistic: the row and the totals change on the tap; an error rolls back.
  const optimistic = (field: 'attended' | 'paid') => ({
    onMutate: async ({ eventId, userIds, on }: Mark) => {
      const key = [QueryKeys.EventPeople, eventId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EventPerson[]>(key);
      queryClient.setQueryData<EventPerson[]>(key, (list) =>
        list?.map((p) => (userIds.includes(p.userId) ? { ...p, [field]: on } : p)),
      );
      return { key, previous };
    },
    onError: (_e: unknown, _v: Mark, context: { key: (string | QueryKeys)[]; previous?: EventPerson[] } | undefined) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
  });
  return {
    save: useMutation({
      mutationFn: ({ id, input, previousCover }: { id: string | null; input: EventInput; previousCover: string | null }) =>
        service.saveEvent(academyId, id, input, previousCover),
      onSuccess,
    }),
    cancel: useMutation({ mutationFn: (id: string) => service.cancelEvent(id), onSuccess }),
    attendance: useMutation({
      mutationFn: ({ eventId, userIds, on }: { eventId: string; userIds: string[]; on: boolean }) =>
        service.setAttendance(academyId, eventId, userIds, on),
      ...optimistic('attended'),
      onSettled: onPeople,
    }),
    paid: useMutation({
      mutationFn: ({ eventId, userIds, on }: { eventId: string; userIds: string[]; on: boolean }) =>
        service.setPaid(academyId, eventId, userIds, on),
      ...optimistic('paid'),
      onSettled: onPeople,
    }),
  };
}
