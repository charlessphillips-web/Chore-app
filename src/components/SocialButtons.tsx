/**
 * "Continue with Apple" (iPhone app) / "Continue with Google" (website).
 * No password to forget. Used on Create account, Sign in and Your login.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { availableProviders, connect, connected, continueWith, socialError, PROVIDER_NAMES, type Provider } from '../lib/socialSignIn';
import { haptics } from '../lib/haptics';
import { track } from '../lib/analytics';
import { ErrorText } from './ui';
import { colors } from './theme';

const ICON: Record<Provider, React.ComponentProps<typeof Ionicons>['name']> = { apple: 'logo-apple', google: 'logo-google' };

/** Sign up / sign in buttons. `mode: 'connect'` adds them to the signed-in account instead. */
export function SocialButtons({ mode = 'signin', divider = true }: { mode?: 'signin' | 'connect'; divider?: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<Provider[]>(() => (mode === 'connect' ? connected() : []));
  useEffect(() => { availableProviders().then(setProviders).catch(() => {}); }, []);
  if (providers.length === 0) return null;

  async function go(p: Provider) {
    haptics.tap();
    setError(null);
    setBusy(p);
    try {
      if (mode === 'connect') {
        await connect(p);
        setLinked(connected());
        haptics.success();
      } else {
        await continueWith(p);
        haptics.success();
        router.replace('/');
      }
      track(p === 'apple' ? 'signin_apple' : 'signin_google');
    } catch (e) {
      const msg = socialError(e, p);
      if (msg) setError(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {providers.map((p) => {
        const done = linked.includes(p);
        const label = mode === 'connect' ? (done ? `${PROVIDER_NAMES[p]} connected ✓` : `Connect ${PROVIDER_NAMES[p]}`) : `Continue with ${PROVIDER_NAMES[p]}`;
        return (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={!!busy || done}
            onPress={() => go(p)}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 999, paddingVertical: 14,
              backgroundColor: colors.primary, opacity: done ? 0.6 : pressed ? 0.8 : 1,
            }]}
          >
            {busy === p ? <ActivityIndicator color={colors.primaryText} /> : <Ionicons name={ICON[p]} size={20} color={colors.primaryText} />}
            <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        );
      })}
      <ErrorText>{error}</ErrorText>
      {divider && mode === 'signin' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>or use your email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        </View>
      )}
    </View>
  );
}
