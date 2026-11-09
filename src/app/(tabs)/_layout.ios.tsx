import { NativeTabs } from 'expo-router/native-tabs';

import { useAppTheme } from '@theme';

/**
 * iOS: native UITabBar (Liquid Glass on iOS 26+). Android/web keep the custom
 * JS tab bar in `_layout.tsx`. Same five tabs, icon-only (DESIGN-SYSTEM.md, 3.9),
 * active tint in accent. Tab screens use contentInsetAdjustmentBehavior="automatic",
 * so scroll content flows under the glass bar and gets the right bottom inset.
 */
export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <NativeTabs tintColor={colors.accent} iconColor={{ default: colors.textMuted, selected: colors.accent }}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label hidden>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="classes">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label hidden>Aulas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="timer">
        <NativeTabs.Trigger.Icon sf="timer" />
        <NativeTabs.Trigger.Label hidden>Timer</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="team">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label hidden>Equipe</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label hidden>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
