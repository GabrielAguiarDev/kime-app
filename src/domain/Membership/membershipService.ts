import { toAppError } from '@infra/supabase';

import { membershipAdapter } from './membershipAdapter';
import { membershipApi } from './membershipApi';
import type { GymMember, Membership, PendingRequest } from './membershipTypes';

async function listMine(userId: string): Promise<Membership[]> {
  try {
    const rows = await membershipApi.listMine(userId);
    return rows.map(membershipAdapter.toMembership);
  } catch (e) {
    throw toAppError(e);
  }
}

async function listByGym(gymId: string): Promise<GymMember[]> {
  try {
    const rows = await membershipApi.listByGym(gymId);
    return rows.map(membershipAdapter.toGymMember);
  } catch (e) {
    throw toAppError(e);
  }
}

async function listPending(gymId: string): Promise<PendingRequest[]> {
  try {
    const rows = await membershipApi.listPending(gymId);
    return rows.map(membershipAdapter.toPendingRequest);
  } catch (e) {
    throw toAppError(e);
  }
}

async function remove(membershipId: string): Promise<void> {
  try {
    await membershipApi.remove(membershipId);
  } catch (e) {
    throw toAppError(e);
  }
}

async function decide(membershipId: string, approve: boolean): Promise<void> {
  try {
    await membershipApi.decide(membershipId, approve);
  } catch (e) {
    throw toAppError(e);
  }
}

async function approveStudent(membershipId: string, modalityIds: string[]): Promise<void> {
  try {
    await membershipApi.approveStudent(membershipId, modalityIds);
  } catch (e) {
    throw toAppError(e);
  }
}

async function setStudentModalities(membershipId: string, modalityIds: string[]): Promise<void> {
  try {
    await membershipApi.setStudentModalities(membershipId, modalityIds);
  } catch (e) {
    throw toAppError(e);
  }
}

async function setStudentWeeklyGoal(membershipId: string, modalityId: string, goal: number | null): Promise<void> {
  try {
    await membershipApi.setStudentWeeklyGoal(membershipId, modalityId, goal);
  } catch (e) {
    throw toAppError(e);
  }
}

/** Owner only. The target must be an active professor; the owner becomes a professor. */
async function transferOwnership(gymId: string, membershipId: string): Promise<void> {
  try {
    await membershipApi.transferOwnership(gymId, membershipId);
  } catch (e) {
    throw toAppError(e);
  }
}

export const membershipService = {
  transferOwnership,
  listMine,
  listByGym,
  listPending,
  remove,
  decide,
  approveStudent,
  setStudentModalities,
  setStudentWeeklyGoal,
};
