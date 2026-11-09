import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { needsCheckBy } from '../../lib/review';
import { colors, fonts } from '../../components/theme';
import { haptics } from '../../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
function icon(outline: IconName, filled: IconName) {
  function TabIcon({ focused, color }: { focused: boolean; color: import('react-native').ColorValue }) {
    return <Ionicons name={focused ? filled : outline} size={22} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { ready, profile, logs, user, offers } = useApp();
  if (ready && !profile?.houseId) return <Redirect href="/" />;
  const toCheck = user ? logs.filter((l) => needsCheckBy(l, user.uid)).length : 0;
  // Money things waiting on you: counter offers to answer, someone to pay.
  const moneyToDo = user
    ? offers.filter(
        (o) =>
          (o.fromUid === user.uid && o.status === 'open' && Object.keys(o.counters).some((u) => !o.declined.includes(u))) ||
          (o.fromUid === user.uid && o.status === 'done') ||
          (o.doerUid === user.uid && o.status === 'agreed'),
      ).length
    : 0;
  const badge = { backgroundColor: colors.text, color: colors.inverse, fontSize: 10, fontWeight: '700' as const };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 9, fontFamily: fonts.mono, letterSpacing: 0.6, textTransform: 'uppercase' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      screenListeners={{ tabPress: () => haptics.select() }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="checks"
        options={{
          title: 'Checks',
          tabBarIcon: icon('camera-outline', 'camera'),
          tabBarBadge: toCheck > 0 ? toCheck : undefined,
          tabBarBadgeStyle: badge,
        }}
      />
      <Tabs.Screen name="leaderboard" options={{ title: 'Ranks', tabBarIcon: icon('podium-outline', 'podium') }} />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: icon('wallet-outline', 'wallet'),
          tabBarBadge: moneyToDo > 0 ? moneyToDo : undefined,
          tabBarBadgeStyle: badge,
        }}
      />
      <Tabs.Screen name="house" options={{ title: 'House', tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
