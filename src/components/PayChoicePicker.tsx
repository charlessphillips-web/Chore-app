import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkPayChoice, PAY_LABELS, type PayChoice, type PayMethod } from '../lib/money';
import { Chip, ChipRow, Input, Label } from './ui';
import { space, type } from './theme';

const KEY = 'choreboard.lastPay';

/**
 * "How do you want to be paid?" — asked on every deal. Remembers your last
 * link on this phone so you don't retype it.
 */
export function usePayChoice() {
  const [method, setMethod] = useState<PayMethod>('monzo');
  const [link, setLink] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!v) return;
        const last = JSON.parse(v) as PayChoice;
        setMethod(last.method);
        setLink(last.link?.replace('https://', '') ?? '');
      })
      .catch(() => {});
  }, []);
  return {
    method, setMethod, link, setLink,
    /** Validated choice, or an error message. Saves it for next time. */
    check(): PayChoice | { error: string } {
      const c = checkPayChoice(method, link);
      if (!('error' in c)) AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
      return c;
    },
  };
}

export function PayChoicePicker({ state }: { state: ReturnType<typeof usePayChoice> }) {
  const { method, setMethod, link, setLink } = state;
  return (
    <View style={{ gap: space.sm }}>
      <Label>How do you want to be paid?</Label>
      <ChipRow>
        {(['monzo', 'paypal', 'cash'] as PayMethod[]).map((m) => (
          <Chip key={m} label={PAY_LABELS[m]} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </ChipRow>
      {method === 'cash' ? (
        <Text style={type.small}>They&apos;ll pay you in person.</Text>
      ) : (
        <>
          <Input
            value={link}
            onChangeText={setLink}
            placeholder={method === 'monzo' ? 'monzo.me/yourname' : 'paypal.me/yourname'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel={`Your ${PAY_LABELS[method]} link`}
          />
          <Text style={type.small}>
            {method === 'monzo'
              ? 'In the Monzo app: Payments → Share your link. Only shown to the person paying you.'
              : 'Your paypal.me link. Only shown to the person paying you.'}
          </Text>
        </>
      )}
    </View>
  );
}
