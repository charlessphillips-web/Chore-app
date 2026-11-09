/**
 * Choreboard look ("Graphite"): black background, soft grey cards and
 * tiles, white text and icons. Purple is only in the logo (and a tiny dot
 * marking "you"). Small labels use a mono font; numbers are big and bold.
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
  /** The only purple outside the logo: marks "you". */
  you: '#9381F2',
  success: '#4ADE80',
  danger: '#FF4D4D',
  warning: '#F5A524',
};

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
