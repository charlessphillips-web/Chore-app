/** The website can't watch location in the background, so this is app-only. */
export const AWAY_UNTIL_KEY = 'rotawise.awayUntil';
export const homeAwaySupported = false;
export async function isHomeAwayOn(): Promise<boolean> { return false; }
export async function turnOnHomeAway(): Promise<string | null> { return 'This only works in the iPhone or Android app.'; }
export async function turnOffHomeAway(): Promise<void> {}
