import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../../context/AppContext';
import { colors } from '../../components/theme';

function icon(emoji: string) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { ready, profile } = useApp();
  if (ready && !profile?.houseId) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="house" options={{ title: 'House', tabBarIcon: icon('👥') }} />
    </Tabs>
  );
}
