/** Kinds of notification, each of which people can switch off in Settings. */
export const NOTIFY_KINDS = {
  turn: { title: 'Your turn', desc: 'When something needs doing and it’s your turn' },
  nudge: { title: 'Nudges', desc: 'When a housemate nudges you to do your chore' },
  check: { title: 'Photos to check', desc: 'When a housemate logs a chore' },
  redo: { title: 'Sent back', desc: 'When a chore you did is sent back to redo' },
  offers: { title: 'Chore offers', desc: 'Offers, counter offers and accepted deals' },
  payments: { title: 'Payments', desc: 'When you’re paid, or reminded to pay' },
  bins: { title: 'Bin day', desc: '8pm the night before the bins go out' },
  reset: { title: 'Leaderboard reset', desc: 'The day before the leaderboard resets' },
  weekly: { title: 'Weekly summary', desc: 'Sunday evening: how your house did' },
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
export type NotifyPrefs = Partial<Record<NotifyKind, boolean>>;

/** Everything is on unless they've switched it off. */
export const wants = (prefs: NotifyPrefs | null | undefined, kind: NotifyKind) => prefs?.[kind] !== false;
