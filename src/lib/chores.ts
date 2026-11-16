/**
 * A house's chore list. The admin can switch chores on/off and add new ones.
 * `needs` is the wording for "this needs doing", e.g. "Bins are full".
 */
export interface HouseChore {
  key: string;
  name: string;
  needs: string;
  active: boolean;
  /** How big a job it is: 1 Quick, 2 Medium, 3 Big. Worth that many points. */
  size?: ChoreSize;
  /** Bathroom (or other area) it belongs to, e.g. "Top floor bathroom". Shown as one tile on Home. */
  group?: string;
  /** Only these people get asked to do it (e.g. who uses that bathroom). Empty/missing = everyone. */
  users?: string[];
}

export type ChoreSize = 1 | 2 | 3;
export const SIZE_NAMES: Record<ChoreSize, string> = { 1: 'Quick', 2: 'Medium', 3: 'Big' };

/** Default sizes for the built-in chores; anything else is Medium. */
const DEFAULT_SIZES: Record<string, ChoreSize> = {
  bins: 1, 'emptying dishwasher': 1, 'tidying sitting room': 1,
  'cleaning kitchen surfaces': 2, hoovering: 2, 'cleaning sink': 2, 'cleaning microwave': 2, 'taking big bins out on bin days': 2,
  'cleaning oven': 3, 'cleaning stove': 3,
};

/** Points a chore is worth (its size). */
export function choreSize(c: { key: string; size?: number } | undefined | null): ChoreSize {
  if (c?.size === 1 || c?.size === 2 || c?.size === 3) return c.size;
  return (c && DEFAULT_SIZES[c.key]) || 2;
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

export function makeChore(name: string, needs?: string, size?: ChoreSize): HouseChore {
  const clean = cleanChoreName(name);
  const key = choreKey(clean);
  return {
    key,
    name: clean,
    needs: cleanChoreName(needs ?? '') || `${clean} needs doing`,
    active: true,
    size: size ?? DEFAULT_SIZES[key] ?? 2,
  };
}

/** Adds a chore unless one with the same key already exists. Returns an error message or the new list. */
export function addChore(list: HouseChore[], name: string, needs: string, size?: ChoreSize): HouseChore[] | string {
  const c = makeChore(name, needs, size);
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
  if (ICONS[key]) return ICONS[key];
  const task = BATHROOM_TASKS.find((t) => key.endsWith(` ${t.key}`));
  return task?.icon ?? 'checkmark-circle-outline';
}

// ---------- Bathrooms ----------
// Each bathroom is a group of small chores. Only the people who use it get
// asked. "Whole bathroom" is worth the same as doing all three bits.

export const BATHROOM_TASKS: { key: string; name: string; needs: string; size: ChoreSize; icon: string }[] = [
  { key: 'toilet', name: 'Toilet', needs: 'toilet needs cleaning', size: 1, icon: 'water-outline' },
  { key: 'shower', name: 'Shower / bath', needs: 'shower needs cleaning', size: 1, icon: 'rainy-outline' },
  { key: 'sink', name: 'Sink & mirror', needs: 'sink needs cleaning', size: 1, icon: 'sparkles-outline' },
  { key: 'whole', name: 'Whole bathroom', needs: 'needs a full clean', size: 3, icon: 'home-outline' },
];

/** "Top floor" → "Top floor bathroom" (left alone if it already says bathroom, en-suite, loo...). */
export function bathroomName(input: string): string {
  const clean = cleanChoreName(input);
  if (!clean) return '';
  return /\b(bath\w*|en-?suite|loo|toilet|shower|wc)\b/i.test(clean) ? clean : `${clean} bathroom`;
}

/** The chores for one bathroom. */
export function makeBathroom(name: string, users: string[]): HouseChore[] {
  const group = bathroomName(name);
  return BATHROOM_TASKS.map((t) => ({
    ...makeChore(`${group} ${t.key}`, `${group}: ${t.needs}`, t.size),
    name: `${group}: ${t.name}`,
    group,
    users,
  }));
}

/** Adds a bathroom unless the name is taken. Returns an error or the new list. */
export function addBathroom(list: HouseChore[], name: string, users: string[]): HouseChore[] | string {
  const group = bathroomName(name);
  if (choreKey(group).length < 2) return 'Give the bathroom a name, e.g. "Top floor".';
  if (bathroomGroups(list).some((g) => choreKey(g) === choreKey(group))) return 'There’s already a bathroom with that name.';
  const extra = makeBathroom(group, users);
  if (extra.some((c) => list.some((x) => x.key === c.key))) return 'There’s already a chore with that name.';
  return [...list, ...extra];
}

/** Bathroom names, in the order they were added. */
export function bathroomGroups(list: HouseChore[]): string[] {
  return [...new Set(list.filter((c) => c.group).map((c) => c.group!))];
}

export function setBathroomUsers(list: HouseChore[], group: string, users: string[]): HouseChore[] {
  return list.map((c) => (c.group === group ? { ...c, users } : c));
}

export function removeBathroom(list: HouseChore[], group: string): HouseChore[] {
  return list.filter((c) => c.group !== group);
}

/** "Top floor bathroom: Toilet" → "Toilet". */
export function taskName(c: HouseChore): string {
  return c.group && c.name.startsWith(`${c.group}: `) ? c.name.slice(c.group.length + 2) : c.name;
}
