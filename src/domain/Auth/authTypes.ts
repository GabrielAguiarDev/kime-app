export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  fullName: string;
}

/**
 * - signed_in: session open (confirmation off, or the e-mail already had an
 *   account with this same password).
 * - needs_confirmation: go to the code screen (new account, or an existing
 *   account that was never confirmed — a fresh code was sent).
 */
export type SignUpResult = 'signed_in' | 'needs_confirmation';
