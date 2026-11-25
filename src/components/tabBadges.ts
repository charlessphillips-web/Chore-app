/** Numbers on the tab bar (shared by the phone and website tab bars). */
import { useApp } from '../context/AppContext';
import { needsCheckBy } from '../lib/review';
import { PRIVACY_VERSION } from '../lib/legal';

export function useTabsState() {
  const { ready, profile, logs, user, offers } = useApp();
  // Not in a house yet, or hasn't agreed to the current privacy policy: send them back.
  const redirect = ready && !profile?.houseId ? '/' as const
    : profile && profile.privacyVersion !== PRIVACY_VERSION ? '/consent' as const : null;
  const toCheck = user ? logs.filter((l) => needsCheckBy(l, user.uid)).length : 0;
  // Pay things waiting on you: counter offers to answer, someone to pay, a chore you agreed to do.
  const payToDo = user
    ? offers.filter(
        (o) =>
          (o.fromUid === user.uid && o.status === 'open' && Object.keys(o.counters).some((u) => !o.declined.includes(u))) ||
          (o.fromUid === user.uid && o.status === 'done') ||
          (o.doerUid === user.uid && o.status === 'agreed'),
      ).length
    : 0;
  return { redirect, toCheck, payToDo };
}
