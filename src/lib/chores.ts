export const PRESET_CHORES = [
  'Washing up',
  'Take out bins',
  'Recycling',
  'Hoover',
  'Clean kitchen',
  'Clean bathroom',
  'Mop floors',
  'Wipe surfaces',
  'Empty dishwasher',
  'Buy toilet roll',
  'Buy washing-up liquid',
  'Clean fridge',
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
