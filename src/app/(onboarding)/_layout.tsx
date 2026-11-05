import { Stack } from 'expo-router';

import { useRouteAccess } from '@services/access';

/**
 * Signed in without an approved membership. Two states (services/access),
 * each with its own screens; leaving one (request sent, cancelled, rejected)
 * redirects to the home of the other:
 *  - noAcademy       → /academia (choice), /codigo-academia, /create-gym (also until the
 *                      sign-up's done step is left: access.createAcademy)
 *  - pendingApproval → /aguardando
 */
export default function OnboardingLayout() {
  const access = useRouteAccess();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={access.noAcademy} redirectTo={access.home}>
        <Stack.Screen name="academia" />
        <Stack.Screen name="codigo-academia" />
      </Stack.Protected>
      {/* Also while the sign-up finishes (academy created, "Sua academia está pronta"). */}
      <Stack.Protected guard={access.createAcademy} redirectTo={access.home}>
        <Stack.Screen name="create-gym" />
      </Stack.Protected>
      <Stack.Protected guard={access.pendingApproval} redirectTo={access.home}>
        <Stack.Screen name="aguardando" />
      </Stack.Protected>
    </Stack>
  );
}
