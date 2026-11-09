import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { colors, space, type } from './theme';

const STEPS: { icon: React.ComponentProps<typeof Icon>['name']; title: string; body: string }[] = [
  {
    icon: 'home',
    title: 'Join your house',
    body: 'Create a house and share its 6-letter code, or join with a code from a housemate. Whoever creates it is the admin.',
  },
  {
    icon: 'checkmark-circle',
    title: 'Done a chore? Log it',
    body: 'Tap the chore and take a photo. It counts towards your score.',
  },
  {
    icon: 'notifications',
    title: 'Spotted a job? Flag it',
    body: 'Tap the chore and say it needs doing. Whoever has done the fewest chores gets asked.',
  },
  {
    icon: 'camera',
    title: 'Check each other',
    body: 'One housemate checks each photo. If it’s not done properly they send it back to redo. Unchecked ones are verified after 24 hours.',
  },
  {
    icon: 'trophy',
    title: 'Leaderboard',
    body: 'Scores reset every 2 months, so everyone gets a fresh start.',
  },
];

/** A short summary of how Choreboard works. Shown before sign-up and in Settings. */
export function HowItWorks() {
  return (
    <View style={{ gap: space.lg }}>
      {STEPS.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.badge}>
            <Icon name={s.icon} size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.heading}>{i + 1}. {s.title}</Text>
            <Text style={[type.small, { fontSize: 15, lineHeight: 21 }]}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  badge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
