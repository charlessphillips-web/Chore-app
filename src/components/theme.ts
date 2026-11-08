/** Choreboard colours: black background, dark purple, white. */
export const colors = {
  bg: '#000000',
  card: '#111114',
  cardRaised: '#1A1A1F',
  border: '#26262D',
  text: '#FFFFFF',
  muted: '#9C9CA8',
  /** Dark purple: logo, filled buttons. */
  primary: '#4C1D95',
  /** Brighter purple: outlines and highlights (readable on black). */
  primaryBright: '#7C3AED',
  primaryText: '#FFFFFF',
  success: '#22C55E',
  danger: '#F04444',
  warning: '#F5A524',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = 12;

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
};

/** Header style for stack screens. */
export const darkHeader = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};
