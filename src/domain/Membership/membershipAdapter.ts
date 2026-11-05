import { logoUrl } from '@domain/Gym/gymApi';

import type { GymMemberRowApi, MembershipRowApi, PendingRequestRowApi } from './membershipApi';
import type { GymMember, Membership, PendingRequest, StudentModality } from './membershipTypes';

type EnrollmentRow = NonNullable<MembershipRowApi['student_modality_enrollments']>[number];

/** Active links only, in a stable order (the screen sorts by the modality position). */
function toStudentModalities(rows: EnrollmentRow[] | null | undefined): StudentModality[] {
  return (rows ?? [])
    .filter((r) => r.status === 'active')
    .map((r) => ({
      enrollmentId: r.id,
      modalityId: r.modality_id,
      startedAt: r.started_at,
      weeklyClassGoal: r.weekly_class_goal,
      isCompetitor: r.is_competitor,
      competitorInvitedAt: r.competitor_invited_at,
      competitorSince: r.competitor_since,
    }));
}

function toMembership(row: MembershipRowApi): Membership {
  return {
    id: row.id,
    gymId: row.academy_id,
    gymName: row.academies?.name ?? '',
    gymLogoUrl: logoUrl(row.academies?.logo_path),
    role: row.role,
    status: row.status,
    isCompetitor: row.is_competitor,
    competitorInvitedAt: row.competitor_invited_at,
    competitorSince: row.competitor_since,
    decidedAt: row.decided_at,
    modalities: toStudentModalities(row.student_modality_enrollments),
  };
}

function toGymMember(row: GymMemberRowApi): GymMember {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.profile?.full_name || 'Sem nome',
    role: row.role,
    status: row.status,
    isCompetitor: row.is_competitor,
    competitorInvitedAt: row.competitor_invited_at,
    competitorSince: row.competitor_since,
    avatarPath: row.profile?.avatar_path ?? null,
    createdAt: row.created_at,
    modalities: toStudentModalities(row.student_modality_enrollments),
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
