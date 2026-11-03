import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { profileService } from '@domain/Profile';
import { toAppError } from '@infra/supabase';

import { authApi } from './authApi';
import { normalizeEmail } from './authRules';
import type { SignInInput, SignUpInput } from './authTypes';

async function signIn(input: SignInInput): Promise<void> {
  try {
    await authApi.signIn({ ...input, email: normalizeEmail(input.email) });
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Returns `needsEmailConfirmation` when the project requires confirming the
 * e-mail before the first session (hosted Supabase default).
 */
async function signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
  try {
    const data = await authApi.signUp({
      ...input,
      email: normalizeEmail(input.email),
      fullName: input.fullName.trim(),
    });
    return { needsEmailConfirmation: !data.session };
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

export const authService = { signIn, signUp, signInWithApple, signOut };
