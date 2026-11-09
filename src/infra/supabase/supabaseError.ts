/**
 * Normalizes Supabase/PostgREST/Auth errors into a code the UI can translate.
 * RPCs raise machine codes (e.g. 'invite_invalid') as the exception message.
 */
export type AppErrorCode =
  | 'not_authenticated'
  | 'forbidden'
  | 'invite_invalid'
  | 'invalid_gym_name'
  | 'membership_not_found'
  | 'membership_not_pending'
  | 'cannot_remove_member'
  | 'cannot_change_role'
  | 'transfer_target_invalid'
  | 'academy_needs_owner'
  | 'invalid_code_type'
  | 'invalid_academy_name'
  | 'invalid_modalities'
  | 'invalid_plan_tier'
  | 'invalid_belts'
  | 'invalid_modality_enrollment'
  | 'student_modality_required'
  | 'weekly_goal_invalid'
  | 'modality_enrollment_required'
  | 'invalid_ranking_modality'
  | 'invalid_ranking_period'
  | 'invalid_enrollment'
  | 'instructor_invalid'
  | 'logo_required'
  | 'competitor_target_invalid'
  | 'already_competitor'
  | 'competitor_invite_missing'
  | 'water_plan_invalid'
  | 'weight_day_taken'
  | 'diet_copy_same_day'
  | 'owner_must_transfer'
  | 'join_cooldown'
  | 'previous_championship_not_past'
  | 'already_present'
  | 'modality_in_use'
  | 'belt_in_use'
  | 'modality_has_history'
  | 'duplicate_name'
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'same_password'
  | 'wrong_current_password'
  | 'email_not_confirmed'
  | 'code_invalid'
  | 'rate_limited'
  | 'email_send_failed'
  | 'network'
  | 'unknown';

const KNOWN_CODES: readonly AppErrorCode[] = [
  'not_authenticated',
  'forbidden',
  'invite_invalid',
  'invalid_gym_name',
  'membership_not_found',
  'membership_not_pending',
  'cannot_remove_member',
  'cannot_change_role',
  'transfer_target_invalid',
  'academy_needs_owner',
  'invalid_code_type',
  'invalid_academy_name',
  'invalid_modalities',
  'invalid_plan_tier',
  'invalid_belts',
  'invalid_modality_enrollment',
  'student_modality_required',
  'weekly_goal_invalid',
  'modality_enrollment_required',
  'invalid_ranking_modality',
  'invalid_ranking_period',
  'invalid_enrollment',
  'instructor_invalid',
  'logo_required',
  'competitor_target_invalid',
  'already_competitor',
  'competitor_invite_missing',
  'water_plan_invalid',
  'diet_copy_same_day',
  'owner_must_transfer',
  'join_cooldown',
  'previous_championship_not_past',
  'rate_limited',
];

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    cause?: unknown,
  ) {
    super(code, { cause });
    this.name = 'AppError';
  }
}

type ErrorLike = { message?: string; code?: string; status?: number; name?: string };

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as ErrorLike;
  const message = e.message ?? '';

  const known = KNOWN_CODES.find((code) => message === code);
  if (known) return new AppError(known, error);

  // Auth could not deliver the confirmation e-mail (SMTP problem on the server).
  if (/error sending .*email/i.test(message)) return new AppError('email_send_failed', error);

  switch (e.code) {
    case 'invalid_credentials':
      return new AppError('invalid_credentials', error);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('email_taken', error);
    case 'weak_password':
      return new AppError('weak_password', error);
    case 'same_password':
      return new AppError('same_password', error);
    case 'email_not_confirmed':
      return new AppError('email_not_confirmed', error);
    // GoTrue answers otp_expired for both wrong and expired codes.
    case 'otp_expired':
      return new AppError('code_invalid', error);
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AppError('rate_limited', error);
    case '42501':
      return new AppError('forbidden', error);
    // Foreign keys that protect history: schedules point at the modality, or a
    // belt (of the modality) was already awarded.
    case '23503':
      if (/class_schedules_modality_fkey/.test(message)) return new AppError('modality_in_use', error);
      // Deleting a modality cascades to its belts: an awarded one blocks it.
      if (/belt_history_belt_fkey/.test(message) && /academy_modalities/.test(message)) {
        return new AppError('modality_has_history', error);
      }
      if (/belt_history_belt_fkey/.test(message)) return new AppError('belt_in_use', error);
      break;
    // Only the name uniques get the "already exists" message; others stay generic.
    case '23505':
      if (/checkins_user_id_schedule_id_class_date_key/.test(message)) return new AppError('already_present', error);
      if (/timer_presets_one_per_modality_idx/.test(message)) return new AppError('duplicate_name', error);
      if (/timer_presets_academy_name_idx/.test(message)) return new AppError('duplicate_name', error);
      if (/personal_timer_presets_user_name_idx/.test(message)) return new AppError('duplicate_name', error);
      if (/weight_logs_one_per_day/.test(message)) return new AppError('weight_day_taken', error);
      if (/academy_modalities_academy_name_idx|modality_belts_name_idx/.test(message)) {
        return new AppError('duplicate_name', error);
      }
      break;
  }
  if (e.name === 'AuthRetryableFetchError' || /network request failed/i.test(message)) {
    return new AppError('network', error);
  }
  if (__DEV__) console.warn('[toAppError] unmapped error', error);
  return new AppError('unknown', error);
}

const MESSAGES: Record<AppErrorCode, string> = {
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para isso.',
  invite_invalid: 'Código não encontrado. Confira as letras ou peça um novo código.',
  invalid_code_type: 'Tipo de código inválido.',
  invalid_gym_name: 'O nome da academia precisa ter entre 2 e 80 caracteres.',
  membership_not_found: 'Solicitação não encontrada.',
  membership_not_pending: 'Esta solicitação já foi respondida.',
  cannot_remove_member: 'Não é possível remover este membro.',
  cannot_change_role: 'O papel de um membro não pode ser alterado por aqui.',
  transfer_target_invalid: 'Só é possível transferir para um professor ativo desta academia.',
  academy_needs_owner: 'A academia precisa de um proprietário. Transfira a academia antes de sair.',
  invalid_academy_name: 'O nome da academia precisa ter entre 2 e 80 caracteres.',
  invalid_modalities: 'Escolha pelo menos uma modalidade (até 20).',
  invalid_plan_tier: 'Escolha um dos planos disponíveis.',
  invalid_belts: 'Confira as faixas das modalidades.',
  invalid_modality_enrollment: 'Confira se o aluno e a modalidade estão ativos nesta academia.',
  student_modality_required: 'O aluno precisa de pelo menos uma modalidade.',
  weekly_goal_invalid: 'A meta semanal vai de 1 a 14 aulas.',
  modality_enrollment_required: 'Ative a matrícula do aluno nesta modalidade antes de definir uma turma obrigatória.',
  invalid_ranking_modality: 'Escolha uma modalidade desta academia para consultar o ranking.',
  invalid_ranking_period: 'Escolha um período de dias completos, de até 366 dias.',
  invalid_enrollment: 'Confira se o aluno e o horário estão ativos nesta academia.',
  instructor_invalid: 'Escolha um professor ativo desta academia.',
  logo_required: 'A academia precisa ter uma logo. Troque por outra em vez de remover.',
  competitor_target_invalid: 'Só alunos ativos desta modalidade podem entrar na equipe de competição.',
  already_competitor: 'Este aluno já está na equipe de competição.',
  competitor_invite_missing: 'Este convite não está mais disponível.',
  water_plan_invalid: 'O plano de água precisa ter os 7 dias da semana.',
  owner_must_transfer:
    'Você é proprietário de uma academia com outros membros. Transfira a academia para um professor antes de excluir a conta.',
  already_present: 'Este aluno já está na lista desta aula.',
  join_cooldown: 'Seu pedido para esta academia foi recusado. Você pode pedir de novo 24 horas depois da resposta.',
  diet_copy_same_day: 'Escolha outro dia para copiar.',
  previous_championship_not_past: 'Um campeonato anterior precisa ter data no passado.',
  weight_day_taken: 'Já existe um peso registrado neste dia.',
  modality_in_use: 'Esta modalidade tem horários cadastrados. Remova os horários dela antes.',
  belt_in_use: 'Esta faixa já foi entregue a alunos e fica no histórico deles. Ela não pode ser removida.',
  modality_has_history: 'Alunos já foram graduados nesta modalidade. Ela fica no histórico deles e não pode ser removida.',
  duplicate_name: 'Já existe um item com esse nome.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_taken: 'Já existe uma conta com este e-mail. Entre com sua senha.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  wrong_current_password: 'Senha atual incorreta.',
  email_not_confirmed: 'Confirme seu e-mail com o código que enviamos.',
  code_invalid: 'Código inválido ou expirado. Confira ou peça um novo.',
  rate_limited: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  email_send_failed: 'Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em instantes.',
  network: 'Sem conexão. Verifique sua internet e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
};

export function errorMessage(error: unknown): string {
  return MESSAGES[toAppError(error).code];
}
