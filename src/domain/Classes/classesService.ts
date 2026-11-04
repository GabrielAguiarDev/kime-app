import type { Belt } from '@components';
import { toAppError } from '@infra/supabase';

import { classesAdapter as adapter } from './classesAdapter';
import { classesApi as api } from './classesApi';
import type { ScheduleGroupPlan } from './scheduleGroups';
import type {
  AcademyCheckin,
  BeltAward,
  BeltGoal,
  Checkin,
  ClassSchedule,
  LocalDate,
  MemberStats,
  Modality,
  ScheduleInput,
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
  academyToday: (academyId: string): Promise<LocalDate> =>
    call(async () => {
      const today = await api.academyToday(academyId);
      if (!today) throw new Error('forbidden');
      return today;
    }),

  listSchedules: (academyId: string): Promise<ClassSchedule[]> =>
    call(async () => (await api.listSchedules(academyId)).map(adapter.toSchedule)),
  createSchedule: (academyId: string, input: ScheduleInput) =>
    call(() => api.createSchedule(academyId, { ...input, modality: input.modality.trim() })),
  updateSchedule: (id: string, input: ScheduleInput) =>
    call(() => api.updateSchedule(id, { ...input, modality: input.modality.trim() })),
  setScheduleActive: (id: string, active: boolean) => call(() => api.setScheduleActive(id, active)),
  /** Applies a planScheduleGroup() result. Off first, so a day never has two active rows. */
  saveScheduleGroup: (academyId: string, plan: ScheduleGroupPlan, startTime: string, modality: string) =>
    call(async () => {
      const name = modality.trim();
      await api.updateSchedules(plan.deactivate, { active: false });
      await api.updateSchedules(plan.retime, { start_time: startTime, modality: name, active: true });
      await api.updateSchedules(plan.activate, { active: true });
      await api.createSchedules(
        academyId,
        plan.create.map((weekday) => ({ weekday, startTime, modality: name })),
      );
    }),
  setSchedulesActive: (ids: string[], active: boolean) => call(() => api.updateSchedules(ids, { active })),
  deleteSchedules: (ids: string[]) => call(() => api.deleteSchedules(ids)),

  listModalities: (academyId: string): Promise<Modality[]> =>
    call(async () => (await api.listModalities(academyId)).map((m) => ({ id: m.id, name: m.name, position: m.position }))),
  /** Adds a modality to the academy (no-op when it already exists). */
  createModality: (academyId: string, name: string, position: number) =>
    call(() => api.createModality(academyId, name.trim(), position)),
  renameModality: (id: string, name: string) => call(() => api.renameModality(id, name.trim())),
  deleteModality: (id: string) => call(() => api.deleteModality(id)),

  listBeltGoals: (academyId: string): Promise<BeltGoal[]> =>
    call(async () => (await api.listBeltGoals(academyId)).map(adapter.toBeltGoal)),
  createBeltGoal: (academyId: string, belt: Belt, position: number, classesRequired: number) =>
    call(() => api.createBeltGoal(academyId, belt, position, classesRequired)),
  updateBeltGoal: (id: string, classesRequired: number) => call(() => api.updateBeltGoal(id, classesRequired)),
  deleteBeltGoal: (id: string) => call(() => api.deleteBeltGoal(id)),
  reorderBeltGoals: (academyId: string, orderedIds: string[]) =>
    call(() => api.reorderBeltGoals(academyId, orderedIds)),

  listMyCheckins: (academyId: string, userId: string): Promise<Checkin[]> =>
    call(async () => (await api.listMyCheckins(academyId, userId)).map(adapter.toCheckin)),
  listCheckinsOn: (academyId: string, date: LocalDate): Promise<AcademyCheckin[]> =>
    call(async () => (await api.listCheckinsOn(academyId, date)).map(adapter.toAcademyCheckin)),
  createCheckin: (academyId: string, userId: string, scheduleId: string, date: LocalDate) =>
    call(() => api.createCheckin(academyId, userId, scheduleId, date)),
  cancelCheckin: (id: string) => call(() => api.cancelCheckin(id)),
  decideCheckin: (id: string, status: 'confirmed' | 'rejected') => call(() => api.decideCheckin(id, status)),
  confirmAll: (scheduleId: string, date: LocalDate) => call(() => api.confirmAll(scheduleId, date)),

  listMemberStats: (academyId: string): Promise<MemberStats[]> =>
    call(async () => (await api.listMemberStats(academyId)).map(adapter.toMemberStats)),
  listBeltHistory: (membershipId: string): Promise<BeltAward[]> =>
    call(async () => (await api.listBeltHistory(membershipId)).map(adapter.toBeltAward)),
  awardBelt: (membershipId: string, belt: Belt) => call(() => api.awardBelt(membershipId, belt)),
};
