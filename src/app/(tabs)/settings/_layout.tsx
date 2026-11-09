import { Stack } from 'expo-router';
import { darkHeader } from '../../../components/theme';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ ...darkHeader, headerBackTitle: 'Settings' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="personal" options={{ title: 'PERSONAL DETAILS' }} />
      <Stack.Screen name="chores" options={{ title: 'CHORES' }} />
      <Stack.Screen name="housemates" options={{ title: 'HOUSEMATES' }} />
      <Stack.Screen name="house-details" options={{ title: 'HOUSE DETAILS' }} />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="inbox" options={{ title: 'FEEDBACK INBOX' }} />
      <Stack.Screen name="avatar" options={{ title: 'PROFILE PICTURE' }} />
      <Stack.Screen name="dashboard" options={{ title: 'DASHBOARD' }} />
      <Stack.Screen name="account" options={{ title: 'YOUR LOGIN' }} />
    </Stack>
  );
}
