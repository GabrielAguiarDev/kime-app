import type { GymMemberRowApi, MembershipRowApi, PendingRequestRowApi } from './membershipApi';
import type { GymMember, Membership, PendingRequest } from './membershipTypes';

function toMembership(row: MembershipRowApi): Membership {
  return {
    id: row.id,
    gymId: row.gym_id,
    gymName: row.gyms?.name ?? '',
    role: row.role,
    status: row.status,
  };
}

function toGymMember(row: GymMemberRowApi): GymMember {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.profile?.full_name || 'Sem nome',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toPendingRequest(row: PendingRequestRowApi): PendingRequest {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    fullName: row.full_name || 'Sem nome',
    email: row.email,
    role: row.role,
    requestedAt: row.requested_at,
  };
}

export const membershipAdapter = { toMembership, toGymMember, toPendingRequest };
