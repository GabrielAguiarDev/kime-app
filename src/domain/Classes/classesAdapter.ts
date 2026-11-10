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
  ClassReport,
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
  return { ...toCheckin(row), fullName: row.profile?.full_name || 'Sem nome', avatarPath: row.profile?.avatar_path ?? null };
}

function toModality(row: ModalityRowApi): Modality {
  return { id: row.id, name: row.name, position: row.position, usesBelts: row.uses_belts };
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

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : null);

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const list = (v: unknown) => (Array.isArray(v) ? v : []).map(obj).filter((o): o is Record<string, unknown> => !!o);

/** class_report JSON → ClassReport (null: no access / no student membership). */
function toClassReport(json: unknown): ClassReport | null {
  const row = obj(json);
  const joinedAt = str(row?.joined_at);
  const today = str(row?.today);
  if (!row || !joinedAt || !today) return null;
  return {
    joinedAt,
    today,
    recentSince: str(row.recent_since) ?? today,
    enrollments: list(row.enrollments).flatMap((e) => {
      const modalityId = str(e.modality_id);
      return modalityId ? [{ modalityId, status: str(e.status) ?? 'active', isCompetitor: e.is_competitor === true }] : [];
    }),
    modalities: list(row.modalities).flatMap((m) => {
      const modalityId = str(m.modality_id);
      return modalityId ? [{ modalityId, total: num(m.total), sinceBelt: num(m.since_belt), recent: num(m.recent) }] : [];
    }),
    months: list(row.months).flatMap((m) => {
      const month = str(m.month);
      return month ? [{ month, modalityId: str(m.modality_id), classes: num(m.classes) }] : [];
    }),
    weeks: (Array.isArray(row.weeks) ? row.weeks : []).filter((w): w is string => typeof w === 'string'),
    belts: list(row.belts).flatMap((b) => {
      const modalityId = str(b.modality_id);
      const beltId = str(b.belt_id);
      const awardedAt = str(b.awarded_at);
      return modalityId && beltId && awardedAt
        ? [{ modalityId, beltId, awardedAt, nextAwardedAt: str(b.next_awarded_at), classes: num(b.classes) }]
        : [];
    }),
    milestones: list(row.milestones).flatMap((m) => {
      const modalityId = str(m.modality_id);
      const date = str(m.date);
      return modalityId && date ? [{ modalityId, count: num(m.count), date }] : [];
    }),
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
  toClassReport,
};
