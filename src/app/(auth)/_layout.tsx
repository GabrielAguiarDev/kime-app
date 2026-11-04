import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'start' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
