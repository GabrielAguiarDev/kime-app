import { Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@components';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useAppTheme } from '@theme';

function tabIcon(name: IconName) {
  const renderIcon = ({ focused }: { focused: boolean }) => (
    // Active: filled icon in accent. Inactive: outline (bold) in text-muted.
    <Icon name={name} active={focused} color={focused ? 'accent' : 'textMuted'} />
  );
  return renderIcon;
}

/**
 * Icon-only tab bar (DESIGN-SYSTEM.md, 3.9): 64 + safe area, surface, 2px top border.
 * Tabs per role:
 *  - student:    Início, Aulas, Perfil
 *  - competitor: Início, Aulas, Competição, Perfil (only while the modality picked
 *    in the Início header is one the student competes in)
 *  - staff (owner or professor): Início, Aulas, Timer, Equipe, Perfil
 *    (check-ins are confirmed in each class's attendance list; join requests are notices).
 */
export default function TabsLayout() {
  const { isStaff } = useActiveGym();
  const { competesInSelected } = useActiveModality();
  const { colors, size, border } = useAppTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: size.tabBar + bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: border.width,
          paddingTop: 0,
        },
        // The default item pins the icon to the top (it expects a label below). Icon-only:
        // center it in the 64pt area above the safe area.
        tabBarButton: ({ children, style, onPress, onLongPress, accessibilityState, testID, ...a11y }) => (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={{ ...accessibilityState, selected: !!a11y['aria-selected'] }}
            accessibilityLabel={a11y['aria-label']}
            testID={testID}
            style={[style, { justifyContent: 'center', height: size.tabBar }]}
          >
            {children}
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Início', tabBarAccessibilityLabel: 'Início', tabBarIcon: tabIcon('home') }}
      />
      {/* Aulas: the student's progress, or the staff's classes and attendance (same tab, screen by role). */}
      <Tabs.Screen
        name="classes"
        options={{ title: 'Aulas', tabBarAccessibilityLabel: 'Aulas', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Protected guard={competesInSelected && !isStaff}>
        <Tabs.Screen
          name="competition"
          options={{ title: 'Competição', tabBarAccessibilityLabel: 'Competição', tabBarIcon: tabIcon('trophy') }}
        />
      </Tabs.Protected>
      {/* Timer: a tab for staff; students reach it from Aulas (no tab of their own).
          Hide only the button: `href: null` (SDK 58) marks the route hidden, which
          redirects any navigation to it back home. */}
      <Tabs.Screen
        name="timer"
        options={{
          title: 'Timer',
          tabBarAccessibilityLabel: 'Timer',
          tabBarIcon: tabIcon('timer'),
          ...(isStaff ? null : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }),
        }}
      />
      <Tabs.Protected guard={isStaff}>
        <Tabs.Screen
          name="team"
          options={{ title: 'Equipe', tabBarAccessibilityLabel: 'Equipe', tabBarIcon: tabIcon('users') }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil', tabBarIcon: tabIcon('user') }}
      />
    </Tabs>
  );
}
