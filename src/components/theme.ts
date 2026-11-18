/**
 * Rotawise look ("Graphite"): black background, soft grey cards and
 * tiles, white text and icons. Purple means "you": your bar, your name,
 * your celebrations. Everyone else is white. Small labels use a mono font;
 * numbers are big and bold.
 */
export const colors = {
  bg: '#000000',
  card: '#121212',
  cardRaised: '#1C1C1C',
  border: '#1F1F1F',
  /** Hairlines between list rows and around inputs. */
  line: '#2A2A2A',
  text: '#F2F2F2',
  muted: '#8E8E8E',
  faint: '#545454',
  /** Text on white buttons. */
  inverse: '#000000',
  /** White: filled buttons, selected chips, icons. */
  primary: '#F2F2F2',
  primaryBright: '#F2F2F2',
  outline: '#2A2A2A',
  primaryText: '#000000',
  /** "You" (your bar, your name, your confetti). Purple unless you pick another in Settings → Your colour. */
  you: '#9381F2',
  /** Rotawise purple for house-wide things (stakes card). Never changes. */
  brand: '#9381F2',
  success: '#4ADE80',
  danger: '#FF4D4D',
  warning: '#F5A524',
};

/** Colours you can pick for "you" (Settings → Your colour). */
export const YOU_COLORS = [
  { name: 'Purple', hex: '#9381F2' },
  { name: 'Blue', hex: '#5B9BFF' },
  { name: 'Green', hex: '#3DD6B0' },
  { name: 'Orange', hex: '#F5A524' },
  { name: 'Pink', hex: '#FF7AB6' },
  { name: 'Red', hex: '#FF5C5C' },
] as const;

/** Set the "you" colour (AppContext calls this, then re-renders everything). */
export function applyYouColor(hex: string) {
  if (YOU_COLORS.some((c) => c.hex === hex)) colors.you = hex as typeof colors.you;
}

/** Mix a colour with white (amount 0–1), e.g. for lighter confetti. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Mix a colour with black (amount 0–1), e.g. for a dark selected chip. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - amount)).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Font names (loaded in app/_layout.tsx). */
export const fonts = {
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = 14;

export const type = {
  title: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: -1 },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 11, fontFamily: fonts.mono, color: colors.muted, textTransform: 'uppercase' as const, letterSpacing: 1.2 },
  /** Big bold numbers (scores, prices). */
  number: { fontWeight: '700' as const, color: colors.text, letterSpacing: -2 },
};

/** Header style for stack screens. */
export const darkHeader = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};
