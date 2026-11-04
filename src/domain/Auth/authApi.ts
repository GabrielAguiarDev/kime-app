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

export const authApi = { signIn, signUp, verifyEmailCode, resendSignUpCode, signInWithIdToken, signOut };
