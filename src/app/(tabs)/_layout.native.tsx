/**
 * Tab bar on iPhone and Android: the phone's own tab bar (on iOS 26, Apple's
 * floating "Liquid Glass" bar with the highlight that slides between tabs).
 * The website uses _layout.tsx.
 */
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTabsState } from '../../components/tabBadges';
import { colors } from '../../components/theme';
import { haptics } from '../../lib/haptics';
import { track, type EventName } from '../../lib/analytics';

export default function TabsLayout() {
  const { redirect, toCheck, payToDo } = useTabsState();
  if (redirect) return <Redirect href={redirect} />;
  return (
    <NativeTabs
      tintColor={colors.brand}
      badgeBackgroundColor={colors.brand}
      screenListeners={({ route }) => ({
        tabPress: () => {
          haptics.select();
          track(`tab_${route.name}` as EventName);
        },
      })}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="checks">
        <NativeTabs.Trigger.Icon sf={{ default: 'camera', selected: 'camera.fill' }} md="photo_camera" />
        <NativeTabs.Trigger.Label>Checks</NativeTabs.Trigger.Label>
        {toCheck > 0 && <NativeTabs.Trigger.Badge>{String(toCheck)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} md="emoji_events" />
        <NativeTabs.Trigger.Label>Ranks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pay">
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Pay</NativeTabs.Trigger.Label>
        {payToDo > 0 && <NativeTabs.Trigger.Badge>{String(payToDo)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="house">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>House</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
