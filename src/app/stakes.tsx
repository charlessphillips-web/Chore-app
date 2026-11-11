import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { deleteStake, suggestStake, voteStake } from '../lib/db';
import { periodKey } from '../lib/period';
import { rankedStakes, STAKE_MAX, type StakeKind } from '../lib/stakes';
import { haptics } from '../lib/haptics';
import { Button, confirm, ErrorText, Icon, Input, Label, Loading, Screen, Subtitle, Title } from '../components/ui';
import { colors, radius, type } from '../components/theme';

const KINDS: { kind: StakeKind; label: string; hint: string; placeholder: string }[] = [
  { kind: 'prize', label: 'Prize for the top', hint: 'Whoever has the most points when the period ends.', placeholder: 'e.g. Everyone buys them a pint' },
  { kind: 'forfeit', label: 'Forfeit for the bottom', hint: 'Whoever has the fewest points. Keep it friendly.', placeholder: 'e.g. Cooks a roast for the house' },
];

/** Suggest and vote on the house prize and forfeit for this period. */
export default function Stakes() {
  const { user, house, members, stakes, isAdmin } = useApp();
  const [text, setText] = useState<Record<StakeKind, string>>({ prize: '', forfeit: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user || !house) return <Loading />;
  const me = members.find((m) => m.uid === user.uid);
  const period = periodKey(new Date(), house.reset);
  if (!house.stakes) {
    return <Screen><Title>House stakes</Title><Subtitle>House stakes are switched off. The house admin can switch them on in Settings → House details.</Subtitle></Screen>;
  }

  async function run(id: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(id);
    try {
      await fn();
      haptics.success();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title>House stakes</Title>
      <Subtitle>
        Optional, just for fun. Suggest a prize and a forfeit, and the whole house votes. You get one vote for each.
        When the period ends, the top-voted ones count. Ties share it.
      </Subtitle>

      {KINDS.map(({ kind, label, hint, placeholder }) => {
        const list = rankedStakes(stakes, kind, period);
        return (
          <View key={kind} style={{ gap: 10 }}>
            <Label>{label}</Label>
            <Text style={type.small}>{hint}</Text>
            {list.length === 0 && <Text style={type.small}>No suggestions yet. Be the first.</Text>}
            {list.map((s, i) => {
              const voted = s.votes.includes(user.uid);
              const canDelete = s.byUid === user.uid || isAdmin;
              return (
                <View key={s.id} style={[styles.row, i === 0 && s.votes.length > 0 && styles.top]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.text}>{s.text}</Text>
                    <Text style={type.small}>
                      {s.votes.length} vote{s.votes.length === 1 ? '' : 's'} · from {s.byName}{i === 0 && s.votes.length > 0 ? ' · winning' : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={voted ? `Remove vote: ${s.text}` : `Vote: ${s.text}`}
                    disabled={!!busy}
                    onPress={() => { haptics.tap(); run(s.id, () => voteStake(house.id, user.uid, s, stakes)); }}
                    style={[styles.vote, voted && styles.voted]}
                  >
                    <Text style={[styles.voteText, voted && { color: colors.bg }]}>{voted ? 'Voted' : 'Vote'}</Text>
                  </Pressable>
                  {canDelete && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete: ${s.text}`}
                      hitSlop={8}
                      onPress={async () => {
                        if (await confirm('Delete this suggestion?', s.text, 'Delete')) run(s.id, () => deleteStake(house.id, s.id));
                      }}
                    >
                      <Icon name="close" size={18} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              );
            })}
            <Input
              value={text[kind]}
              onChangeText={(v) => setText((t) => ({ ...t, [kind]: v }))}
              placeholder={placeholder}
              maxLength={STAKE_MAX}
            />
            <Button
              title={kind === 'prize' ? 'Suggest a prize' : 'Suggest a forfeit'}
              variant="secondary"
              loading={busy === kind}
              disabled={!!busy || !text[kind].trim() || !me}
              onPress={() =>
                run(kind, async () => {
                  await suggestStake(house.id, me!, kind, text[kind], period, stakes);
                  setText((t) => ({ ...t, [kind]: '' }));
                })
              }
            />
          </View>
        );
      })}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius, backgroundColor: colors.card },
  top: { borderWidth: 1.5, borderColor: colors.you },
  text: { fontSize: 15, fontWeight: '600', color: colors.text },
  vote: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  voted: { backgroundColor: colors.text, borderColor: colors.text },
  voteText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
