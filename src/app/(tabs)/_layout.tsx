import { Redirect, Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { needsCheckBy } from '../../lib/review';
import { colors, isLight, shade, tabColors, tint, type TabName } from '../../components/theme';
import { haptics } from '../../lib/haptics';
import { track, type EventName } from '../../lib/analytics';
import { PRIVACY_VERSION } from '../../lib/legal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
/** A tab's colour: bright when you're on it, softer when you're not. Each tab keeps its own colour. */
const tabTint = (tab: TabName, focused: boolean) =>
  focused ? tabColors[tab] : isLight ? tint(tabColors[tab], 0.35) : shade(tabColors[tab], 0.35);

function icon(outline: IconName, filled: IconName, tab: TabName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={26} color={tabTint(tab, focused)} />;
  }
  return TabIcon;
}

function label(text: string, tab: TabName) {
  function TabLabel({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: focused ? '700' : '500', marginTop: 4, color: tabTint(tab, focused) }}>{text}</Text>;
  }
  return TabLabel;
}

export default function TabsLayout() {
  const { ready, profile, logs, user, offers } = useApp();
  const insets = useSafeAreaInsets();
  if (ready && !profile?.houseId) return <Redirect href="/" />;
  // Must have agreed to the current privacy policy.
  if (profile && profile.privacyVersion !== PRIVACY_VERSION) return <Redirect href="/consent" />;
  const toCheck = user ? logs.filter((l) => needsCheckBy(l, user.uid)).length : 0;
  // Pay things waiting on you: counter offers to answer, someone to pay.
  const payToDo = user
    ? offers.filter(
        (o) =>
          (o.fromUid === user.uid && o.status === 'open' && Object.keys(o.counters).some((u) => !o.declined.includes(u))) ||
          (o.fromUid === user.uid && o.status === 'done') ||
          (o.doerUid === user.uid && o.status === 'agreed'),
      ).length
    : 0;
  // The iPhone home bar area. Home-screen web apps sometimes report 0, so keep a minimum.
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 0);
  const badge = (tab: TabName) => ({ backgroundColor: tabColors[tab], color: isLight ? '#FFFFFF' : '#000000', fontSize: 10, fontWeight: '700' as const });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Taller bar with room for the iPhone home bar, so labels are never cut off.
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 70 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarIconStyle: { height: 28 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '500', marginTop: 4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      screenListeners={({ route }) => ({
        tabPress: () => {
          haptics.select();
          track(`tab_${route.name}` as EventName);
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home', 'home'), tabBarLabel: label('Home', 'home') }} />
      <Tabs.Screen
        name="checks"
        options={{
          title: 'Checks',
          tabBarIcon: icon('camera-outline', 'camera', 'checks'), tabBarLabel: label('Checks', 'checks'),
          tabBarBadge: toCheck > 0 ? toCheck : undefined,
          tabBarBadgeStyle: badge('checks'),
        }}
      />
      <Tabs.Screen name="leaderboard" options={{ title: 'Ranks', tabBarIcon: icon('podium-outline', 'podium', 'leaderboard'), tabBarLabel: label('Ranks', 'leaderboard') }} />
      <Tabs.Screen
        name="pay"
        options={{
          title: 'Pay',
          tabBarIcon: icon('wallet-outline', 'wallet', 'pay'), tabBarLabel: label('Pay', 'pay'),
          tabBarBadge: payToDo > 0 ? payToDo : undefined,
          tabBarBadgeStyle: badge('pay'),
        }}
      />
      <Tabs.Screen name="house" options={{ title: 'House', tabBarIcon: icon('people-outline', 'people', 'house'), tabBarLabel: label('House', 'house') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings', 'settings'), tabBarLabel: label('Settings', 'settings') }} />
    </Tabs>
  );
}
