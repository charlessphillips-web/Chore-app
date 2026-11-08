import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { needsCheckBy } from '../../lib/review';
import { colors } from '../../components/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
function icon(outline: IconName, filled: IconName) {
  function TabIcon({ focused, color }: { focused: boolean; color: import('react-native').ColorValue }) {
    return <Ionicons name={focused ? filled : outline} size={23} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { ready, profile, logs, user } = useApp();
  if (ready && !profile?.houseId) return <Redirect href="/" />;
  const toCheck = user ? logs.filter((l) => needsCheckBy(l, user.uid)).length : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="checks"
        options={{
          title: 'Checks',
          tabBarIcon: icon('camera-outline', 'camera'),
          tabBarBadge: toCheck > 0 ? toCheck : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primaryBright, color: colors.text },
        }}
      />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: icon('trophy-outline', 'trophy') }} />
      <Tabs.Screen name="house" options={{ title: 'House', tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
