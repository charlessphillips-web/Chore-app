import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { loadDashboard, type DashboardData } from '../../../lib/db';
import { ageBars, countSince, signupsByWeek, tally, usersCsv, type Bar } from '../../../lib/stats';
import { formatPrice } from '../../../lib/money';
import { Button, ErrorText, Label, Loading, Screen, Subtitle } from '../../../components/ui';
import { colors, fonts, type } from '../../../components/theme';

const DAY = 86_400_000;

/** Owner-only: who's using the app, and how. Anonymous totals, no names. */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    loadDashboard()
      .then((d) => {
        if (!live) return;
        setData(d);
        setNow(Date.now());
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [nonce]);
  const load = () => {
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  };

  if (error) return <Screen edges={['left', 'right']}><ErrorText>{error}</ErrorText><Button title="Try again" onPress={load} /></Screen>;
  if (!data) return <Loading />;

  const { users, houses } = data;
  const areaOf = new Map(houses.map((h) => [h.id, h.area ? `${h.area.outcode} · ${h.area.district}` : null]));
  const students = users.filter((u) => u.isStudent).length;
  const today = new Date(now);

  function download() {
    const csv = usersCsv(users.map((u) => ({ ...u, area: u.houseId ? areaOf.get(u.houseId) ?? null : null })), today);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${today.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Anonymous totals for the whole app. No names are shown.</Subtitle>

      <View style={styles.grid}>
        <Stat value={users.length} label="Users" sub={`+${countSince(users.map((u) => u.createdAt), 7 * DAY, now)} this week`} />
        <Stat value={houses.length} label="Houses" sub={`+${countSince(houses.map((h) => h.createdAt), 7 * DAY, now)} this week`} />
        <Stat value={data.active1d} label="Active today" sub={`${data.active7d} this week`} />
        <Stat value={data.chores} label="Chores logged" sub={`${data.chores7d} this week`} />
        <Stat value={houses.length ? (data.members / houses.length).toFixed(1) : '–'} label="People per house" />
        <Stat value={data.chores ? `${Math.round((data.sentBack / data.chores) * 100)}%` : '–'} label="Sent back" />
        <Stat value={data.deals} label="Paid chore deals" sub={`${formatPrice(data.dealPence)} in total`} />
        <Stat value={users.length ? `${Math.round((students / users.length) * 100)}%` : '–'} label="Students" />
      </View>

      <Label>Sign-ups per week</Label>
      <Columns bars={signupsByWeek(users, 8, now)} />

      <Label>Age</Label>
      <Bars bars={ageBars(users, today)} />

      <Label>Gender</Label>
      <Bars bars={tally(users.map((u) => u.gender), 6)} />

      <Label>Universities</Label>
      <Bars bars={tally(users.filter((u) => u.isStudent).map((u) => u.university), 10)} />

      <Label>Where houses are</Label>
      <Bars bars={tally(houses.map((h) => h.area?.district ?? null), 10)} />

      <Button title="Refresh" icon="refresh" variant="secondary" onPress={load} loading={loading} />
      {Platform.OS === 'web' ? (
        <Button title="Download users (CSV)" icon="download-outline" variant="secondary" onPress={download} />
      ) : (
        <Text style={type.small}>Open this page on a laptop (your web link) to download a spreadsheet.</Text>
      )}
      <Text style={type.small}>The spreadsheet has no names or account IDs: age, gender, university and house area only.</Text>
    </Screen>
  );
}

function Stat({ value, label, sub }: { value: number | string; label: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={type.small}>{sub}</Text> : null}
    </View>
  );
}

/** Horizontal bars with counts and percentages. */
function Bars({ bars }: { bars: Bar[] }) {
  if (bars.every((b) => b.count === 0)) return <Text style={type.small}>No data yet.</Text>;
  return (
    <View style={styles.card}>
      {bars.map((b) => (
        <View key={b.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[type.body, { fontSize: 14 }]} numberOfLines={1}>{b.label}</Text>
            <Text style={styles.num}>{b.count} · {Math.round(b.share * 100)}%</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, b.share * 100)}%` }]} /></View>
        </View>
      ))}
    </View>
  );
}

/** Small column chart, e.g. sign-ups per week. */
function Columns({ bars }: { bars: Bar[] }) {
  return (
    <View style={[styles.card, { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 }]}>
      {bars.map((b) => (
        <View key={b.label} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
          <Text style={styles.num}>{b.count}</Text>
          <View style={{ width: '100%', height: `${Math.max(3, b.share * 70)}%`, backgroundColor: colors.text, borderRadius: 4 }} />
          <Text style={[styles.num, { fontSize: 9 }]} numberOfLines={1}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  stat: { width: '49%', backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 2 },
  statValue: { fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  statLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 12 },
  track: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.text, borderRadius: 3 },
  num: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
