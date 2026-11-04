import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { profileService } from '@domain/Profile';

import { authApi } from './authApi';
import { normalizeEmail } from './authRules';
import { AppError, toAppError } from '@infra/supabase';
import type { SignInInput, SignUpInput, SignUpResult } from './authTypes';

async function signIn(input: SignInInput): Promise<void> {
  try {
    await authApi.signIn({ ...input, email: normalizeEmail(input.email) });
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * The e-mail already has an account. Signing in with the typed password tells
 * the cases apart without revealing anything to someone who lacks it:
 * right password + unconfirmed → resend the code; right password + confirmed →
 * just sign in; wrong password → "e-mail taken".
 */
async function resumeExistingAccount(email: string, password: string, cause: unknown): Promise<SignUpResult> {
  try {
    await authApi.signIn({ email, password });
    return 'signed_in';
  } catch (e) {
    const error = toAppError(e);
    if (error.code !== 'email_not_confirmed') throw new AppError('email_taken', cause);
    // Best effort: the previous code may still be valid; the screen can resend.
    await authApi.resendSignUpCode(email).catch(() => undefined);
    return 'needs_confirmation';
  }
}

async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const email = normalizeEmail(input.email);
  try {
    const data = await authApi.signUp({ ...input, email, fullName: input.fullName.trim() });
    if (data.session) return 'signed_in';
    // With confirmations on, an existing e-mail comes back as a placeholder
    // user without identities instead of an error (anti-enumeration).
    if (data.user && data.user.identities?.length === 0) {
      return resumeExistingAccount(email, input.password, null);
    }
    return 'needs_confirmation';
  } catch (e) {
    const error = toAppError(e);
    if (error.code === 'email_taken') return resumeExistingAccount(email, input.password, e);
    throw error;
  }
}

async function verifyEmailCode(email: string, code: string): Promise<void> {
  try {
    await authApi.verifyEmailCode(normalizeEmail(email), code.trim());
  } catch (e) {
    throw toAppError(e);
  }
}

async function resendSignUpCode(email: string): Promise<void> {
  try {
    await authApi.resendSignUpCode(normalizeEmail(email));
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Native Sign in with Apple → Supabase id token exchange.
 * Returns false when the user cancels the native sheet.
 */
async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('missing_identity_token');
    const { user } = await authApi.signInWithIdToken('apple', credential.identityToken, rawNonce);

    // Apple sends the name only on the FIRST authorization: persist it now.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName && user) {
      await profileService.updateName(user.id, fullName).catch(() => undefined);
    }
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw toAppError(e);
  }
}

async function signOut(): Promise<void> {
  try {
    await authApi.signOut();
  } catch (e) {
    throw toAppError(e);
  }
}

async function requestEmailChange(newEmail: string): Promise<void> {
  try {
    await authApi.requestEmailChange(normalizeEmail(newEmail));
  } catch (e) {
    throw toAppError(e);
  }
}

/** Verifies one code; returns the e-mail change still pending (null when done). */
async function verifyEmailChange(email: string, code: string): Promise<{ email: string; pendingEmail: string | null }> {
  try {
    await authApi.verifyEmailChange(normalizeEmail(email), code.trim());
    const user = await authApi.getUser();
    return { email: user.email ?? '', pendingEmail: user.new_email ?? null };
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Changes the password. Accounts with an e-mail password confirm the current
 * one first (sign-in with it); Apple-only accounts just set one.
 */
async function changePassword(input: { email: string; currentPassword: string | null; newPassword: string }): Promise<void> {
  try {
    if (input.currentPassword !== null) {
      try {
        await authApi.signIn({ email: input.email, password: input.currentPassword });
      } catch (e) {
        const appError = toAppError(e);
        throw appError.code === 'invalid_credentials' ? new AppError('wrong_current_password', e) : appError;
      }
    }
    await authApi.updatePassword(input.newPassword);
  } catch (e) {
    throw toAppError(e);
  }
}

export const authService = {
  signIn,
  signUp,
  verifyEmailCode,
  resendSignUpCode,
  signInWithApple,
  signOut,
  requestEmailChange,
  verifyEmailChange,
  changePassword,
};
