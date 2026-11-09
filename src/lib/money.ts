/**
 * Prices for chore offers, in pence, and payment links (Monzo / PayPal).
 * The app never holds money: it records the deal, and people pay each
 * other with their own bank app.
 */
export const MIN_PRICE = 50; // £0.50
export const MAX_PRICE = 5000; // £50

/** "3", "£3.50", "3.5" -> pence, or null if it isn't a sensible price. */
export function parsePrice(text: string): number | null {
  const t = text.trim().replace(/^£/, '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const pence = Math.round(Number(t) * 100);
  return pence >= MIN_PRICE && pence <= MAX_PRICE ? pence : null;
}

export function priceError(text: string): string | null {
  if (!text.trim()) return 'Enter a price.';
  return parsePrice(text) === null ? 'Enter a price between £0.50 and £50, e.g. 3 or 3.50.' : null;
}

/** 300 -> "£3", 350 -> "£3.50" */
export function formatPrice(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

const LINK = /^(?:https?:\/\/)?(?:www\.)?(monzo\.me|paypal\.me)\/([A-Za-z0-9._-]{1,40})\/?$/i;

/**
 * "monzo.me/charlie" -> "https://monzo.me/charlie". Returns null for an
 * empty box, or an error object if it isn't a Monzo or PayPal link.
 */
export function normalisePayLink(text: string): string | null | { error: string } {
  const t = text.trim();
  if (!t) return null;
  const m = LINK.exec(t);
  if (!m) return { error: 'Use your monzo.me or paypal.me link, e.g. monzo.me/yourname' };
  return `https://${m[1].toLowerCase()}/${m[2]}`;
}

/** Link that opens the payer's app with the amount filled in. */
export function payUrl(link: string, pence: number, note: string): string {
  const amount = (pence / 100).toFixed(2);
  if (link.startsWith('https://paypal.me/')) return `${link}/${amount}GBP`;
  return `${link}/${amount}?d=${encodeURIComponent(note.slice(0, 40))}`;
}

/** How someone wants to be paid for one deal. */
export type PayMethod = 'monzo' | 'paypal' | 'cash';
export interface PayChoice {
  method: PayMethod;
  /** https://monzo.me/… or https://paypal.me/… (not for cash). */
  link: string | null;
}

export const PAY_LABELS: Record<PayMethod, string> = { monzo: 'Monzo', paypal: 'PayPal', cash: 'Cash' };

/** Checks a pay choice; returns the cleaned-up choice or an error message. */
export function checkPayChoice(method: PayMethod, linkText: string): PayChoice | { error: string } {
  if (method === 'cash') return { method, link: null };
  const n = normalisePayLink(linkText);
  if (!n) return { error: `Add your ${PAY_LABELS[method]} link, e.g. ${method === 'monzo' ? 'monzo.me' : 'paypal.me'}/yourname` };
  if (typeof n === 'object') return n;
  if (!n.startsWith(`https://${method === 'monzo' ? 'monzo' : 'paypal'}.me/`)) {
    return { error: `That's not a ${PAY_LABELS[method]} link.` };
  }
  return { method, link: n };
}
