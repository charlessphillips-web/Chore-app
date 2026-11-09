import React from 'react';
import {
  ActivityIndicator, Alert, Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from './theme';
import { haptics } from '../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * A scrollable page. On iOS the content moves up when the keyboard opens and
 * there's extra room at the bottom, so you can always scroll the box you're
 * typing in into view.
 */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  background,
}: {
  children: React.ReactNode;
  edges?: ('top' | 'left' | 'right' | 'bottom')[];
  /** Optional wallpaper (data URI), shown faintly behind the page. */
  background?: string | null;
}) {
  const content = (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.screenInner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
  if (!background) return <View style={styles.root}>{content}</View>;
  return (
    <ImageBackground source={{ uri: background }} style={styles.root} imageStyle={{ opacity: 0.28 }} resizeMode="cover">
      {content}
    </ImageBackground>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={type.title}>{children}</Text>;
}

/** Text size for a house name: smaller the longer it is, so it always fits. */
export function houseNameSize(name: string): number {
  const n = name.length;
  if (n <= 10) return 28;
  if (n <= 16) return 24;
  if (n <= 24) return 20;
  return 17;
}

/** The house name, shrinking to fit (up to 2 lines) so it's never cut off. */
export function HouseName({ name }: { name: string }) {
  return (
    <Text
      style={[type.title, { fontSize: houseNameSize(name), lineHeight: houseNameSize(name) * 1.2 }]}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {name}
    </Text>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={[type.small, { fontSize: 15, lineHeight: 21 }]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={[type.label, { marginTop: space.sm }]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Button({
  title, onPress, variant = 'primary', loading, disabled, style, icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: IconName;
}) {
  const filled = variant === 'primary';
  const fg = filled ? colors.inverse : variant === 'danger' ? colors.danger : colors.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        filled && { backgroundColor: colors.primary, borderColor: colors.primary },
        variant === 'danger' && { borderColor: colors.danger },
        variant === 'ghost' && { borderColor: 'transparent' },
        { opacity: off ? 0.4 : pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon && <Icon name={icon} size={16} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A tappable row, e.g. a setting or "needs doing". */
export function RowButton({
  title, subtitle, onPress, icon, right, testID, highlight,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: IconName;
  right?: React.ReactNode;
  testID?: string;
  /** Small white dot: something needs you. */
  highlight?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardRaised }]}
    >
      {icon && <Icon name={icon} size={19} color={colors.text} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {highlight && <View style={styles.dot} />}
      {right}
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

/** Rows grouped in one block with hairlines between them (the "list" look). */
export function ListGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {items.map((c, i) => (
        <View key={i} style={i > 0 ? styles.groupLine : undefined}>{c}</View>
      ))}
    </View>
  );
}

/** One row inside a ListGroup. */
export function ListRow({
  title, subtitle, onPress, icon, right, accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  icon?: IconName;
  right?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={!onPress}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.listRow, pressed && onPress && { backgroundColor: colors.cardRaised }]}
    >
      {icon && <Icon name={icon} size={19} color={colors.muted} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={type.small} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && <Icon name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

/** Big bold number, e.g. a score or price. */
export function BigNumber({ value, size = 56, color = colors.text }: { value: string | number; size?: number; color?: string }) {
  return (
    <Text style={[type.number, { fontSize: size, lineHeight: size * 1.1, color, letterSpacing: -size / 28 }]} accessibilityLabel={String(value)}>
      {value}
    </Text>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.inverse }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Empty({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={28} color={colors.muted} />
      <Text style={[type.small, { textAlign: 'center' }]}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="small" color={colors.muted} />
    </View>
  );
}

/** Purple square with a white house-and-tick symbol (same as the app icon). The only big bit of colour. */
export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={require('../../assets/logo.png')} style={{ width: size, height: size }} accessibilityLabel="Choreboard" />;
}

/** Yes/no question that works on phones and in a web browser. */
export function confirm(title: string, message: string, okLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  screenInner: { paddingHorizontal: 16, paddingTop: space.md, gap: 12, paddingBottom: 160 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: space.md, gap: space.sm },
  button: {
    borderRadius: 999, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius,
    paddingVertical: 16, paddingHorizontal: space.md, backgroundColor: colors.card,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.text },
  group: { backgroundColor: colors.card, borderRadius: radius, overflow: 'hidden' },
  groupLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: space.md },
  listTitle: { fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  input: {
    backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
    borderColor: colors.line, backgroundColor: 'transparent',
  },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  error: { color: colors.danger, fontSize: 14 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
});
