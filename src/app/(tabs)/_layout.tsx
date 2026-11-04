import { Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@components';
import { useActiveGym } from '@services/activeGym';
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
 *  - competitor: Início, Aulas, Competição, Perfil
 *  - professor:  Início, Alunos, Confirmações, Perfil
 */
export default function TabsLayout() {
  const { role, isCompetitor } = useActiveGym();
  const { colors, size, border } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const isProfessor = role === 'professor';

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
      <Tabs.Protected guard={!isProfessor}>
        <Tabs.Screen
          name="classes"
          options={{ title: 'Aulas', tabBarAccessibilityLabel: 'Aulas', tabBarIcon: tabIcon('calendar') }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={isCompetitor}>
        <Tabs.Screen
          name="competition"
          options={{ title: 'Competição', tabBarAccessibilityLabel: 'Competição', tabBarIcon: tabIcon('trophy') }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={isProfessor}>
        <Tabs.Screen
          name="students"
          options={{ title: 'Alunos', tabBarAccessibilityLabel: 'Alunos', tabBarIcon: tabIcon('users') }}
        />
        <Tabs.Screen
          name="confirmations"
          options={{
            title: 'Confirmações',
            tabBarAccessibilityLabel: 'Confirmações',
            tabBarIcon: tabIcon('confirmations'),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil', tabBarIcon: tabIcon('user') }}
      />
    </Tabs>
  );
}
