import { toAppError } from '@infra/supabase';

import { classesAdapter as adapter } from './classesAdapter';
import { classesApi as api } from './classesApi';
import type { ScheduleGroupPlan } from './scheduleGroups';
import type {
  AcademyCheckin,
  BeltAward,
  BeltInput,
  Checkin,
  ClassSchedule,
  LocalDate,
  MemberStats,
  Modality,
  ModalityBelt,
  ModalityStats,
  ScheduleInput,
  ClassSession,
  InstructorStats,
} from './classesTypes';

/** Wraps an API call so every failure reaches the UI as an AppError. */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

export const classesService = {
  listSessionsOn: (academyId: string, date: LocalDate): Promise<ClassSession[]> =>
    call(async () =>
      (await api.listSessionsOn(academyId, date)).map((r) => ({
        id: r.id,
        scheduleId: r.schedule_id,
        classDate: r.class_date,
        instructorId: r.instructor_id,
      })),
    ),
  setSessionInstructor: (sessionId: string, instructorId: string) =>
    call(() => api.setSessionInstructor(sessionId, instructorId)),
  listInstructorStats: (academyId: string): Promise<InstructorStats[]> =>
    call(async () =>
      (await api.listInstructorStats(academyId)).map((r) => ({
        membershipId: r.membership_id ?? '',
        userId: r.user_id ?? '',
        classesTaught: r.classes_taught ?? 0,
      })),
    ),

  academyToday: (academyId: string): Promise<LocalDate> =>
    call(async () => {
      const today = await api.academyToday(academyId);
      if (!today) throw new Error('forbidden');
      return today;
    }),

  listSchedules: (academyId: string): Promise<ClassSchedule[]> =>
    call(async () => (await api.listSchedules(academyId)).map(adapter.toSchedule)),
  createSchedule: (academyId: string, input: ScheduleInput) => call(() => api.createSchedule(academyId, input)),
  updateSchedule: (id: string, input: ScheduleInput) => call(() => api.updateSchedule(id, input)),
  setScheduleActive: (id: string, active: boolean) => call(() => api.setScheduleActive(id, active)),
  /** Applies a planScheduleGroup() result. Off first, so a day never has two active rows. */
  saveScheduleGroup: (academyId: string, plan: ScheduleGroupPlan, startTime: string, modalityId: string) =>
    call(async () => {
      await api.updateSchedules(plan.deactivate, { active: false });
      await api.updateSchedules(plan.retime, { start_time: startTime, modality_id: modalityId, active: true });
      await api.updateSchedules(plan.activate, { active: true });
      await api.createSchedules(
        academyId,
        plan.create.map((weekday) => ({ weekday, startTime, modalityId })),
      );
    }),
  setSchedulesActive: (ids: string[], active: boolean) => call(() => api.updateSchedules(ids, { active })),
  deleteSchedules: (ids: string[]) => call(() => api.deleteSchedules(ids)),

  listModalities: (academyId: string): Promise<Modality[]> =>
    call(async () => (await api.listModalities(academyId)).map(adapter.toModality)),
  createModality: (academyId: string, name: string, position: number, usesBelts: boolean) =>
    call(() => api.createModality(academyId, name.trim(), position, usesBelts)),
  updateModality: (id: string, name: string, usesBelts: boolean) =>
    call(() => api.updateModality(id, { name: name.trim(), uses_belts: usesBelts })),
  /** Fails with modality_has_schedules (23503) while schedules point at it. */
  deleteModality: (id: string) => call(() => api.deleteModality(id)),

  listBelts: (academyId: string): Promise<ModalityBelt[]> =>
    call(async () => (await api.listBelts(academyId)).map(adapter.toBelt)),
  createBelt: (academyId: string, modalityId: string, input: BeltInput, position: number) =>
    call(() => api.createBelt(academyId, modalityId, input, position)),
  updateBelt: (id: string, input: BeltInput) => call(() => api.updateBelt(id, input)),
  deleteBelt: (id: string) => call(() => api.deleteBelt(id)),
  reorderBelts: (modalityId: string, orderedIds: string[]) => call(() => api.reorderBelts(modalityId, orderedIds)),

  listMyCheckins: (academyId: string, userId: string): Promise<Checkin[]> =>
    call(async () => (await api.listMyCheckins(academyId, userId)).map(adapter.toCheckin)),
  listCheckinsOn: (academyId: string, date: LocalDate): Promise<AcademyCheckin[]> =>
    call(async () => (await api.listCheckinsOn(academyId, date)).map(adapter.toAcademyCheckin)),
  listCheckinsBetween: (academyId: string, from: LocalDate, to: LocalDate): Promise<AcademyCheckin[]> =>
    call(async () => (await api.listCheckinsBetween(academyId, from, to)).map(adapter.toAcademyCheckin)),
  markAttendance: (academyId: string, scheduleId: string, date: LocalDate, userId: string, markedBy: string) =>
    call(() => api.markAttendance(academyId, scheduleId, date, userId, markedBy)),
  listSessionsBetween: (academyId: string, from: LocalDate, to: LocalDate): Promise<ClassSession[]> =>
    call(async () =>
      (await api.listSessionsBetween(academyId, from, to)).map((r) => ({
        id: r.id,
        scheduleId: r.schedule_id,
        classDate: r.class_date,
        instructorId: r.instructor_id,
      })),
    ),
  createCheckin: (academyId: string, userId: string, scheduleId: string, date: LocalDate) =>
    call(() => api.createCheckin(academyId, userId, scheduleId, date)),
  cancelCheckin: (id: string) => call(() => api.cancelCheckin(id)),
  decideCheckin: (id: string, status: 'confirmed' | 'rejected') => call(() => api.decideCheckin(id, status)),
  confirmAll: (scheduleId: string, date: LocalDate) => call(() => api.confirmAll(scheduleId, date)),

  listMemberStats: (academyId: string): Promise<MemberStats[]> =>
    call(async () => (await api.listMemberStats(academyId)).map(adapter.toMemberStats)),
  listModalityStats: (academyId: string): Promise<ModalityStats[]> =>
    call(async () => (await api.listModalityStats(academyId)).map(adapter.toModalityStats)),
  listBeltHistory: (membershipId: string): Promise<BeltAward[]> =>
    call(async () => (await api.listBeltHistory(membershipId)).map(adapter.toBeltAward)),
  awardBelt: (membershipId: string, beltId: string) => call(() => api.awardBelt(membershipId, beltId)),
};
