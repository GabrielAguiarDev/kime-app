import { router } from 'expo-router';

/**
 * Back from a signed-out step (sign-up, invite code): the previous screen when
 * there is one, otherwise the sign-in screen, which is where signed-out users
 * start (a deep link may land on the code screen with nothing underneath).
 */
export function backToSignIn() {
  if (router.canGoBack()) router.back();
  else router.replace('/sign-in');
}
