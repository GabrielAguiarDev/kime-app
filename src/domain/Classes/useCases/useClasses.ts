import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { classesService as service } from '../classesService';
import type { BeltInput, LocalDate, ScheduleInput } from '../classesTypes';
import type { ScheduleGroupPlan } from '../scheduleGroups';

// ---------------------------------------------------------------- today ---
/** Academy-local date from the server (never the device clock). */
export function useAcademyToday(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyToday, academyId],
    queryFn: () => service.academyToday(academyId!),
    enabled: !!academyId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ------------------------------------------------------------ schedules ---
export function useSchedules(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ClassSchedules, academyId],
    queryFn: () => service.listSchedules(academyId!),
    enabled: !!academyId,
  });
}

export function useScheduleMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [QueryKeys.ClassSchedules, academyId] }),
    queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking, academyId] }),
    // "Aulas que dá" on the instructor profiles.
    queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorProfile, academyId] }),
  ]);
  return {
    create: useMutation({ mutationFn: (input: ScheduleInput) => service.createSchedule(academyId, input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ScheduleInput }) => service.updateSchedule(id, input),
      onSuccess,
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) => service.setScheduleActive(id, active),
      onSuccess,
    }),
    /** One time + modality on several weekdays (see planScheduleGroup). */
    saveGroup: useMutation({
      mutationFn: ({
        plan,
        startTime,
        modalityId,
        instructorId,
      }: {
        plan: ScheduleGroupPlan;
        startTime: string;
        modalityId: string;
        instructorId: string | null;
      }) => service.saveScheduleGroup(academyId, plan, startTime, modalityId, instructorId),
      onSuccess,
    }),
    setGroupActive: useMutation({
      mutationFn: ({ ids, active }: { ids: string[]; active: boolean }) => service.setSchedulesActive(ids, active),
      onSuccess,
    }),
    removeGroup: useMutation({ mutationFn: (ids: string[]) => service.deleteSchedules(ids), onSuccess }),
  };
}

// ----------------------------------------------------------- modalities ---
export function useModalities(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Modalities, academyId],
    queryFn: () => service.listModalities(academyId!),
    enabled: !!academyId,
  });
}

/** Owner (settings): add, edit (name, uses belts) and remove modalities. */
export function useModalityMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Modalities, academyId] }),
      // Schedules show the modality name; removing one cascades to its belts
      // and detaches its check-ins.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ClassSchedules, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ModalityBelts, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ModalityStats, academyId] }),
    ]);
  return {
    create: useMutation({
      mutationFn: ({ name, position, usesBelts }: { name: string; position: number; usesBelts: boolean }) =>
        service.createModality(academyId, name, position, usesBelts),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, name, usesBelts }: { id: string; name: string; usesBelts: boolean }) =>
        service.updateModality(id, name, usesBelts),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteModality(id), onSuccess }),
  };
}

// -------------------------------------------------------- modality belts ---
/** Every belt of the academy (all modalities). Use beltsOf() to pick one modality. */
export function useBelts(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ModalityBelts, academyId],
    queryFn: () => service.listBelts(academyId!),
    enabled: !!academyId,
  });
}

/** Owner: one modality's belt sequence. */
export function useBeltMutations(academyId: string, modalityId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.ModalityBelts, academyId] });
  return {
    create: useMutation({
      mutationFn: ({ input, position }: { input: BeltInput; position: number }) =>
        service.createBelt(academyId, modalityId, input, position),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: BeltInput }) => service.updateBelt(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteBelt(id), onSuccess }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => service.reorderBelts(modalityId, orderedIds),
      onSuccess,
    }),
  };
}

// --------------------------------------------------- student check-ins ---
export function useMyCheckins(academyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyCheckins, academyId, userId],
    queryFn: () => service.listMyCheckins(academyId!, userId!),
    enabled: !!academyId && !!userId,
  });
}

export function useCheckIn(academyId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, date }: { scheduleId: string; date: LocalDate }) =>
      service.createCheckin(academyId, userId, scheduleId, date),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: [QueryKeys.MyCheckins, academyId, userId] }), queryClient.invalidateQueries({ queryKey: ['classAttendees'] }), queryClient.invalidateQueries({ queryKey: [QueryKeys.Discipline, userId] })]),
  });
}

export function useCancelCheckin(academyId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkinId: string) => service.cancelCheckin(checkinId),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: [QueryKeys.MyCheckins, academyId, userId] }), queryClient.invalidateQueries({ queryKey: ['classAttendees'] }), queryClient.invalidateQueries({ queryKey: [QueryKeys.Discipline, userId] })]),
  });
}

// ------------------------------------------------- professor check-ins ---
export function useAcademyCheckins(academyId: string | undefined, date: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyCheckins, academyId, date],
    queryFn: () => service.listCheckinsOn(academyId!, date!),
    enabled: !!academyId && !!date,
  });
}

function useInvalidateDecisions(academyId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.AcademyCheckins, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MemberStats, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ModalityStats, academyId] }),
      // Confirming the first check-in of a class creates its session.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ClassSessions, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorStats, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking, academyId] }),
    ]);
}

export function useDecideCheckin(academyId: string) {
  const onSuccess = useInvalidateDecisions(academyId);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'rejected' }) => service.decideCheckin(id, status),
    onSuccess,
  });
}

/** Staff: "Marcar presença" — confirmed attendance for a student who forgot the check-in. */
export function useMarkAttendance(academyId: string, markedBy: string) {
  const onSuccess = useInvalidateDecisions(academyId);
  return useMutation({
    mutationFn: ({ scheduleId, date, userId }: { scheduleId: string; date: LocalDate; userId: string }) =>
      service.markAttendance(academyId, scheduleId, date, userId, markedBy),
    onSuccess,
  });
}

/** Staff: check-ins between two dates (week summary). */
export function useAcademyCheckinsBetween(academyId: string | undefined, from: LocalDate | undefined, to: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyCheckins, academyId, from, to],
    queryFn: () => service.listCheckinsBetween(academyId!, from!, to!),
    enabled: !!academyId && !!from && !!to,
  });
}

/** Staff: classes given between two dates (week summary). */
export function useClassSessionsBetween(academyId: string | undefined, from: LocalDate | undefined, to: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ClassSessions, academyId, from, to],
    queryFn: () => service.listSessionsBetween(academyId!, from!, to!),
    enabled: !!academyId && !!from && !!to,
  });
}

export function useConfirmAll(academyId: string) {
  const onSuccess = useInvalidateDecisions(academyId);
  return useMutation({
    mutationFn: ({ scheduleId, date }: { scheduleId: string; date: LocalDate }) => service.confirmAll(scheduleId, date),
    onSuccess,
  });
}

// ----------------------------------------------------- stats and belts ---
/** Staff: every student of the academy. Student: only their own row (RLS). */
export function useMemberStats(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MemberStats, academyId],
    queryFn: () => service.listMemberStats(academyId!),
    enabled: !!academyId,
  });
}

/** Per student × modality: belt, classes in it and classes since the last graduation in it. */
export function useModalityStats(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ModalityStats, academyId],
    queryFn: () => service.listModalityStats(academyId!),
    enabled: !!academyId,
  });
}

export function useBeltHistory(membershipId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.BeltHistory, membershipId],
    queryFn: () => service.listBeltHistory(membershipId!),
    enabled: !!membershipId,
  });
}

/**
 * Training report of a student (own, or staff on MemberDetail). Under the
 * ModalityStats key: refreshed with the stats (check-ins, awards).
 */
export function useClassReport(academyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ModalityStats, academyId, 'report', userId],
    queryFn: () => service.getClassReport(academyId!, userId!),
    enabled: !!academyId && !!userId,
  });
}

export function useAwardBelt(academyId: string, membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beltId: string) => service.awardBelt(membershipId, beltId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.ModalityStats, academyId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.BeltHistory, membershipId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers, academyId] }),
        // "Alunos graduados" on the instructor profile.
        queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorProfile, academyId] }),
      ]),
  });
}

// ------------------------------------------------------ class sessions ---
/** Staff: classes given on a date, with who taught each one. */
export function useClassSessions(academyId: string | undefined, date: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ClassSessions, academyId, date],
    queryFn: () => service.listSessionsOn(academyId!, date!),
    enabled: !!academyId && !!date,
  });
}

export function useSetSessionInstructor(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, instructorId }: { sessionId: string; instructorId: string }) =>
      service.setSessionInstructor(sessionId, instructorId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.ClassSessions, academyId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.InstructorStats, academyId] }),
      ]),
  });
}

/** Staff: classes taught per owner/instructor. */
export function useInstructorStats(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.InstructorStats, academyId],
    queryFn: () => service.listInstructorStats(academyId!),
    enabled: !!academyId,
  });
}
