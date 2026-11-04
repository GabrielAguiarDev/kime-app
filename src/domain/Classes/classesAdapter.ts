import type { Belt } from '@components';

import type {
  AcademyCheckinRowApi,
  BeltAwardRowApi,
  BeltGoalRowApi,
  CheckinRowApi,
  MemberStatsRowApi,
  ScheduleRowApi,
} from './classesApi';
import type {
  AcademyCheckin,
  BeltAward,
  BeltGoal,
  Checkin,
  ClassSchedule,
  MemberStats,
  Weekday,
} from './classesTypes';

// Belt columns only accept palette keys (DB check constraint).
const asBelt = (value: string) => value as Belt;

function toSchedule(row: ScheduleRowApi): ClassSchedule {
  return {
    id: row.id,
    academyId: row.academy_id,
    weekday: row.weekday as Weekday,
    startTime: row.start_time.slice(0, 5),
    modality: row.modality,
    active: row.active,
  };
}

function toCheckin(row: CheckinRowApi): Checkin {
  return {
    id: row.id,
    userId: row.user_id,
    scheduleId: row.schedule_id,
    classDate: row.class_date,
    status: row.status,
    reviewedAt: row.reviewed_at,
  };
}

function toAcademyCheckin(row: AcademyCheckinRowApi): AcademyCheckin {
  return { ...toCheckin(row), fullName: row.profile?.full_name || 'Sem nome' };
}

function toBeltGoal(row: BeltGoalRowApi): BeltGoal {
  return { id: row.id, belt: asBelt(row.belt), position: row.position, classesRequired: row.classes_required };
}

function toMemberStats(row: MemberStatsRowApi): MemberStats {
  return {
    membershipId: row.membership_id ?? '',
    userId: row.user_id ?? '',
    belt: row.belt ? asBelt(row.belt) : null,
    beltAwardedAt: row.belt_awarded_at,
    confirmedTotal: row.confirmed_total ?? 0,
    confirmedSinceBelt: row.confirmed_since_belt ?? 0,
  };
}

function toBeltAward(row: BeltAwardRowApi): BeltAward {
  return { id: row.id, belt: asBelt(row.belt), awardedAt: row.awarded_at };
}

export const classesAdapter = {
  toSchedule,
  toCheckin,
  toAcademyCheckin,
  toBeltGoal,
  toMemberStats,
  toBeltAward,
};
