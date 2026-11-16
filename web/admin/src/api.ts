import { supabase } from './supabase';

export type Role = 'owner' | 'instructor' | 'student';
export type Status = 'pending' | 'active' | 'rejected';
/** A plan code of the catalog (public.platform_plans). */
export type PlanTier = string;
export type Sex = 'female' | 'male' | 'unspecified';

export interface Overview {
  academies: number;
  users: number;
  active_students: number;
  active_staff: number;
  pending_requests: number;
}

export interface AcademyRow {
  id: string;
  name: string;
  logo_path: string | null;
  plan_tier: PlanTier | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  students: number;
  staff: number;
  pending: number;
}

export interface Academy {
  id: string;
  name: string;
  logo_path: string | null;
  plan_tier: PlanTier | null;
  timezone: string;
  inactive_after_days: number;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

export interface Modality {
  id: string;
  name: string;
}

export interface MemberModality {
  enrollment_id: string;
  modality_id: string;
  name: string;
  is_competitor: boolean;
}

export interface Member {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: Role;
  status: Status;
  is_competitor: boolean;
  created_at: string;
  decided_at: string | null;
  modalities: MemberModality[];
}

export interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  academies: number;
  total_count: number;
}

export interface UserMembership {
  membership_id: string;
  academy_id: string;
  academy_name: string;
  role: Role;
  status: Status;
  is_competitor: boolean;
  created_at: string;
}

export interface UserDetail {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_anonymous: boolean;
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  reach_cm: number | null;
  timezone: string | null;
  memberships: UserMembership[];
}

export interface ProfileInput {
  full_name: string;
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  reach_cm: number | null;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type BillingPeriod = 'monthly' | 'annual';
export type InvoiceStatus = 'open' | 'paid' | 'void';
export type PaymentMethod = 'pix' | 'boleto' | 'card' | 'transfer' | 'cash' | 'other';
export type TicketStatus = 'open' | 'answered' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';
export type NoteKind = 'note' | 'call' | 'whatsapp' | 'email' | 'meeting';
export type Audience = 'owners' | 'staff' | 'everyone';

export interface Plan {
  id: string;
  code: string;
  name: string;
  monthly_price_cents: number;
  annual_discount_pct: number;
  student_limit: number | null;
  benefits: string[];
  trial_days: number;
  is_popular: boolean;
  is_active: boolean;
  sort_position: number;
  academies: number;
}

export type PlanInput = Omit<Plan, 'id' | 'academies'>;

export interface CustomerRow {
  academy_id: string;
  name: string;
  logo_path: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  plan_code: string | null;
  plan_name: string | null;
  billing_period: BillingPeriod | null;
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  mrr_cents: number;
  students: number;
  overdue_cents: number;
  open_tickets: number;
  last_note_at: string | null;
}

export interface Invoice {
  id: string;
  number: number;
  academy_id: string | null;
  academy_name: string;
  reference_month: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: InvoiceStatus;
  is_overdue: boolean;
  paid_on: string | null;
  payment_method: PaymentMethod | null;
  provider: string;
  created_at: string;
}

export interface CustomerNote {
  id: string;
  kind: NoteKind;
  body: string;
  created_at: string;
  author_name: string;
}

export interface Customer {
  academy_id: string;
  name: string;
  logo_path: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  students: number;
  plan_code: string | null;
  subscription: {
    billing_period: BillingPeriod;
    custom_price_cents: number | null;
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    started_at: string | null;
    canceled_at: string | null;
    provider: string;
    cycle_cents: number | null;
    mrr_cents: number;
  };
  invoices: Omit<Invoice, 'is_overdue' | 'academy_id'>[];
  notes: CustomerNote[];
  tickets: { id: string; number: number; subject: string; status: TicketStatus; last_message_at: string }[];
}

export interface TicketRow {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  user_id: string;
  user_name: string;
  user_email: string | null;
  academy_id: string | null;
  academy_name: string | null;
  messages: number;
  last_message_at: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  user_id: string;
  user_name: string;
  user_email: string | null;
  academy_id: string | null;
  academy_name: string | null;
  created_at: string;
  closed_at: string | null;
  messages: { id: string; is_staff: boolean; body: string; created_at: string; author_name: string }[];
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
  is_live: boolean;
  dismissals: number;
}

export interface Dashboard {
  mrr_cents: number;
  paying: number;
  trialing: number;
  trial_expired: number;
  trial_ending_7d: number;
  canceled: number;
  overdue_cents: number;
  overdue_count: number;
  received_month_cents: number;
  open_month_cents: number;
  academies: number;
  users: number;
  active_students: number;
  active_staff: number;
  pending_requests: number;
  open_tickets: number;
  new_academies_30d: number;
  new_users_30d: number;
  checkins_30d: number;
  plans: { code: string; name: string; academies: number }[];
  recent_academies: { id: string; name: string; logo_path: string | null; created_at: string; plan_tier: string | null }[];
  recent_tickets: { id: string; number: number; subject: string; status: TicketStatus; priority: TicketPriority; last_message_at: string }[];
}

export interface ReportMonth {
  month: string;
  new_academies: number;
  new_users: number;
  canceled: number;
  invoiced_cents: number;
  received_cents: number;
  checkins: number;
  training_students: number;
}

export interface Report {
  from: string;
  months: ReportMonth[];
  top_academies: { id: string; name: string; students: number; checkins: number }[];
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const api = {
  isAdmin: () => call<boolean>('admin_is_admin'),
  overview: async () => (await call<Overview[]>('admin_overview'))[0],
  listAcademies: (search: string) => call<AcademyRow[]>('admin_list_academies', { p_search: search || null }),
  getAcademy: async (id: string) => (await call<Academy[]>('admin_get_academy', { p_academy_id: id }))[0] ?? null,
  modalities: (academyId: string) => call<Modality[]>('admin_academy_modalities', { p_academy_id: academyId }),
  members: (academyId: string) => call<Member[]>('admin_list_members', { p_academy_id: academyId }),
  listUsers: (search: string, limit: number, offset: number) =>
    call<UserRow[]>('admin_list_users', { p_search: search || null, p_limit: limit, p_offset: offset }),
  getUser: (id: string) => call<UserDetail | null>('admin_get_user', { p_user_id: id }),

  updateAcademy: (id: string, name: string, inactiveAfterDays: number) =>
    call<void>('admin_update_academy', { p_academy_id: id, p_name: name, p_inactive_after_days: inactiveAfterDays }),
  updateProfile: (id: string, p: ProfileInput) =>
    call<void>('admin_update_profile', {
      p_user_id: id,
      p_full_name: p.full_name,
      p_birth_date: p.birth_date,
      p_sex: p.sex,
      p_height_cm: p.height_cm,
      p_weight_kg: p.weight_kg,
      p_reach_cm: p.reach_cm,
    }),
  decide: (membershipId: string, approve: boolean, modalityIds: string[] | null) =>
    call<void>('admin_decide_membership', { p_membership_id: membershipId, p_approve: approve, p_modality_ids: modalityIds }),
  setRole: (membershipId: string, role: 'instructor' | 'student', modalityIds: string[] | null) =>
    call<void>('admin_set_member_role', { p_membership_id: membershipId, p_role: role, p_modality_ids: modalityIds }),
  setModalities: (membershipId: string, modalityIds: string[]) =>
    call<void>('admin_set_student_modalities', { p_membership_id: membershipId, p_modality_ids: modalityIds }),
  setCompetitor: (enrollmentId: string, value: boolean) =>
    call<void>('admin_set_competitor', { p_enrollment_id: enrollmentId, p_is_competitor: value }),
  removeMembership: (membershipId: string) => call<void>('admin_remove_membership', { p_membership_id: membershipId }),

  dashboard: () => call<Dashboard>('admin_dashboard'),
  report: (months: number) => call<Report>('admin_report', { p_months: months }),

  listPlans: () => call<Plan[]>('admin_list_plans'),
  savePlan: (id: string | null, p: PlanInput) =>
    call<string>('admin_save_plan', {
      p_id: id,
      p_code: p.code,
      p_name: p.name,
      p_monthly_price_cents: p.monthly_price_cents,
      p_annual_discount_pct: p.annual_discount_pct,
      p_student_limit: p.student_limit,
      p_benefits: p.benefits,
      p_trial_days: p.trial_days,
      p_is_popular: p.is_popular,
      p_is_active: p.is_active,
      p_position: p.sort_position,
    }),

  listCustomers: (search: string) => call<CustomerRow[]>('admin_list_customers', { p_search: search || null }),
  getCustomer: (academyId: string) => call<Customer | null>('admin_get_customer', { p_academy_id: academyId }),
  updateSubscription: (
    academyId: string,
    s: {
      plan_code: string | null;
      billing_period: BillingPeriod;
      custom_price_cents: number | null;
      status: SubscriptionStatus;
      trial_ends_at: string | null;
    },
  ) =>
    call<void>('admin_update_subscription', {
      p_academy_id: academyId,
      p_plan_code: s.plan_code,
      p_billing_period: s.billing_period,
      p_custom_price_cents: s.custom_price_cents,
      p_status: s.status,
      p_trial_ends_at: s.trial_ends_at,
    }),
  addNote: (academyId: string, kind: NoteKind, body: string) =>
    call<string>('admin_add_customer_note', { p_academy_id: academyId, p_kind: kind, p_body: body }),
  deleteNote: (noteId: string) => call<void>('admin_delete_customer_note', { p_note_id: noteId }),

  listInvoices: (status: string | null, from: string | null, to: string | null) =>
    call<Invoice[]>('admin_list_invoices', { p_status: status, p_from: from, p_to: to }),
  generateInvoices: (month: string, dueDay: number) =>
    call<number>('admin_generate_invoices', { p_month: month, p_due_day: dueDay }),
  createInvoice: (academyId: string, month: string, amountCents: number, dueDate: string, description: string) =>
    call<string>('admin_create_invoice', {
      p_academy_id: academyId,
      p_reference_month: month,
      p_amount_cents: amountCents,
      p_due_date: dueDate,
      p_description: description,
    }),
  setInvoiceStatus: (id: string, status: InvoiceStatus, paidOn: string | null = null, method: PaymentMethod | null = null) =>
    call<void>('admin_set_invoice_status', {
      p_invoice_id: id,
      p_status: status,
      p_paid_on: paidOn,
      p_payment_method: method,
    }),

  listTickets: (status: TicketStatus | null, search: string) =>
    call<TicketRow[]>('admin_list_tickets', { p_status: status, p_search: search || null }),
  getTicket: (id: string) => call<Ticket | null>('admin_get_ticket', { p_ticket_id: id }),
  replyTicket: (id: string, body: string, close: boolean) =>
    call<void>('admin_reply_ticket', { p_ticket_id: id, p_body: body, p_close: close }),
  setTicket: (id: string, status: TicketStatus, priority: TicketPriority) =>
    call<void>('admin_set_ticket', { p_ticket_id: id, p_status: status, p_priority: priority }),

  listAnnouncements: () => call<PlatformAnnouncement[]>('admin_list_platform_announcements'),
  saveAnnouncement: (id: string | null, title: string, body: string, audience: Audience, endsOn: string | null) =>
    call<string>('admin_save_platform_announcement', {
      p_id: id,
      p_title: title,
      p_body: body,
      p_audience: audience,
      p_ends_on: endsOn,
    }),
  deleteAnnouncement: (id: string) => call<void>('admin_delete_platform_announcement', { p_id: id }),
};
