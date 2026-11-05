import { Stack } from 'expo-router';

import { useNativeHeaderOptions } from '@components';

/** Each tab has its own Stack so it gets the native header (large title on iOS). */
export default function TabStackLayout() {
  return <Stack screenOptions={useNativeHeaderOptions()} />;
}
