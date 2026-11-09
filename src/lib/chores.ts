/**
 * A house's chore list. The admin can switch chores on/off and add new ones.
 * `needs` is the wording for "this needs doing", e.g. "Bins are full".
 */
export interface HouseChore {
  key: string;
  name: string;
  needs: string;
  active: boolean;
}

const DEFAULTS: [string, string][] = [
  ['Bins', 'Bins are full'],
  ['Cleaning kitchen surfaces', 'Kitchen surfaces need cleaning'],
  ['Hoovering', 'Needs hoovering'],
  ['Tidying sitting room', 'Sitting room needs tidying'],
  ['Cleaning sink', 'Sink needs cleaning'],
  ['Emptying dishwasher', 'Dishwasher needs emptying'],
  ['Taking big bins out on bin days', 'Big bins need taking out'],
  ['Cleaning microwave', 'Microwave needs cleaning'],
  ['Cleaning oven', 'Oven needs cleaning'],
  ['Cleaning stove', 'Stove needs cleaning'],
];

export const DEFAULT_CHORES: HouseChore[] = DEFAULTS.map(([name, needs]) => makeChore(name, needs));

/**
 * "  Take OUT bins! " -> "take out bins". Used to count the same chore
 * together, and safe to use as a Firestore field name (no dots etc).
 */
export function choreKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanChoreName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function makeChore(name: string, needs?: string): HouseChore {
  const clean = cleanChoreName(name);
  return {
    key: choreKey(clean),
    name: clean,
    needs: cleanChoreName(needs ?? '') || `${clean} needs doing`,
    active: true,
  };
}

/** Adds a chore unless one with the same key already exists. Returns an error message or the new list. */
export function addChore(list: HouseChore[], name: string, needs: string): HouseChore[] | string {
  const c = makeChore(name, needs);
  if (c.key.length < 2) return 'Give the chore a name.';
  if (list.some((x) => x.key === c.key)) return 'That chore is already on the list.';
  return [...list, c];
}

/** Ionicons name for a chore's tile. Chores the admin adds get a tick. */
const ICONS: Record<string, string> = {
  bins: 'trash-outline',
  'cleaning kitchen surfaces': 'sparkles-outline',
  hoovering: 'grid-outline',
  'tidying sitting room': 'tv-outline',
  'cleaning sink': 'water-outline',
  'emptying dishwasher': 'restaurant-outline',
  'taking big bins out on bin days': 'trash-bin-outline',
  'cleaning microwave': 'cube-outline',
  'cleaning oven': 'flame-outline',
  'cleaning stove': 'bonfire-outline',
};

export function choreIcon(key: string): string {
  return ICONS[key] ?? 'checkmark-circle-outline';
}
