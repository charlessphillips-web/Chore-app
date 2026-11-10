import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import type { FirestoreError } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import {
  clearRemovedHouse, setPushToken, toMember, touchLastSeen, watchHouse, watchMembers, watchOpenRequests, watchProfile,
  watchOffers, watchRecentLogs, watchWallpaper, type MemberDoc,
} from '../lib/db';
import { periodEnd, periodKey } from '../lib/period';
import { scheduleReminders } from '../lib/reminders';
import { track } from '../lib/analytics';
import { getNotificationStatus, registerForPushNotifications, type NotificationStatus } from '../lib/notifications';
import { jpegUri } from '../lib/photos';
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
  /** Whether this phone has notifications on. */
  notifStatus: NotificationStatus | null;
  /** Shows the phone's "allow notifications" pop-up and saves the token. */
  enableNotifications: () => Promise<NotificationStatus>;
}

const AppContext = createContext<AppState | null>(null);

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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

  async function enableNotifications(): Promise<NotificationStatus> {
    const token = await registerForPushNotifications({ ask: true });
    if (token && houseId && uid) await setPushToken(houseId, uid, token).catch(() => {});
    const status = await getNotificationStatus();
    setNotifStatus(status);
    return status;
  }

  const current = houseData && houseData.houseId === houseId ? houseData : null;
  const house = current?.house ?? null;

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
  const members: Member[] = (current?.members ?? []).map((m) => toMember(m.id, m.data, period));
  const value: AppState = {
    ready: profileReady,
    error,
    notice,
    clearNotice: () => setNotice(null),
    user,
    profile,
    house,
    isAdmin: !!house && !!uid && house.adminUid === uid,
    members,
    openRequests: current?.openRequests ?? [],
    logs: current?.logs ?? [],
    offers: current?.offers ?? [],
    wallpaper: current?.wallpaper ?? null,
    notifStatus,
    enableNotifications,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
