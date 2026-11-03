import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  const { colors } = useAppTheme();
  return <Ionicons name={name} size={26} color={focused ? colors.tabIconActive : colors.tabIcon} />;
}

function tabIcon(name: IoniconName, focusedName: IoniconName) {
  const renderIcon = ({ focused }: { focused: boolean }) => (
    <TabIcon name={focused ? focusedName : name} focused={focused} />
  );
  return renderIcon;
}

/**
 * Icon-only tab bar. Tabs per role:
 *  - student:    Início, Aulas, Perfil
 *  - competitor: Início, Aulas, Competição, Perfil
 *  - professor:  Início, Alunos, Confirmações, Perfil
 */
export default function TabsLayout() {
  const { role } = useActiveGym();
  const { colors } = useAppTheme();
  const isProfessor = role === 'professor';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabIconActive,
        tabBarInactiveTintColor: colors.tabIcon,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Início', tabBarAccessibilityLabel: 'Início', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Protected guard={!isProfessor}>
        <Tabs.Screen
          name="classes"
          options={{ title: 'Aulas', tabBarAccessibilityLabel: 'Aulas', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={role === 'competitor'}>
        <Tabs.Screen
          name="competition"
          options={{ title: 'Competição', tabBarAccessibilityLabel: 'Competição', tabBarIcon: tabIcon('trophy-outline', 'trophy') }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={isProfessor}>
        <Tabs.Screen
          name="students"
          options={{ title: 'Alunos', tabBarAccessibilityLabel: 'Alunos', tabBarIcon: tabIcon('people-outline', 'people') }}
        />
        <Tabs.Screen
          name="confirmations"
          options={{
            title: 'Confirmações',
            tabBarAccessibilityLabel: 'Confirmações',
            tabBarIcon: tabIcon('checkmark-done-circle-outline', 'checkmark-done-circle'),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil', tabBarIcon: tabIcon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
