/**
 * A chore's picture: a clear icon of the actual thing (hoover, tap, oven…)
 * in its own colour on a soft square. Custom chores get a guess from their
 * name and a colour of their own.
 */
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BATHROOM_TASKS } from '../lib/chores';
import { isLight } from './theme';

type MdiName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Hue = 'orange' | 'teal' | 'blue' | 'pink' | 'sky' | 'purple' | 'coral' | 'gold' | 'red' | 'green';

const HUES: Record<Hue, { dark: string; light: string }> = {
  orange: { dark: '#F5A524', light: '#C36A00' },
  teal: { dark: '#3DD6B0', light: '#0E9A76' },
  blue: { dark: '#5B9BFF', light: '#2F6FEB' },
  pink: { dark: '#FF7AB6', light: '#D63F80' },
  sky: { dark: '#4FC3F7', light: '#0B84C6' },
  purple: { dark: '#9381F2', light: '#6E58E6' },
  coral: { dark: '#FF7A59', light: '#E0552F' },
  gold: { dark: '#F5C542', light: '#B7860B' },
  red: { dark: '#FF5C5C', light: '#D63434' },
  green: { dark: '#7BD84F', light: '#3E8E1A' },
};

const KNOWN: Record<string, [MdiName, Hue]> = {
  bins: ['trash-can-outline', 'orange'],
  'taking big bins out on bin days': ['trash-can', 'green'],
  'cleaning kitchen surfaces': ['spray-bottle', 'teal'],
  hoovering: ['vacuum-outline', 'blue'],
  'tidying sitting room': ['sofa-outline', 'pink'],
  'cleaning sink': ['faucet', 'sky'],
  'emptying dishwasher': ['dishwasher', 'purple'],
  'cleaning microwave': ['microwave', 'coral'],
  'cleaning oven': ['stove', 'gold'],
  'cleaning stove': ['pot-steam-outline', 'red'],
  bathroom: ['bathtub-outline', 'sky'],
};

const BATHROOM: Record<string, [MdiName, Hue]> = {
  toilet: ['toilet', 'sky'], shower: ['shower-head', 'blue'], sink: ['mirror', 'teal'], whole: ['bathtub-outline', 'purple'],
};

const GUESSES: [RegExp, MdiName][] = [
  [/toilet|\bloo\b/, 'toilet'], [/shower/, 'shower-head'], [/bath/, 'bathtub-outline'], [/laundry|washing|clothes/, 'washing-machine'],
  [/dry/, 'tumble-dryer'], [/fridge|freezer/, 'fridge-outline'], [/window/, 'window-closed-variant'], [/garden|lawn|plant/, 'flower-outline'],
  [/recycl/, 'recycle'], [/shop|groceries|milk/, 'cart-outline'], [/loo roll|toilet roll/, 'paper-roll-outline'], [/cook|dinner|meal/, 'pot-steam-outline'],
  [/iron/, 'iron-outline'], [/stairs/, 'stairs'], [/bed|sheet/, 'bed-outline'], [/bin/, 'trash-can-outline'], [/dish|plate|wash ?up/, 'silverware-clean'],
  [/hoover|vacuum/, 'vacuum-outline'], [/mop|floor|sweep/, 'broom'], [/sink|tap/, 'faucet'], [/surface|wipe|spray/, 'spray-bottle'],
];
const ORDER: Hue[] = ['teal', 'blue', 'pink', 'coral', 'gold', 'purple', 'sky', 'green', 'orange', 'red'];

/** The icon and colour for a chore key (pure, for tests). */
export function choreLook(key: string): { icon: MdiName; hue: Hue } {
  if (KNOWN[key]) return { icon: KNOWN[key][0], hue: KNOWN[key][1] };
  const task = BATHROOM_TASKS.find((t) => key.endsWith(` ${t.key}`));
  if (task) return { icon: BATHROOM[task.key][0], hue: BATHROOM[task.key][1] };
  const icon = GUESSES.find(([re]) => re.test(key))?.[1] ?? 'broom';
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { icon, hue: ORDER[h % ORDER.length] };
}

export function ChoreIcon({ choreKey, size = 38 }: { choreKey: string; size?: number }) {
  const { icon, hue } = choreLook(choreKey);
  const c = isLight ? HUES[hue].light : HUES[hue].dark;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.29, alignItems: 'center', justifyContent: 'center', backgroundColor: `${c}2E` }}>
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.58)} color={c} />
    </View>
  );
}
