import { Redirect } from 'expo-router';

import { useRouteAccess } from '@services/access';

/**
 * Entry route "/". Always matchable (never guarded): sends the user to the
 * home of their access level (services/access), so cold starts, deep links
 * and `router.replace('/')` never hit an unmatched route.
 */
export default function Index() {
  const { home } = useRouteAccess();
  return <Redirect href={home} />;
}
