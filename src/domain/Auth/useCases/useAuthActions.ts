import { useMutation, useQueryClient } from '@tanstack/react-query';

import { waterService } from '@domain/Water';
import { QueryKeys } from '@infra/query';
import { supabase } from '@infra/supabase';

import { authService } from '../authService';
import type { SignInInput, SignUpInput } from '../authTypes';

export function useSignIn() {
  return useMutation({ mutationFn: (input: SignInInput) => authService.signIn(input) });
}

export function useSignUp() {
  return useMutation({ mutationFn: (input: SignUpInput) => authService.signUp(input) });
}

export function useVerifyEmailCode() {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authService.verifyEmailCode(email, code),
  });
}

export function useResendSignUpCode() {
  return useMutation({ mutationFn: (email: string) => authService.resendSignUpCode(email) });
}

export function useSignInWithApple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.signInWithApple(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile] }),
  });
}

/** How long "Sair da conta" waits for pending water logs to reach the server. */
const SIGN_OUT_SYNC_MS = 5_000;

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      // Last chance to send water logged offline (app or widget) while the
      // session is still valid; offline it gives up and the logs stay.
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (userId) {
        await Promise.race([
          waterService.sync(userId).catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, SIGN_OUT_SYNC_MS)),
        ]);
      }
      await authService.signOut();
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: (avatarPath: string | null) => authService.deleteAccount(avatarPath) });
}

export function useRequestEmailChange() {
  return useMutation({ mutationFn: (newEmail: string) => authService.requestEmailChange(newEmail) });
}

export function useVerifyEmailChange() {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authService.verifyEmailChange(email, code),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { email: string; currentPassword: string | null; newPassword: string }) =>
      authService.changePassword(input),
  });
}
