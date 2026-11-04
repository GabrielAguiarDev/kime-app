import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

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

export function useSignOut() {
  return useMutation({ mutationFn: () => authService.signOut() });
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
