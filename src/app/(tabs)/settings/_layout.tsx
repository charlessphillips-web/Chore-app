import { Stack } from 'expo-router';
import { darkHeader } from '../../../components/theme';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ ...darkHeader, headerBackTitle: 'Settings' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="personal" options={{ title: 'Personal details' }} />
      <Stack.Screen name="chores" options={{ title: 'Chores' }} />
      <Stack.Screen name="housemates" options={{ title: 'Housemates' }} />
      <Stack.Screen name="house-details" options={{ title: 'House details' }} />
    </Stack>
  );
}
