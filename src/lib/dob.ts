/** Date of birth is stored as "YYYY-MM-DD" (no time zone surprises). */
export const MIN_AGE = 13;

export function toDobString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDob(dob: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Reject things like 2001-02-31 that JS would roll over.
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

export function ageOn(dob: string, today: Date = new Date()): number | null {
  const d = parseDob(dob);
  if (!d) return null;
  let age = today.getFullYear() - d.getFullYear();
  const hadBirthday =
    today.getMonth() > d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() >= d.getDate());
  if (!hadBirthday) age--;
  return age;
}

/** Returns an error message, or null if the date of birth is OK. */
export function dobError(dob: string, today: Date = new Date()): string | null {
  const age = ageOn(dob, today);
  if (age === null) return 'Enter your date of birth.';
  if (age < MIN_AGE) return `You need to be ${MIN_AGE} or over to use Choreboard.`;
  if (age > 120) return 'Check your date of birth.';
  return null;
}

/** "2004-03-07" -> "7 March 2004" */
export function formatDob(dob: string): string {
  const d = parseDob(dob);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}
