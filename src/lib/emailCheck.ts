/**
 * Catch mistyped and throwaway emails at sign-up ("fabio@gmial.com" →
 * "Did you mean fabio@gmail.com?"). Pure (no imports) so it can be tested.
 */
const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com',
  'googlemail.co': 'googlemail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.co.uk', 'hotmail.co.u': 'hotmail.co.uk', 'hotmail.couk': 'hotmail.co.uk',
  'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com', 'outloo.com': 'outlook.com',
  'yahoo.co': 'yahoo.co.uk', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'icloud.co': 'icloud.com', 'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com', 'iclould.com': 'icloud.com',
  'live.co': 'live.co.uk', 'me.co': 'me.com',
};
const BAD_ENDINGS: [RegExp, string][] = [[/\.con$/, '.com'], [/\.cmo$/, '.com'], [/\.ocm$/, '.com'], [/\.comm$/, '.com'], [/\.ac\.u$/, '.ac.uk'], [/\.co\.u$/, '.co.uk']];
const THROWAWAY = ['mailinator.com', 'yopmail.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com', 'dispostable.com', 'getnada.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com'];

/** A tidy version: trimmed, lower case. */
export const cleanEmail = (email: string) => email.trim().toLowerCase();

/** Looks like an email at all (something@something.something, no spaces). */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

/** "fabio@gmial.com" → "fabio@gmail.com"; null if it looks fine. */
export function suggestEmail(email: string): string | null {
  const e = cleanEmail(email);
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (DOMAIN_FIXES[domain]) return `${local}@${DOMAIN_FIXES[domain]}`;
  for (const [re, fix] of BAD_ENDINGS) if (re.test(domain)) { domain = domain.replace(re, fix); return `${local}@${domain}`; }
  return null;
}

/** An error to show, or null if the email is OK to use. */
export function emailProblem(email: string): string | null {
  if (!looksLikeEmail(email)) return 'Enter a real email address, like name@gmail.com.';
  const domain = cleanEmail(email).split('@')[1];
  if (THROWAWAY.includes(domain)) return 'Please use your own email (not a temporary one), so you can always get back into your account.';
  return null;
}
