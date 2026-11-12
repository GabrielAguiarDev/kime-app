import { Stack } from 'expo-router';

import { useNativeHeaderOptions } from '@components';

/**
 * Each tab has its own Stack so it gets the native header (large title on iOS).
 * The index's header is declared here, not only by the screen: options set from
 * inside a screen arrive after it mounts, and iOS lays out the scroll view for
 * the header it has at that moment. Início: no title (logo + name on the left, set by the screen), compact bar.
 */
export default function TabStackLayout() {
  return (
    <Stack screenOptions={useNativeHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: '', headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
