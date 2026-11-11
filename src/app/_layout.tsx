import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../context/AppContext';
import { colors, darkHeader } from '../components/theme';

export default function RootLayout() {
  // Fonts load in a moment; until then the system font is used.
  useFonts({ SpaceMono_400Regular, SpaceMono_700Bold });
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <AppProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, ...darkHeader }}>
          <Stack.Screen name="chore/[key]" options={{ presentation: 'modal', headerShown: true, title: '' }} />
          <Stack.Screen name="how-it-works" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="photo/[logId]" options={{ presentation: 'modal', headerShown: true, title: 'PHOTO' }} />
          <Stack.Screen name="offer/[id]" options={{ presentation: 'modal', headerShown: true, title: 'CHORE OFFER' }} />
          <Stack.Screen name="add-chore" options={{ presentation: 'modal', headerShown: true, title: '' }} />
          <Stack.Screen name="stakes" options={{ presentation: 'modal', headerShown: true, title: '' }} />
          <Stack.Screen name="privacy" options={{ presentation: 'modal', headerShown: true, title: 'PRIVACY' }} />
          <Stack.Screen name="terms" options={{ presentation: 'modal', headerShown: true, title: 'TERMS' }} />
          <Stack.Screen name="sign-in" options={{ presentation: 'modal', headerShown: true, title: 'SIGN IN' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
