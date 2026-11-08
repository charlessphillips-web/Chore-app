import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../context/AppContext';
import { colors, darkHeader } from '../components/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <AppProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, ...darkHeader }}>
          <Stack.Screen name="chore/[key]" options={{ presentation: 'modal', headerShown: true, title: '' }} />
          <Stack.Screen name="how-it-works" options={{ presentation: 'modal', headerShown: true, title: 'How Choreboard works' }} />
          <Stack.Screen name="photo/[logId]" options={{ presentation: 'modal', headerShown: true, title: 'Photo' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
