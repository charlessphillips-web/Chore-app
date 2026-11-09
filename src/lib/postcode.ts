/**
 * UK postcode → area, using postcodes.io (free, no key). We only keep the
 * area (e.g. "LS6 · Leeds"), never the full postcode or address, so
 * students' home addresses aren't stored.
 */
export interface HouseArea {
  /** First half of the postcode, e.g. "LS6". */
  outcode: string;
  /** Council area / town, e.g. "Leeds". */
  district: string;
  /** e.g. "Yorkshire and The Humber", or "Scotland" / "Wales". */
  region: string;
  country: string;
}

/** " ls61ab " -> "LS6 1AB" */
export function normalisePostcode(text: string): string {
  const t = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return t.length > 3 ? `${t.slice(0, -3)} ${t.slice(-3)}` : t;
}

const UK = /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$/;
export const isValidPostcode = (text: string) => UK.test(normalisePostcode(text));

export function areaLabel(a: HouseArea): string {
  return `${a.outcode} · ${a.district}`;
}

/** Looks a postcode up. null = not a real postcode. Throws if the service can't be reached. */
export async function lookupPostcode(text: string): Promise<HouseArea | null> {
  const pc = normalisePostcode(text);
  if (!UK.test(pc)) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Postcode lookup is down right now.');
  const r = (await res.json()).result;
  return {
    outcode: r.outcode,
    district: r.admin_district ?? r.parliamentary_constituency ?? '',
    region: r.region ?? r.country ?? '',
    country: r.country ?? '',
  };
}
