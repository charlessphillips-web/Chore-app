import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { logChore, nudgeChore, NUDGE_EVERY_MS, requestChore } from '../../lib/db';
import { haptics } from '../../lib/haptics';
import { pickAssignee } from '../../lib/assign';
import { takeChorePhoto, type ChorePhoto } from '../../lib/photos';
import { formatPrice } from '../../lib/money';
import { Button, Card, ErrorText, Icon, Loading, notify, Screen, timeAgo, Title } from '../../components/ui';
import { colors, radius, space, type } from '../../components/theme';

type Step = 'choose' | 'done' | 'needs';

/** Tap a chore on Home → "I've done it" (photo) or "Bins are full" (ask whoever's done least). */
export default function ChoreScreen() {
  const { key, requestId } = useLocalSearchParams<{ key: string; requestId?: string }>();
  const { user, profile, house, members, openRequests, offers } = useApp();
  const [step, setStep] = useState<Step>(requestId ? 'done' : 'choose');
  const [photo, setPhoto] = useState<ChorePhoto | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | 'nudge' | null>(null);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const chore = house?.chores.find((c) => c.key === key);
  const assignee = useMemo(
    () => (user && chore ? pickAssignee(members, user.uid, 'overall', chore.key) : null),
    [members, user, chore],
  );

  if (!user || !profile || !house) return <Loading />;
  if (!chore) return <Screen edges={['left', 'right']}><Title>Chore not found</Title></Screen>;

  // A request for this chore that doing it would close.
  const request =
    openRequests.find((r) => r.id === requestId) ??
    openRequests.find((r) => r.choreKey === chore.key && r.assignedTo === user.uid) ??
    openRequests.find((r) => r.choreKey === chore.key);
  // An agreed offer: either you're doing it for someone, or someone's doing yours.
  const offer = offers.find((o) => o.status !== 'open' && (o.id === request?.id || o.id === request?.offerId));
  const doingForSomeone = offer && offer.doerUid === user.uid ? offer : null;
  const someoneDoingMine = offer && offer.fromUid === user.uid && offer.status === 'agreed' ? offer : null;
  const openOfferForMine = offers.find((o) => o.id === request?.id && o.status === 'open' && o.fromUid === user.uid);
  const canOffer = request && request.assignedTo === user.uid && request.kind === 'needs' && !offers.some((o) => o.id === request.id);

  async function snap() {
    setError(null);
    setBusy('photo');
    try {
      const p = await takeChorePhoto();
      if (p) setPhoto(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveDone() {
    if (!photo) return;
    setError(null);
    setBusy('save');
    try {
      await logChore({
        house: house!, members, uid: user!.uid, username: profile!.username,
        chore: chore!, photo, requestId: request?.id ?? null, offer: doingForSomeone,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function sendNeeds() {
    setError(null);
    setBusy('save');
    try {
      const { assignee: who, notified } = await requestChore({
        house: house!, members, chore: chore!, requester: { uid: user!.uid, username: profile!.username },
      });
      notify(
        'Sent',
        notified
          ? `${who.username} has been notified.`
          : `Added to ${who.username}'s list. They'll see it next time they open the app.`,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: chore.name }} />
      <Title>{chore.name}</Title>

      {step === 'choose' && (
        <>
          <Choice
            icon="checkmark-circle-outline"
            title="I've done it"
            subtitle="Take a photo — a housemate will check it"
            onPress={() => setStep('done')}
          />
          <Choice
            icon="notifications-outline"
            title={chore.needs}
            subtitle={
              request
                ? `Already flagged — waiting on ${request.assignedToName}`
                : assignee
                  ? `We'll ask ${assignee.username} (fewest chores this period)`
                  : 'Nobody else in the house yet'
            }
            onPress={() => setStep('needs')}
          />
          {request && request.assignedTo !== user.uid && (
            <NudgeCard
              name={request.assignedToName}
              flaggedAt={request.createdAt}
              lastNudgedAt={request.lastNudgedAt}
              now={now}
              busy={busy === 'nudge'}
              onNudge={async () => {
                setBusy('nudge');
                try {
                  await nudgeChore(house.id, request, { uid: user.uid, username: profile.username }, members);
                  haptics.success();
                  notify('Nudged 👋', `${request.assignedToName} has been reminded it's their turn.`);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            />
          )}
          <ErrorText>{error}</ErrorText>
        </>
      )}

      {step === 'done' && (someoneDoingMine || openOfferForMine) && (
        <>
          <Card>
            <Text style={type.body}>
              {someoneDoingMine
                ? `${someoneDoingMine.doerName} is doing this for you for ${formatPrice(someoneDoingMine.agreedPrice ?? someoneDoingMine.price)}.`
                : 'You’ve offered this chore to your housemates.'}
            </Text>
          </Card>
          <Button title="See offer" variant="secondary" onPress={() => router.replace({ pathname: '/offer/[id]', params: { id: (someoneDoingMine ?? openOfferForMine)!.id } })} />
        </>
      )}

      {step === 'done' && !someoneDoingMine && !openOfferForMine && (
        <>
          {doingForSomeone && (
            <Card>
              <Text style={type.body}>
                You&apos;re doing this for {doingForSomeone.fromName} for {formatPrice(doingForSomeone.agreedPrice ?? doingForSomeone.price)}. They get the point; you get paid once it&apos;s checked.
              </Text>
            </Card>
          )}
          {request?.kind === 'redo' && request.assignedTo === user.uid && (
            <Card style={{ borderColor: colors.danger }}>
              <Text style={type.body}>{request.requestedByName} sent this back: {request.reason}</Text>
            </Card>
          )}
          <Text style={type.small}>Take a photo of the finished chore. Everyone in the house will see it.</Text>
          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.previewUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          ) : (
            <Pressable onPress={snap} style={[styles.preview, styles.empty]} accessibilityRole="button" accessibilityLabel="Take photo">
              <Icon name="camera-outline" size={36} color={colors.muted} />
              <Text style={type.small}>Tap to take a photo</Text>
            </Pressable>
          )}
          <Button
            title={photo ? 'Retake photo' : 'Take photo'}
            icon="camera-outline"
            variant="secondary"
            onPress={snap}
            loading={busy === 'photo'}
            disabled={busy === 'save'}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Log chore" onPress={saveDone} loading={busy === 'save'} disabled={!photo || busy === 'photo'} />
          {canOffer && (
            <Button
              title="Pay a housemate to do it"
              icon="cash-outline"
              variant="ghost"
              onPress={() => router.replace({ pathname: '/offer/[id]', params: { id: request!.id } })}
            />
          )}
          {!requestId && <Button title="Back" variant="ghost" onPress={() => setStep('choose')} />}
        </>
      )}

      {step === 'needs' && (
        <>
          <Card>
            <Text style={type.small}>This will be sent to</Text>
            <Text style={type.heading}>{assignee ? assignee.username : 'Nobody yet'}</Text>
            <Text style={type.small}>
              {assignee
                ? `${assignee.totalCompleted} chore${assignee.totalCompleted === 1 ? '' : 's'} this period — the fewest in the house`
                : 'Share your house code from the House tab first.'}
            </Text>
          </Card>
          <ErrorText>{error}</ErrorText>
          <Button title={`Send: "${chore.needs}"`} onPress={sendNeeds} loading={busy === 'save'} disabled={!assignee} />
          <Button title="Back" variant="ghost" onPress={() => setStep('choose')} />
        </>
      )}
    </Screen>
  );
}

/** "Waiting on Alice · flagged 3h ago [Nudge Alice]", at most every 3 hours. */
function NudgeCard({ name, flaggedAt, lastNudgedAt, now, busy, onNudge }: {
  name: string; flaggedAt: number; lastNudgedAt: number | null; now: number; busy: boolean; onNudge: () => void;
}) {
  const wait = lastNudgedAt ? lastNudgedAt + NUDGE_EVERY_MS - now : 0;
  const hours = Math.max(1, Math.round(wait / 3_600_000));
  return (
    <Card>
      <Text style={type.body}>Waiting on {name}</Text>
      <Text style={type.small}>
        Flagged {timeAgo(flaggedAt)}{lastNudgedAt ? ` · last nudged ${timeAgo(lastNudgedAt)}` : ''}
      </Text>
      {wait > 0 ? (
        <Text style={type.small}>You can nudge again in {hours} hour{hours === 1 ? '' : 's'}.</Text>
      ) : (
        <Button title={`Nudge ${name}`} icon="hand-left-outline" variant="secondary" onPress={onNudge} loading={busy} />
      )}
    </Card>
  );
}

function Choice(p: { icon: React.ComponentProps<typeof Icon>['name']; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.title}
      onPress={p.onPress}
      style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.cardRaised }]}
    >
      <Icon name={p.icon} size={28} color={colors.primaryBright} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.heading}>{p.title}</Text>
        <Text style={type.small}>{p.subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
    borderWidth: 1, borderColor: colors.outline, borderRadius: radius, backgroundColor: colors.card,
  },
  preview: { borderRadius: radius, overflow: 'hidden', aspectRatio: 4 / 3, backgroundColor: colors.card },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, gap: space.sm },
});
