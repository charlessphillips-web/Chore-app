export const PRESET_CHORES = [
  'Bins',
  'Cleaning kitchen surfaces',
  'Hoovering',
  'Tidying sitting room',
  'Cleaning sink',
  'Emptying dishwasher',
  'Taking big bins out on bin days',
  'Cleaning microwave',
  'Cleaning oven',
  'Cleaning stove',
] as const;

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
