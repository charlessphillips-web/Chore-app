import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { setFeedbackDone, watchFeedback, type FeedbackItem } from '../../../lib/db';
import { jpegUri } from '../../../lib/photos';
import { Button, Card, Chip, ChipRow, Empty, ErrorText, Icon, Loading, notify, Screen, timeAgo } from '../../../components/ui';
import { colors, radius, type } from '../../../components/theme';

type Filter = 'new' | 'done' | 'all';

/** Bug reports and suggestions. Only visible to app owners (see firestore.rules). */
export default function Inbox() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('new');

  useEffect(() => watchFeedback(setItems, (e) => setError(e.message)), []);

  if (error) return <Screen edges={['left', 'right']}><ErrorText>{error}</ErrorText></Screen>;
  if (!items) return <Loading />;

  const newCount = items.filter((i) => !i.done).length;
  const shown = items.filter((i) => (filter === 'all' ? true : filter === 'done' ? i.done : !i.done));

  return (
    <Screen edges={['left', 'right']}>
      <ChipRow>
        <Chip label={`New (${newCount})`} selected={filter === 'new'} onPress={() => setFilter('new')} />
        <Chip label="Done" selected={filter === 'done'} onPress={() => setFilter('done')} />
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </ChipRow>
      {shown.length === 0 && (
        <Empty icon="mail-open-outline">{filter === 'new' ? 'Nothing new. You’re all caught up.' : 'Nothing here yet.'}</Empty>
      )}
      {shown.map((i) => <Report key={i.id} item={i} />)}
    </Screen>
  );
}

function Report({ item }: { item: FeedbackItem }) {
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const bug = item.type === 'bug';

  async function toggle() {
    setBusy(true);
    try {
      await setFeedbackDone(item.id, !item.done);
    } catch (e) {
      notify('Could not update', (e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Card style={item.done ? { opacity: 0.6 } : undefined}>
      <View style={styles.top}>
        <View style={[styles.tag, { borderColor: bug ? colors.danger : colors.primaryBright }]}>
          <Icon name={bug ? 'bug-outline' : 'bulb-outline'} size={14} color={bug ? colors.danger : colors.primaryBright} />
          <Text style={[styles.tagText, { color: bug ? colors.danger : colors.primaryBright }]}>{bug ? 'Bug' : 'Suggestion'}</Text>
        </View>
        <Text style={type.small}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={type.body}>{item.message}</Text>
      <Text style={type.small}>
        {item.username ?? 'Someone'}
        {item.phone ? ` · ${item.phone}` : ''}
        {item.appVersion ? ` · v${item.appVersion}` : ''}
      </Text>
      {item.screenshot && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={big ? 'Shrink screenshot' : 'Enlarge screenshot'}
          onPress={() => setBig(!big)}
          style={[styles.shot, big ? { width: '100%' } : { width: '45%' }]}
        >
          <Image source={{ uri: jpegUri(item.screenshot) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Pressable>
      )}
      {item.screenshot && <Text style={type.small}>Tap the screenshot to {big ? 'shrink' : 'enlarge'} it</Text>}
      <Button
        title={item.done ? 'Move back to New' : 'Mark as done'}
        icon={item.done ? 'arrow-undo-outline' : 'checkmark-outline'}
        variant="secondary"
        onPress={toggle}
        loading={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '600' },
  shot: { aspectRatio: 9 / 16, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.cardRaised },
});
