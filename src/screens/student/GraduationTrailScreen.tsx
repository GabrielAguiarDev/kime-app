import { router } from 'expo-router';

import { Box, EmptyState, Screen } from '@components';

const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/classes'));

/** Entry point reserved for the planned graduation trail. */
export function GraduationTrailScreen() {
  return (
    <Screen nativeHeader title="Trilha de graduação" onBack={back}>
      <Box paddingVertical="s32">
        <EmptyState visual="icon" icon="belt" title="Em breve" />
      </Box>
    </Screen>
  );
}
