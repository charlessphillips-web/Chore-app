/**
 * Profile pictures: a cropped photo, or a simple drawn character.
 * Stored on the member doc so housemates see it.
 */
export interface CharacterAvatar {
  kind: 'character';
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  extra: number;
  bg: number;
}
export interface PhotoAvatar {
  kind: 'photo';
  /** 256×256 JPEG, base64. */
  data: string;
}
export type Avatar = CharacterAvatar | PhotoAvatar;

export const SKINS = ['#F6D8C8', '#EBC09B', '#D29B6C', '#A86F45', '#7A4B2A', '#4B2D1A'];
export const HAIR_COLORS = ['#141414', '#3B2A20', '#7A4A23', '#C9A15B', '#D9D4CB', '#8A2E2E'];
export const BGS = ['#1C1C1C', '#3A3A3A', '#E8E8E8', '#9381F2', '#3D5A80', '#6B8F71'];
export const HAIRS = ['None', 'Short', 'Swept', 'Long', 'Bun', 'Curly', 'Buzz'];
export const EYES = ['Dots', 'Happy', 'Wide', 'Wink'];
export const MOUTHS = ['Smile', 'Neutral', 'Grin', 'Smirk'];
export const EXTRAS = ['None', 'Round glasses', 'Square glasses', 'Beanie'];

/** How many choices each part has (used by the rules too). */
export const LIMITS = {
  skin: SKINS.length, hair: HAIRS.length, hairColor: HAIR_COLORS.length,
  eyes: EYES.length, mouth: MOUTHS.length, extra: EXTRAS.length, bg: BGS.length,
};

export function randomCharacter(rand: () => number = Math.random): CharacterAvatar {
  const pick = (n: number) => Math.floor(rand() * n);
  return {
    kind: 'character',
    skin: pick(LIMITS.skin), hair: pick(LIMITS.hair), hairColor: pick(LIMITS.hairColor),
    eyes: pick(LIMITS.eyes), mouth: pick(LIMITS.mouth), extra: pick(LIMITS.extra), bg: pick(LIMITS.bg),
  };
}

/** Reads a stored avatar, ignoring anything malformed. */
export function toAvatar(v: unknown): Avatar | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (a.kind === 'photo' && typeof a.data === 'string') return { kind: 'photo', data: a.data };
  if (a.kind === 'character') {
    const ok = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).every(
      (k) => Number.isInteger(a[k]) && (a[k] as number) >= 0 && (a[k] as number) < LIMITS[k],
    );
    if (ok) return a as unknown as CharacterAvatar;
  }
  return null;
}

/** Dark backgrounds get light clothes and vice versa. */
export const isLightBg = (bg: number) => bg === 2;
