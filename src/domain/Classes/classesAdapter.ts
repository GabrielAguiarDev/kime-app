import type {
  AcademyCheckinRowApi,
  BeltAwardRowApi,
  BeltRowApi,
  CheckinRowApi,
  MemberStatsRowApi,
  ModalityRowApi,
  ModalityStatsRowApi,
  ScheduleRowApi,
} from './classesApi';
import type {
  AcademyCheckin,
  BeltAward,
  BeltColorKey,
  Checkin,
  ClassSchedule,
  MemberStats,
  Modality,
  ModalityBelt,
  ModalityStats,
  Weekday,
} from './classesTypes';

// Columns only accept palette keys (DB check).
const asColor = (value: string) => value as BeltColorKey;

function toSchedule(row: ScheduleRowApi): ClassSchedule {
  return {
    id: row.id,
    academyId: row.academy_id,
    weekday: row.weekday as Weekday,
    startTime: row.start_time.slice(0, 5),
    modalityId: row.modality_id,
    modality: row.modality?.name ?? 'Aula',
    active: row.active,
  };
}

function toCheckin(row: CheckinRowApi): Checkin {
  return {
    id: row.id,
    userId: row.user_id,
    scheduleId: row.schedule_id,
    modalityId: row.modality_id,
    classDate: row.class_date,
    status: row.status,
    reviewedAt: row.reviewed_at,
  };
}

function toAcademyCheckin(row: AcademyCheckinRowApi): AcademyCheckin {
  return { ...toCheckin(row), fullName: row.profile?.full_name || 'Sem nome' };
}

function toModality(row: ModalityRowApi): Modality {
  return { id: row.id, name: row.name, position: row.position, usesBelts: row.uses_belts, weeklyClassGoal: row.weekly_class_goal };
}

function toBelt(row: BeltRowApi): ModalityBelt {
  return {
    id: row.id,
    modalityId: row.modality_id,
    primary: asColor(row.primary_color),
    tip: row.tip_color ? asColor(row.tip_color) : null,
    position: row.position,
    classesRequired: row.classes_required,
  };
}

function toMemberStats(row: MemberStatsRowApi): MemberStats {
  return {
    membershipId: row.membership_id ?? '',
    userId: row.user_id ?? '',
    confirmedTotal: row.confirmed_total ?? 0,
  };
}

function toModalityStats(row: ModalityStatsRowApi): ModalityStats {
  return {
    membershipId: row.membership_id ?? '',
    userId: row.user_id ?? '',
    modalityId: row.modality_id ?? '',
    beltId: row.belt_id,
    beltAwardedAt: row.belt_awarded_at,
    confirmedTotal: row.confirmed_total ?? 0,
    confirmedSinceBelt: row.confirmed_since_belt ?? 0,
  };
}

function toBeltAward(row: BeltAwardRowApi): BeltAward {
  return {
    id: row.id,
    modalityId: row.modality_id,
    beltId: row.belt_id,
    // belt_id is NOT NULL with a FK: the embedded belt always exists.
    belt: { primary: asColor(row.belt.primary_color), tip: row.belt.tip_color ? asColor(row.belt.tip_color) : null },
    awardedAt: row.awarded_at,
  };
}

export const classesAdapter = {
  toSchedule,
  toCheckin,
  toAcademyCheckin,
  toModality,
  toBelt,
  toMemberStats,
  toModalityStats,
  toBeltAward,
};
