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
