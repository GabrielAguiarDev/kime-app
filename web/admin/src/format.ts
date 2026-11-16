import type {
  Audience,
  BillingPeriod,
  InvoiceStatus,
  NoteKind,
  PaymentMethod,
  Role,
  Sex,
  Status,
  SubscriptionStatus,
  TicketPriority,
  TicketStatus,
} from './api';

const MESSAGES: Record<string, string> = {
  forbidden: 'Esta conta não tem acesso ao admin.',
  password_login_required: 'O admin só aceita entrada com e-mail e senha. Saia e entre de novo.',
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  academy_not_found: 'Academia não encontrada.',
  profile_not_found: 'Usuário não encontrado.',
  membership_not_found: 'Vínculo não encontrado. Atualize a página.',
  membership_not_pending: 'Este pedido já foi decidido. Atualize a página.',
  student_modality_required: 'Escolha pelo menos uma modalidade da academia.',
  invalid_modality_enrollment: 'Só alunos ativos têm modalidades.',
  role_change_invalid: 'Não é possível mudar o papel deste vínculo.',
  competitor_target_invalid: 'Só alunos ativos podem competir na modalidade.',
  cannot_remove_owner: 'O dono não pode ser removido.',
  invalid_name: 'O nome precisa ter pelo menos 2 caracteres.',
  plan_not_found: 'Plano não encontrado.',
  invoice_not_found: 'Fatura não encontrada. Atualize a página.',
  invoice_status_invalid: 'Esta mudança não vale para a fatura nesse estado.',
  invoice_payment_required: 'Informe a data e a forma de pagamento.',
  invalid_due_day: 'O dia de vencimento vai de 1 a 28.',
  invalid_due_date: 'Informe o vencimento.',
  ticket_not_found: 'Chamado não encontrado.',
  announcement_not_found: 'Aviso não encontrado.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme o e-mail desta conta antes de entrar.',
};

const AUTH_CODES: Record<string, string> = {
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
};

export function errorMessage(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const message = err?.message ?? '';
  if (MESSAGES[message]) return MESSAGES[message];
  if (err?.code && AUTH_CODES[err.code]) return AUTH_CODES[err.code];
  if (err?.code === '23514') return 'Algum valor está fora do permitido. Confira os campos.';
  if (err?.code === '23505') return 'Já existe um registro igual (código de plano ou fatura do mês).';
  if (err?.code === '23503') return 'Plano ou academia inexistente.';
  return message ? `Não foi possível concluir: ${message}` : 'Não foi possível concluir. Tente novamente.';
}

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', instructor: 'Professor', student: 'Aluno' };
export const STATUS_LABEL: Record<Status, string> = { pending: 'Pendente', active: 'Ativo', rejected: 'Recusado' };
export const SEX_LABEL: Record<Sex, string> = { female: 'Feminino', male: 'Masculino', unspecified: 'Prefere não dizer' };

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const formatNumber = (n: number) => n.toLocaleString('pt-BR');

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Em atraso',
  canceled: 'Cancelada',
};
export const PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: 'Mensal', annual: 'Anual' };
export const INVOICE_LABEL: Record<InvoiceStatus, string> = { open: 'Em aberto', paid: 'Paga', void: 'Cancelada' };
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  card: 'Cartão',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  other: 'Outro',
};
export const TICKET_LABEL: Record<TicketStatus, string> = {
  open: 'Aguardando suporte',
  answered: 'Respondido',
  closed: 'Encerrado',
};
export const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
export const NOTE_LABEL: Record<NoteKind, string> = {
  note: 'Anotação',
  call: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  meeting: 'Reunião',
};
export const AUDIENCE_LABEL: Record<Audience, string> = {
  owners: 'Donos',
  staff: 'Donos e professores',
  everyone: 'Todos os membros',
};

/** Subscription status as shown: a trial past its end reads "Teste vencido". */
export function subscriptionLabel(status: SubscriptionStatus | null, trialEndsAt: string | null): string {
  if (!status) return '—';
  if (status === 'trialing' && trialEndsAt && new Date(trialEndsAt) < new Date()) return 'Teste vencido';
  return SUBSCRIPTION_LABEL[status];
}
export function subscriptionTone(status: SubscriptionStatus | null, trialEndsAt: string | null): string {
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'rejected';
  if (status === 'canceled' || !status) return 'muted';
  return trialEndsAt && new Date(trialEndsAt) < new Date() ? 'rejected' : 'pending';
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** 17900 → "R$ 179,00". */
export const formatCents = (cents: number) => brl.format(cents / 100);
/** 17900 → "R$ 179" (whole reais, for tiles and axes). */
export const formatCentsShort = (cents: number) => brlShort.format(Math.round(cents / 100));
/** "179,90" / "179.90" / "1.234,5" / "1.500" → 17990 / 17990 / 123450 / 150000; blank → null; invalid → NaN. */
export function parseCents(text: string): number | null {
  const t = text.trim().replace(/^R\$\s*/, '');
  if (!t) return null;
  // pt-BR: a comma is the decimal mark; dots in groups of three are thousands ("1.500" = mil e quinhentos).
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, '')
      : t;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}
/** 17900 → "179,00" (for inputs). */
export const centsToInput = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
/** "2026-11-01" → "nov. de 26". */
export const formatMonth = (isoDate: string) => monthFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
const longMonthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatMonthLong = (isoDate: string) => longMonthFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
/** Plain dates (yyyy-mm-dd) without a timezone shift. */
export const formatDay = (isoDate: string | null) =>
  isoDate ? new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
/** A timestamp's calendar day in São Paulo (yyyy-mm-dd), for date inputs and CSV. */
export const daySp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) : '';
/** Today in São Paulo as yyyy-mm-dd. */
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
export const currentMonth = () => `${today().slice(0, 7)}-01`;
