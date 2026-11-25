import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import type { FirestoreError } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import {
  CHECK_REMINDER_MS, clearFullPhoto, clearRemovedHouse, sendCheckReminder, setPushToken, toMember, touchLastSeen, watchHouse, watchMembers, watchOpenRequests, watchProfile,
  watchOffers, watchRecentLogs, watchWallpaper, type MemberDoc, watchStakes,
} from '../lib/db';
import { periodEnd, periodKey, periodStart, previousPeriodKey } from '../lib/period';
import { isAway, presentWeight } from '../lib/away';
import { AWAY_UNTIL_KEY } from '../lib/homeAway';
import type { Stake } from '../lib/stakes';
import { scheduleReminders } from '../lib/reminders';
import { track } from '../lib/analytics';
import { getNotificationStatus, registerForPushNotifications, type NotificationStatus } from '../lib/notifications';
import { jpegUri } from '../lib/photos';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyYouColor, YOU_COLORS } from '../components/theme';
import type { ChoreLog, ChoreOffer, ChoreRequest, House, Member, UserProfile } from '../lib/types';

interface AppState {
  ready: boolean;
  error: string | null;
  /** A one-off message, e.g. "You were removed from the house". */
  notice: string | null;
  clearNotice: () => void;
  user: User | null;
  profile: UserProfile | null;
  house: House | null;
  isAdmin: boolean;
  members: Member[];
  openRequests: ChoreRequest[];
  logs: ChoreLog[];
  /** Chore offers still in progress. */
  offers: ChoreOffer[];
  /** House wallpaper as a data URI, if the admin set one. */
  wallpaper: string | null;
  /** House stakes suggestions for this period and the last one. */
  stakes: Stake[];
  /** Everyone's scores in another period (e.g. the last one). */
  membersIn: (period: string) => Member[];
  /** Whether this phone has notifications on. */
  notifStatus: NotificationStatus | null;
  /** Shows the phone's "allow notifications" pop-up and saves the token. */
  enableNotifications: () => Promise<NotificationStatus>;
  /** Your "you" colour (Settings → Your colour). Saved on this phone. */
  youColor: string;
  setYouColor: (hex: string) => void;
}

const AppContext = createContext<AppState | null>(null);
/** One shared empty list, so "nothing yet" doesn't count as a change on every render. */
const EMPTY: never[] = [];

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside <AppProvider>');
  return ctx;
}

/** Data tagged with the house it belongs to, so stale data is never shown after switching. */
interface HouseData {
  houseId: string;
  house: House | null;
  members: MemberDoc[];
  openRequests: ChoreRequest[];
  logs: ChoreLog[];
  offers: ChoreOffer[];
  wallpaper: string | null;
}

const MAX_RETRIES = 5;

const YOU_KEY = 'rotawise.youColor';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // "You" colour: load the saved one, and re-render everything when it changes.
  // Stored and passed around as the colour's id (its Dark-mode hex); colors.you is the shade in use.
  const [youColor, setYouState] = useState<string>(YOU_COLORS[0].hex);
  useEffect(() => {
    AsyncStorage.getItem(YOU_KEY).then((v) => {
      if (v && YOU_COLORS.some((c) => c.hex === v)) { applyYouColor(v); setYouState(v); }
    }).catch(() => {});
  }, []);
  const setYouColor = useCallback((hex: string) => {
    applyYouColor(hex);
    setYouState(hex);
    AsyncStorage.setItem(YOU_KEY, hex).catch(() => {});
  }, []);
  // The profile, tagged with whose it is (undefined = not loaded yet).
  const [profileState, setProfileState] = useState<{ uid: string; profile: UserProfile | null }>();
  const [houseData, setHouseData] = useState<HouseData | null>(null);
  // Retry counter for loading house data, tagged with the house.
  const [retry, setRetry] = useState<{ houseId: string; n: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [error, setError] = useState<string | null>(
    isFirebaseConfigured ? null : 'Firebase is not configured. Copy .env.example to .env.local and fill it in.',
  );

  // 1. Sign in silently. Each phone gets an anonymous account, kept between launches.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) signInAnonymously(auth).catch((e) => setError(`Sign-in failed: ${e.message}`));
    });
  }, []);

  // 2. Their profile (demographics + which house they're in).
  useEffect(() => {
    if (!user) return;
    return watchProfile(user.uid, (profile) => setProfileState({ uid: user.uid, profile }));
  }, [user]);

  const profileReady = !!user && profileState?.uid === user.uid;
  const profile = profileReady ? profileState!.profile : null;
  const houseId = profile?.houseId ?? null;
  const attempt = retry && retry.houseId === houseId ? retry.n : 0;
  const uid = user?.uid ?? null;

  // 3. Everything about their house, live.
  useEffect(() => {
    if (!houseId || !uid) return;
    const update = (patch: Partial<HouseData>) =>
      setHouseData((prev) => ({
        ...(prev?.houseId === houseId
          ? prev
          : { houseId, house: null, members: [], openRequests: [], logs: [], offers: [], wallpaper: null }),
        ...patch,
      }));
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failed = false;
    const onError = (e: FirestoreError) => {
      if (failed) return;
      failed = true;
      if (e.code !== 'permission-denied') {
        setError(`Couldn't load your house: ${e.message}`);
      } else if (attempt < MAX_RETRIES) {
        // Straight after joining, the server can briefly refuse reads until
        // it sees our membership. Retry a few times before giving up.
        retryTimer = setTimeout(() => setRetry({ houseId, n: attempt + 1 }), 500 * (attempt + 1));
      } else {
        // Still refused: the admin removed us from this house.
        setNotice('You were removed from your house by its admin. You can join another house with a code.');
        clearRemovedHouse(uid).catch((err) => setError(err.message));
      }
    };
    const unsubs = [
      watchHouse(houseId, (house) => update({ house }), onError),
      watchMembers(houseId, (members) => update({ members }), onError),
      watchOpenRequests(houseId, (openRequests) => update({ openRequests }), onError),
      watchRecentLogs(houseId, (logs) => update({ logs }), onError),
      watchOffers(houseId, (offers) => update({ offers }), onError),
      watchWallpaper(houseId, (w) => update({ wallpaper: w ? jpegUri(w) : null }), onError),
    ];
    return () => {
      clearTimeout(retryTimer);
      unsubs.forEach((u) => u());
    };
  }, [houseId, uid, attempt]);

  // 3a. Count app opens (anonymous).
  useEffect(() => {
    if (uid) track('app_open');
  }, [uid]);

  // 3b. Once per app open: mark yourself active (for the owner's dashboard).
  useEffect(() => {
    if (!houseId || !uid) return;
    const t = setTimeout(() => touchLastSeen(houseId, uid).catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, [houseId, uid]);

  // 4. Once in a house: if notifications are allowed, save this phone's
  // token. (If not, Home explains why and asks — see NotificationCard.)
  // Checked again whenever the app comes back to the front, e.g. after the
  // user turned notifications on in their phone's Settings.
  useEffect(() => {
    if (!houseId || !uid) return;
    let cancelled = false;
    const check = () =>
      getNotificationStatus().then((status) => {
        if (cancelled) return;
        setNotifStatus(status);
        if (status === 'granted') {
          registerForPushNotifications({ ask: false }).then((token) => {
            if (!cancelled && token) setPushToken(houseId, uid, token).catch(() => {});
          });
        }
      });
    check();
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [houseId, uid]);

  const enableNotifications = useCallback(async (): Promise<NotificationStatus> => {
    const token = await registerForPushNotifications({ ask: true });
    if (token && houseId && uid) await setPushToken(houseId, uid, token).catch(() => {});
    const status = await getNotificationStatus();
    setNotifStatus(status);
    return status;
  }, [houseId, uid]);

  const current = houseData && houseData.houseId === houseId ? houseData : null;
  const house = current?.house ?? null;

  // 3b. House stakes for this period and the last one (only if switched on).
  const stakePeriods = house?.stakes ? [periodKey(new Date(), house.reset), previousPeriodKey(new Date(), house.reset)].join(',') : '';
  const [stakesData, setStakesData] = useState<{ key: string; stakes: Stake[] } | null>(null);
  useEffect(() => {
    if (!stakePeriods || !houseId) return;
    const key = `${houseId}|${stakePeriods}`;
    return watchStakes(houseId, stakePeriods.split(','), (stakes) => setStakesData({ key, stakes }), () => {});
  }, [houseId, stakePeriods]);
  const stakes = stakesData && stakesData.key === `${houseId}|${stakePeriods}` ? stakesData.stakes : (EMPTY as Stake[]);

  // 4b. Chores logged 12+ hours ago that still need checks: remind the people
  // who haven't checked (once per chore, whichever phone gets there first).
  const remindIds = (current?.logs ?? [])
    .filter((l) => l.status === 'pending' && !l.checkReminderSent && l.checks.length < l.checksNeeded)
    .filter((l) => { const age = new Date().getTime() - l.at; return age > CHECK_REMINDER_MS && age < 24 * 3_600_000; })
    .map((l) => l.id)
    .join(',');
  useEffect(() => {
    if (!remindIds || !houseId || !current) return;
    for (const id of remindIds.split(',')) {
      const log = current.logs.find((l) => l.id === id);
      if (log) sendCheckReminder(houseId, log).catch(() => {});
    }
    // Only re-run when the set of chores needing a reminder changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindIds]);

  // 4c. Checked (or 24h-old) chores: delete the full photo, keep the thumbnail.
  const clearIds = (current?.logs ?? [])
    .filter((l) => !l.photoDeleted && (l.status !== 'pending' || new Date().getTime() - l.at > 24 * 3_600_000))
    .map((l) => l.id)
    .join(',');
  useEffect(() => {
    if (!clearIds || !houseId) return;
    for (const id of clearIds.split(',')) clearFullPhoto(houseId, id).catch(() => {});
  }, [clearIds, houseId]);

  // 5. Phone reminders (bin night, leaderboard reset, Sunday summary), redone whenever they change.
  const myPrefs = current?.members.find((m) => m.id === uid)?.data.notifPrefs;
  const reminderKey = house && notifStatus === 'granted'
    ? JSON.stringify([house.bins, myPrefs ?? {}, periodEnd(new Date(), house.reset).getTime()])
    : null;
  useEffect(() => {
    if (!reminderKey) return;
    const [bins, prefs, end] = JSON.parse(reminderKey);
    scheduleReminders({ bins, prefs, periodEnd: new Date(end) }).catch(() => {});
  }, [reminderKey]);
  // Scores for the current period, using the house's reset setting.
  const period = periodKey(new Date(), house?.reset);
  // Away days shrink your fair share for this period; away now = not asked to do chores.
  // Recalculated at most once a minute (and whenever the data changes), so screens don't redraw for nothing.
  const minute = Math.floor(new Date().getTime() / 60_000);
  const reset = house?.reset;
  const resetKey = JSON.stringify(reset ?? null);
  const myAways = (current?.members ?? []).find((m) => m.id === uid)?.data.aways;
  const awayUntilNote = JSON.stringify(myAways ?? []);
  useEffect(() => {
    const trips = JSON.parse(awayUntilNote) as { from: number; until: number }[];
    const t = Date.now();
    const on = trips.find((a) => a.from <= t && t < a.until);
    AsyncStorage.setItem(AWAY_UNTIL_KEY, String(on?.until ?? 0)).catch(() => {});
  }, [awayUntilNote]);
  const rawMembers = current?.members;
  const members: Member[] = useMemo(() => {
    const nowMs = Math.max(minute * 60_000, new Date().getTime());
    const r = JSON.parse(resetKey) as typeof reset;
    const pStart = periodStart(new Date(nowMs), r ?? undefined).getTime();
    const pEnd = periodEnd(new Date(nowMs), r ?? undefined).getTime();
    return (rawMembers ?? []).map((m) => {
      const x = toMember(m.id, m.data, period);
      return { ...x, weight: presentWeight(x.aways, pStart, pEnd), away: isAway(x.aways, nowMs) };
    });
  }, [rawMembers, period, minute, resetKey]);
  const membersIn = useCallback((p: string) => (rawMembers ?? []).map((m) => toMember(m.id, m.data, p)), [rawMembers]);
  const clearNotice = useCallback(() => setNotice(null), []);
  const value: AppState = useMemo(() => ({
    ready: profileReady,
    error,
    notice,
    clearNotice,
    user,
    profile,
    house,
    isAdmin: !!house && !!uid && house.adminUid === uid,
    members,
    openRequests: current?.openRequests ?? EMPTY,
    logs: current?.logs ?? EMPTY,
    offers: current?.offers ?? EMPTY,
    wallpaper: current?.wallpaper ?? null,
    stakes,
    membersIn,
    notifStatus,
    enableNotifications,
    youColor,
    setYouColor,
  }), [profileReady, error, notice, clearNotice, user, profile, house, uid, members, current, stakes, membersIn, notifStatus, enableNotifications, youColor, setYouColor]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
