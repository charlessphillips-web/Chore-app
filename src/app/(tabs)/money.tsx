import { Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { formatPrice, PAY_LABELS } from '../../lib/money';
import { effectiveStatus } from '../../lib/review';
import type { ChoreOffer } from '../../lib/types';
import { Card, Label, ListGroup, ListRow, Loading, Screen, Subtitle, Title } from '../../components/ui';
import { type } from '../../components/theme';

/**
 * Everything about paying housemates to do chores: deals that need you,
 * chores you could offer, ones up for grabs, and ones in progress.
 */
export default function Money() {
  const { user, openRequests, offers, logs } = useApp();
  if (!user) return <Loading />;
  const uid = user.uid;
  const open = (id: string) => router.push({ pathname: '/offer/[id]', params: { id } });
  const checked = (o: ChoreOffer) => {
    const l = logs.find((x) => x.id === o.logId);
    const s = l ? effectiveStatus(l) : null;
    return s === 'verified' || s === 'auto_verified';
  };
  const price = (o: ChoreOffer) => formatPrice(o.agreedPrice ?? o.price);
  const pendingCounters = (o: ChoreOffer) => Object.keys(o.counters).filter((u) => !o.declined.includes(u));

  const answer = offers.filter((o) => o.fromUid === uid && o.status === 'open' && pendingCounters(o).length > 0);
  const toPay = offers.filter((o) => o.fromUid === uid && o.status === 'done' && checked(o));
  const toDo = offers.filter((o) => o.doerUid === uid && o.status === 'agreed');
  const canOffer = openRequests.filter(
    (r) => r.assignedTo === uid && r.kind === 'needs' && !offers.some((o) => o.id === r.id),
  );
  const grabs = offers.filter((o) => o.status === 'open' && o.fromUid !== uid);
  const waiting = offers.filter(
    (o) =>
      (o.fromUid === uid && ((o.status === 'open' && pendingCounters(o).length === 0) || o.status === 'agreed' || (o.status === 'done' && !checked(o))))
      || (o.doerUid === uid && o.status === 'done'),
  );
  const nothing = answer.length + toPay.length + toDo.length + canOffer.length + grabs.length + waiting.length === 0;

  return (
    <Screen>
      <Title>Money</Title>
      <Subtitle>Pay a housemate to do your chore, or earn by doing theirs.</Subtitle>

      {answer.length + toPay.length + toDo.length > 0 && (
        <>
          <Label>Needs you</Label>
          <ListGroup>
            {answer.map((o) => {
              const n = pendingCounters(o).length;
              return <ListRow key={o.id} icon="swap-horizontal" title={`${o.choreName}: ${n} counter offer${n > 1 ? 's' : ''}`} subtitle="Accept or decline" onPress={() => open(o.id)} />;
            })}
            {toPay.map((o) => (
              <ListRow key={o.id} icon="card-outline" title={`Pay ${o.doerName} ${price(o)}`}
                subtitle={`${o.choreName} · ${o.doerPay ? PAY_LABELS[o.doerPay.method] : 'cash'} · you get the point once paid`} onPress={() => open(o.id)} />
            ))}
            {toDo.map((o) => (
              <ListRow key={o.id} icon="camera-outline" title={`Do ${o.choreName} for ${o.fromName}`}
                subtitle={`You'll get ${price(o)} once it's checked`} onPress={() => open(o.id)} />
            ))}
          </ListGroup>
        </>
      )}

      {canOffer.length > 0 && (
        <>
          <Label>Your turn · offer it for money?</Label>
          <ListGroup>
            {canOffer.map((r) => (
              <ListRow key={r.id} icon="pricetag-outline" title={r.needs} subtitle="Set a price for a housemate to do it" onPress={() => open(r.id)} />
            ))}
          </ListGroup>
        </>
      )}

      {grabs.length > 0 && (
        <>
          <Label>Up for grabs</Label>
          <ListGroup>
            {grabs.map((o) => {
              const c = o.counters[uid];
              return (
                <ListRow
                  key={o.id}
                  icon="cash-outline"
                  title={`${o.choreName} · ${formatPrice(o.price)}`}
                  subtitle={
                    c
                      ? o.declined.includes(uid) ? `${o.fromName} declined your ${formatPrice(c.price)}` : `You offered ${formatPrice(c.price)} · waiting for ${o.fromName}`
                      : `${o.fromName} will pay · accept or counter`
                  }
                  onPress={() => open(o.id)}
                />
              );
            })}
          </ListGroup>
        </>
      )}

      {waiting.length > 0 && (
        <>
          <Label>In progress</Label>
          <ListGroup>
            {waiting.map((o) => (
              <ListRow
                key={o.id}
                icon="time-outline"
                title={`${o.choreName} · ${price(o)}`}
                subtitle={
                  o.doerUid === uid
                    ? checked(o) ? `Waiting for ${o.fromName} to pay you` : 'Waiting for your photo to be checked'
                    : o.status === 'open' ? 'Waiting for a housemate to take it'
                      : o.status === 'agreed' ? `${o.doerName} is doing it` : `${o.doerName} did it · waiting for the check`
                }
                onPress={() => open(o.id)}
              />
            ))}
          </ListGroup>
        </>
      )}

      {nothing && (
        <Card>
          <Text style={type.body}>Nothing here yet.</Text>
          <Text style={type.small}>
            When it&apos;s your turn to do a chore, you can offer it here for money. Housemates accept or make one counter
            offer each. Once it&apos;s done and checked, you pay them directly (Monzo, PayPal or cash) and the point is yours.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
