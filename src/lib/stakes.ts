/**
 * House stakes: an optional prize for whoever does the most this period and a
 * forfeit for whoever does the least. Anyone suggests, the whole house votes,
 * and the top-voted suggestion of each kind counts.
 */
export type StakeKind = 'prize' | 'forfeit';
export const STAKE_MAX = 80;

export interface Stake {
  id: string;
  kind: StakeKind;
  text: string;
  period: string;
  byUid: string;
  byName: string;
  votes: string[];
  createdAt: number;
}

/** The suggestion with the most votes (ties: the earliest). Null if nobody has voted. */
export function topStake(stakes: Stake[], kind: StakeKind, period: string): Stake | null {
  const list = stakes
    .filter((s) => s.kind === kind && s.period === period && s.votes.length > 0)
    .sort((a, b) => b.votes.length - a.votes.length || a.createdAt - b.createdAt);
  return list[0] ?? null;
}

/** Suggestions for a kind, most votes first. */
export function rankedStakes(stakes: Stake[], kind: StakeKind, period: string): Stake[] {
  return stakes
    .filter((s) => s.kind === kind && s.period === period)
    .sort((a, b) => b.votes.length - a.votes.length || a.createdAt - b.createdAt);
}

/** Who wins (most points) and who's bottom (fewest). Ties share it. Null if everyone's level. */
export function stakeResult(scores: { username: string; points: number }[]): { winners: string[]; losers: string[] } | null {
  if (scores.length < 2) return null;
  const max = Math.max(...scores.map((s) => s.points));
  const min = Math.min(...scores.map((s) => s.points));
  if (max === min) return null;
  return {
    winners: scores.filter((s) => s.points === max).map((s) => s.username),
    losers: scores.filter((s) => s.points === min).map((s) => s.username),
  };
}

/** "Sam", "Sam and Alex", "Sam, Alex and Jo". */
export function names(list: string[]): string {
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** What happened last period: who won/lost and the top-voted prize/forfeit. Null if no stakes were voted on. */
export function lastResult(stakes: Stake[], period: string, scores: { username: string; points: number }[]) {
  const prize = topStake(stakes, 'prize', period);
  const forfeit = topStake(stakes, 'forfeit', period);
  const result = stakeResult(scores);
  if (!result || (!prize && !forfeit)) return null;
  const parts = [
    prize && `${names(result.winners)} won: ${prize.text}`,
    forfeit && `${names(result.losers)} ${result.losers.length > 1 ? 'owe' : 'owes'} the forfeit: ${forfeit.text}`,
  ].filter(Boolean);
  return parts.join('. ') + '.';
}
