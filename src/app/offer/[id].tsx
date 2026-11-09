import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import {
  acceptCounter, acceptOffer, cancelOffer, counterOffer, createOffer, declineCounter, markOfferPaid, remindPayer,
} from '../../lib/db';
import { formatPrice, PAY_LABELS, parsePrice, payUrl, priceError, type PayChoice } from '../../lib/money';
import { effectiveStatus } from '../../lib/review';
import { haptics } from '../../lib/haptics';
import { PayChoicePicker, usePayChoice } from '../../components/PayChoicePicker';
import {
  Button, Card, confirm, BigNumber, ErrorText, Input, Label, Loading, notify, Screen, Subtitle, Title,
} from '../../components/ui';
import { colors, fonts, space, type } from '../../components/theme';

const DAY = 24 * 60 * 60 * 1000;

/**
 * One chore offer (ID = the "needs doing" request's ID). What you see
 * depends on who you are: the person offering, or a housemate.
 */
export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile, house, members, openRequests, offers, logs } = useApp();
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pay = usePayChoice();

  if (!user || !profile || !house) return <Loading />;
  const me = { uid: user.uid, username: profile.username };
  const offer = offers.find((o) => o.id === id);
  const request = openRequests.find((r) => r.id === id);

  async function run(label: string, fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    setBusy(label);
    try {
      await fn();
      haptics.success();
      after?.();
    } catch (e) {
      haptics.warning();
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const withPay = (fn: (p: PayChoice) => Promise<unknown>) => () => {
    const c = pay.check();
    if ('error' in c) return setError(c.error);
    return fn(c);
  };
  const priceBox = <PriceInput value={price} onChange={(v) => { setPrice(v); setError(null); }} />;

  // ---- No offer yet: the person whose turn it is sets a price ----
  if (!offer) {
    if (!request || request.assignedTo !== user.uid) {
      return <Screen edges={['left', 'right']}><Subtitle>This offer has finished.</Subtitle></Screen>;
    }
    const send = () => {
      const err = priceError(price);
      if (err) return setError(err);
      run('send', () => createOffer({ house, members, request, from: me, price: parsePrice(price)! }), () => {
        notify('Offer sent', 'Your housemates can accept it or make you one counter offer each.');
        router.back();
      });
    };
    return (
      <Screen edges={['left', 'right']}>
        <Stack.Screen options={{ title: 'PAY SOMEONE TO DO IT' }} />
        <Title>{request.choreName}</Title>
        <Subtitle>
          Offer your housemates money to do this for you. They can accept your price or make one counter offer each.
        </Subtitle>
        <Label>Your price</Label>
        {priceBox}
        <Text style={type.small}>
          You get the leaderboard point once it&apos;s been checked and you&apos;ve paid. You pay them directly —
          Rotawise never holds money.
        </Text>
        <ErrorText>{error}</ErrorText>
        <Button title="Send offer" onPress={send} loading={busy === 'send'} disabled={!price.trim()} />
      </Screen>
    );
  }

  const mine = offer.fromUid === user.uid;
  const amIDoer = offer.doerUid === user.uid;
  const myCounter = offer.counters[user.uid];
  const pending = Object.entries(offer.counters).filter(([uid]) => !offer.declined.includes(uid));
  const log = logs.find((l) => l.id === offer.logId);
  const logStatus = log ? effectiveStatus(log) : null;
  const checked = logStatus === 'verified' || logStatus === 'auto_verified';
  const amount = offer.agreedPrice ?? offer.price;
  const price$ = formatPrice(amount);
  const now = new Date().getTime();
  const canRemind = amIDoer && checked && !!log && now - log.at > 2 * DAY
    && (!offer.remindedAt || now - offer.remindedAt > DAY);

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'CHORE OFFER' }} />
      <Text style={type.label}>{offer.choreName}</Text>
      <BigNumber value={price$} size={56} />
      <Text style={type.small}>
        {offer.status === 'open'
          ? mine ? 'Your offer' : `${offer.fromName} will pay`
          : mine ? `You're paying ${offer.doerName}` : amIDoer ? `${offer.fromName} is paying you` : `${offer.fromName} → ${offer.doerName}`}
      </Text>

      {/* ---- Open: waiting for someone to take it ---- */}
      {offer.status === 'open' && mine && (
        <>
          <Label>Counter offers</Label>
          {pending.length === 0 && <Subtitle>None yet. Your housemates have been notified.</Subtitle>}
          {pending.map(([uid, c]) => (
            <Card key={uid}>
              <Text style={type.body}>
                {c.name} will do it for <Text style={{ fontWeight: '700' }}>{formatPrice(c.price)}</Text>
                <Text style={type.small}>{c.pay ? `  · wants ${PAY_LABELS[c.pay.method]}` : ''}</Text>
              </Text>
              <View style={styles.pair}>
                <Button title="Decline" variant="secondary" style={{ flex: 1 }} loading={busy === `no${uid}`} disabled={!!busy}
                  onPress={() => run(`no${uid}`, () => declineCounter(house.id, offer, uid, members))} />
                <Button title={`Accept ${formatPrice(c.price)}`} style={{ flex: 1 }} loading={busy === `yes${uid}`} disabled={!!busy}
                  onPress={() => run(`yes${uid}`, () => acceptCounter(house.id, offer, uid, members))} />
              </View>
            </Card>
          ))}
          {offer.declined.length > 0 && (
            <Text style={type.small}>
              Declined: {offer.declined.map((u) => `${offer.counters[u]?.name} (${formatPrice(offer.counters[u]?.price ?? 0)})`).join(', ')}
            </Text>
          )}
          <Button title="Withdraw offer" variant="ghost" disabled={!!busy}
            onPress={async () => {
              if (await confirm('Withdraw offer?', 'The chore goes back to being yours to do.', 'Withdraw')) {
                run('cancel', () => cancelOffer(house.id, offer), () => router.back());
              }
            }} />
        </>
      )}

      {offer.status === 'open' && !mine && (
        <>
          <Subtitle>
            {offer.fromName} will pay {formatPrice(offer.price)} for someone to do this. You get paid once it&apos;s been
            checked; {offer.fromName} keeps the leaderboard point.
          </Subtitle>
          <PayChoicePicker state={pay} />
          <Button title={`Do it for ${formatPrice(offer.price)}`} loading={busy === 'accept'} disabled={!!busy}
            onPress={withPay((p) => run('accept', () => acceptOffer(house.id, offer, me, p, members)))} />
          <Label>Or make a counter offer</Label>
          {myCounter ? (
            <Card>
              <Text style={type.body}>
                {offer.declined.includes(user.uid)
                  ? `${offer.fromName} declined your ${formatPrice(myCounter.price)}. You can still accept their price.`
                  : `You offered ${formatPrice(myCounter.price)}. Waiting for ${offer.fromName} to decide.`}
              </Text>
            </Card>
          ) : (
            <>
              <Text style={type.small}>You can only make one counter offer, so make it count.</Text>
              {priceBox}
              <Button title="Send counter offer" variant="secondary" loading={busy === 'counter'} disabled={!!busy || !price.trim()}
                onPress={withPay((p) => {
                  const err = priceError(price);
                  if (err) return Promise.resolve(setError(err));
                  return run('counter', () => counterOffer(house.id, offer, me, parsePrice(price)!, p, members), () => setPrice(''));
                })} />
            </>
          )}
        </>
      )}

      {/* ---- Agreed: the doer needs to do it ---- */}
      {offer.status === 'agreed' && amIDoer && (
        <>
          <Subtitle>Do the chore and take a photo as usual. {offer.fromName} pays you once a housemate has checked it.</Subtitle>
          <Button title="Do it now" icon="camera-outline"
            onPress={() => router.replace({ pathname: '/chore/[key]', params: { key: offer.choreKey, requestId: offer.requestId } })} />
        </>
      )}
      {offer.status === 'agreed' && !amIDoer && (
        <Subtitle>{offer.doerName} is doing this for {price$}. {mine ? 'You pay once it’s been checked.' : ''}</Subtitle>
      )}

      {/* ---- Done: check, then pay ---- */}
      {offer.status === 'done' && (
        <>
          <Card>
            <Text style={type.body}>
              {logStatus === 'rejected'
                ? `It was sent back, so ${amIDoer ? 'you need' : `${offer.doerName} needs`} to redo it first.`
                : checked
                  ? `${amIDoer ? 'You' : offer.doerName} did it and it's been checked.`
                  : `${amIDoer ? 'You' : offer.doerName} did it. Waiting for a housemate to check the photo (or 24 hours).`}
            </Text>
          </Card>
          {mine && checked && (
            <>
              <Label>Pay {offer.doerName}</Label>
              {offer.doerPay && offer.doerPay.method !== 'cash' && offer.doerPay.link ? (
                <>
                  <Text style={type.small}>{offer.doerName} asked to be paid by {PAY_LABELS[offer.doerPay.method]}.</Text>
                  <Button title={`Pay ${price$} with ${PAY_LABELS[offer.doerPay.method]}`} icon="card-outline" variant="secondary"
                    onPress={() => Linking.openURL(payUrl(offer.doerPay!.link!, amount, `Rotawise: ${offer.choreName}`))} />
                </>
              ) : (
                <Text style={type.small}>{offer.doerName} asked for cash. Pay them in person.</Text>
              )}
              <Button title={`I've paid ${offer.doerName}`} icon="checkmark-done" loading={busy === 'paid'} disabled={!!busy}
                onPress={async () => {
                  if (await confirm(`Paid ${offer.doerName} ${price$}?`, 'This closes the deal and gives you the point for this chore.', "I've paid")) {
                    run('paid', () => markOfferPaid(house, offer, members), () => {
                      notify('Done', 'Thanks! The chore counts for you now.');
                      router.back();
                    });
                  }
                }} />
            </>
          )}
          {amIDoer && (
            <>
              <Text style={type.small}>
                {offer.fromName} will pay you {price$}
                {offer.doerPay ? ` by ${PAY_LABELS[offer.doerPay.method]}` : ''} once it&apos;s checked. You&apos;ll get a notification.
              </Text>
              {canRemind && (
                <Button title={`Remind ${offer.fromName}`} icon="notifications-outline" variant="secondary" loading={busy === 'remind'} disabled={!!busy}
                  onPress={() => run('remind', () => remindPayer(house.id, offer, members), () => notify('Sent', `${offer.fromName} has been reminded.`))} />
              )}
            </>
          )}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.pound}>£</Text>
      <Input
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
        placeholder="3.00"
        keyboardType="decimal-pad"
        accessibilityLabel="Price in pounds"
        style={{ flex: 1, fontFamily: fonts.mono }}
        maxLength={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pound: { fontSize: 22, fontFamily: fonts.mono, color: colors.muted },
});
