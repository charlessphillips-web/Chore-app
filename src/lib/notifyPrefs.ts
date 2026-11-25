/** Kinds of notification, each of which people can switch off in Settings. */
export const NOTIFY_KINDS = {
  turn: { title: 'Your turn', desc: 'When something needs doing and it’s your turn' },
  nudge: { title: 'Nudges', desc: 'When a housemate nudges you to do your chore' },
  check: { title: 'Photos to check', desc: 'When a housemate logs a chore' },
  redo: { title: 'Sent back', desc: 'When a chore you did is sent back to redo' },
  reactions: { title: 'Reactions', desc: 'When a housemate reacts 👏 to a chore you did' },
  offers: { title: 'Chore offers', desc: 'Offers, counter offers and accepted deals' },
  payments: { title: 'Payments', desc: 'When you’re paid, or reminded to pay' },
  bins: { title: 'Bin night', desc: '8pm, 10pm and 7am until someone takes them out' },
  reset: { title: 'Leaderboard reset', desc: 'The day before the leaderboard resets' },
  weekly: { title: 'Weekly summary', desc: 'Sunday 6pm: who topped the house' },
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
export type NotifyPrefs = Partial<Record<NotifyKind, boolean>>;

/** Everything is on unless they've switched it off. */
export const wants = (prefs: NotifyPrefs | null | undefined, kind: NotifyKind) => prefs?.[kind] !== false;
