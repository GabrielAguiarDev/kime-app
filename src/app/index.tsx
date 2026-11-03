import { Redirect } from 'expo-router';

import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/**
 * Entry route "/". Always matchable (never guarded) and sends the user to the
 * right group, so cold starts and `router.replace('/')` never hit an unmatched route.
 */
export default function Index() {
  const { session } = useSession();
  const { active } = useActiveGym();

  if (!session) return <Redirect href="/sign-in" />;
  if (!active) return <Redirect href="/welcome" />;
  return <Redirect href="/home" />;
}
