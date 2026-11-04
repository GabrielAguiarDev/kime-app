import { supabase } from '@infra/supabase';

import type { SignInInput, SignUpInput } from './authTypes';

async function signIn({ email, password }: SignInInput) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function signUp({ email, password, fullName }: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

/** Confirms the sign-up with the code sent by e-mail and opens the session. */
async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

async function resendSignUpCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

async function signInWithIdToken(provider: 'apple' | 'google', token: string, nonce?: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Offline / server error: still drop the local session so "Sair" always works.
    const local = await supabase.auth.signOut({ scope: 'local' });
    if (local.error) throw local.error;
  }
}

/** Starts an e-mail change: the new address receives a 6-digit code. */
async function requestEmailChange(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

/**
 * Confirms an e-mail change with a code. With "secure e-mail change" on, both
 * the new and the current address get a code: `email` is the one that got it.
 */
async function verifyEmailChange(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
  if (error) throw error;
}

/** Current user from the server (fresh e-mail / pending new_email). */
async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export const authApi = {
  signIn,
  signUp,
  verifyEmailCode,
  resendSignUpCode,
  signInWithIdToken,
  signOut,
  requestEmailChange,
  verifyEmailChange,
  getUser,
  updatePassword,
};
