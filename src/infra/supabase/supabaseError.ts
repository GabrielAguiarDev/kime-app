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
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
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

  switch (e.code) {
    case 'invalid_credentials':
      return new AppError('invalid_credentials', error);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('email_taken', error);
    case 'weak_password':
      return new AppError('weak_password', error);
    case '42501':
      return new AppError('forbidden', error);
  }
  if (e.name === 'AuthRetryableFetchError' || /network request failed/i.test(message)) {
    return new AppError('network', error);
  }
  return new AppError('unknown', error);
}

const MESSAGES: Record<AppErrorCode, string> = {
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para isso.',
  invite_invalid: 'Este convite não é mais válido. Peça um novo link ao professor.',
  invalid_gym_name: 'O nome da academia precisa ter entre 2 e 80 caracteres.',
  membership_not_found: 'Solicitação não encontrada.',
  membership_not_pending: 'Esta solicitação já foi respondida.',
  cannot_remove_member: 'Não é possível remover este membro.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_taken: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres.',
  network: 'Sem conexão. Verifique sua internet e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
};

export function errorMessage(error: unknown): string {
  return MESSAGES[toAppError(error).code];
}
