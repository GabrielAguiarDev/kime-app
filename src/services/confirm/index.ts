export { ConfirmProvider, useConfirm } from './ConfirmProvider';

/** Same copy wherever the user can sign out. */
export const SIGN_OUT_CONFIRM = {
  title: 'Sair da conta?',
  message: 'Você vai precisar entrar de novo com seu e-mail e senha.',
  confirmLabel: 'Sair',
  tone: 'danger',
} as const;
