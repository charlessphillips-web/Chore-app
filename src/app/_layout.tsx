import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import '../lib/homeAway';
import { Platform, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrHome } from '../lib/nav';
import { useFonts } from 'expo-font';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../context/AppContext';
import { colors, darkHeader, isLight } from '../components/theme';
import { CelebrationHost } from '../components/Celebration';

/** Pop-up screens: a Back button top left (you can still swipe down to close). */
function BackButton() {
  return (
    <Pressable onPress={goBackOrHome} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8 }}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 16 }}>Back</Text>
    </Pressable>
  );
}
const modal = { presentation: 'modal' as const, headerShown: true, headerLeft: () => <BackButton /> };

/** Tapping a notification that carries a screen (e.g. "Not home tonight?") opens that screen. */
function useNotificationLinks() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) setTimeout(() => router.push(url as never), 300);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useNotificationLinks();
  // Fonts load in a moment; until then the system font is used.
  useFonts({ SpaceMono_400Regular, SpaceMono_700Bold });
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <AppProvider>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false, ...darkHeader }}>
          <Stack.Screen name="chore/[key]" options={{ ...modal, title: '' }} />
          <Stack.Screen name="area/[group]" options={{ ...modal, title: '' }} />
          <Stack.Screen name="how-it-works" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="wrapped" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="away-quick" options={{ ...modal, title: '' }} />
          <Stack.Screen name="photo/[logId]" options={{ ...modal, title: 'PHOTO' }} />
          <Stack.Screen name="offer/[id]" options={{ ...modal, title: 'CHORE OFFER' }} />
          <Stack.Screen name="add-chore" options={{ ...modal, title: '' }} />
          <Stack.Screen name="stakes" options={{ ...modal, title: '' }} />
          <Stack.Screen name="privacy" options={{ ...modal, title: 'PRIVACY' }} />
          <Stack.Screen name="terms" options={{ ...modal, title: 'TERMS' }} />
          <Stack.Screen name="sign-in" options={{ ...modal, title: 'SIGN IN' }} />
        </Stack>
        <CelebrationHost />
      </AppProvider>
    </SafeAreaProvider>
  );
}
