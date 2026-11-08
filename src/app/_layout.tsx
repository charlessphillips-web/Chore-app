import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../context/AppContext';
import { colors } from '../components/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="log" options={{ presentation: 'modal', headerShown: true, title: 'I did a chore' }} />
          <Stack.Screen name="request" options={{ presentation: 'modal', headerShown: true, title: 'Needs doing' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
