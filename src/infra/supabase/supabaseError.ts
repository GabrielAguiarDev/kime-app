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
  | 'too_many_codes'
  | 'invalid_academy_name'
  | 'invalid_modalities'
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
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
  'too_many_codes',
  'invalid_academy_name',
  'invalid_modalities',
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
  too_many_codes: 'Há muitos códigos de professor ativos. Revogue algum antes de gerar outro.',
  invalid_gym_name: 'O nome da academia precisa ter entre 2 e 80 caracteres.',
  membership_not_found: 'Solicitação não encontrada.',
  membership_not_pending: 'Esta solicitação já foi respondida.',
  cannot_remove_member: 'Não é possível remover este membro.',
  cannot_change_role: 'O papel de um membro não pode ser alterado por aqui.',
  transfer_target_invalid: 'Só é possível transferir para um professor ativo desta academia.',
  academy_needs_owner: 'A academia precisa de um proprietário. Transfira a academia antes de sair.',
  invalid_academy_name: 'O nome da academia precisa ter entre 2 e 80 caracteres.',
  invalid_modalities: 'Escolha pelo menos uma modalidade (até 20).',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_taken: 'Já existe uma conta com este e-mail. Entre com sua senha.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres.',
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
