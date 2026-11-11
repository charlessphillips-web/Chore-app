import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { updateHouse } from '../lib/db';
import { choreSize, SIZE_NAMES, type ChoreSize, type HouseChore } from '../lib/chores';
import { haptics } from '../lib/haptics';
import { Button, Card, Chip, ErrorText, Label, Loading, Screen, Subtitle, Title } from '../components/ui';
import { colors, type } from '../components/theme';

/**
 * Straight after creating or joining a house: how fair share works, and (for
 * the admin) which chores count, how big each one is, and house stakes.
 */
export default function HouseStart() {
  const { user, house, members, isAdmin } = useApp();
  const [error, setError] = useState<string | null>(null);
  if (!user || !house) return <Loading />;
  const save = (patch: { chores?: HouseChore[]; stakes?: boolean }) => {
    haptics.tap();
    setError(null);
    updateHouse(house.id, patch).catch((e) => setError((e as Error).message));
  };
  const setChore = (key: string, change: Partial<HouseChore>) =>
    save({ chores: house.chores.map((c) => (c.key === key ? { ...c, ...change } : c)) });

  return (
    <Screen>
      <Title>{isAdmin ? 'Set up your house' : `Welcome to ${house.name}`}</Title>

      <Label>1 · Fair share</Label>
      <Card>
        <Text style={styles.big}>Everyone does their fair share.</Text>
        <Text style={type.small}>
          {members.length > 1
            ? `There are ${members.length} of you so far, so your fair share is ${Math.round(100 / members.length)}% of the chores.`
            : 'In a house of 4, your fair share is 25% of the chores.'}{' '}
          Home shows how close you
          are, and when something needs doing, whoever is furthest below their fair share gets asked.
        </Text>
      </Card>

      <Label>2 · Chores and points</Label>
      <Subtitle>
        Quick = 1 point, Medium = 2, Big = 3, so cleaning the oven counts for more than the bins.
        {isAdmin ? ' Switch off any your house doesn’t need, and change sizes if they look wrong.' : ' The house admin sets these.'}
      </Subtitle>
      <View style={styles.list}>
        {house.chores.filter((c) => isAdmin || c.active).map((c, i) => (
          <View key={c.key} style={[styles.row, i > 0 && styles.divider]}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.name, !c.active && { color: colors.muted }]}>{c.name}</Text>
              {isAdmin && c.active ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {([1, 2, 3] as ChoreSize[]).map((z) => (
                    <Chip key={z} label={SIZE_NAMES[z]} selected={choreSize(c) === z} onPress={() => setChore(c.key, { size: z })} />
                  ))}
                </View>
              ) : (
                <Text style={type.small}>{SIZE_NAMES[choreSize(c)]} · {choreSize(c)} point{choreSize(c) > 1 ? 's' : ''}</Text>
              )}
            </View>
            {isAdmin && (
              <Switch accessibilityLabel={`${c.name} on`} value={c.active} onValueChange={(on) => setChore(c.key, { active: on })} />
            )}
          </View>
        ))}
      </View>

      <Label>3 · House stakes (optional)</Label>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={[type.small, { flex: 1 }]}>
            A prize for whoever does the most this period and a forfeit for whoever does the least, e.g. &quot;Everyone buys
            them a pint&quot; or &quot;Cooks a roast&quot;. The whole house suggests and votes on Ranks.
          </Text>
          {isAdmin && <Switch accessibilityLabel="House stakes" value={house.stakes} onValueChange={(on) => save({ stakes: on })} />}
        </View>
        {!isAdmin && <Text style={type.small}>{house.stakes ? 'Your house has stakes switched on. Vote on Ranks.' : 'Your admin hasn’t switched these on.'}</Text>}
      </Card>

      {isAdmin && <Text style={type.small}>You can change all of this later in Settings.</Text>}
      <ErrorText>{error}</ErrorText>
      <Button title={isAdmin ? 'Done, take me to my house' : 'Got it'} onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 17, fontWeight: '600', color: colors.text },
  list: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
});
