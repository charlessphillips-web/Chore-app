import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import type { FirestoreError } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import {
  setPushToken, watchHouse, watchMembers, watchOpenRequests, watchProfile, watchRecentLogs,
} from '../lib/db';
import { registerForPushNotifications } from '../lib/notifications';
import type { ChoreLog, ChoreRequest, House, Member, UserProfile } from '../lib/types';

interface AppState {
  ready: boolean;
  error: string | null;
  user: User | null;
  profile: UserProfile | null;
  house: House | null;
  members: Member[];
  openRequests: ChoreRequest[];
  logs: ChoreLog[];
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
  members: Member[];
  openRequests: ChoreRequest[];
  logs: ChoreLog[];
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // The profile, tagged with whose it is (undefined = not loaded yet).
  const [profileState, setProfileState] = useState<{ uid: string; profile: UserProfile | null }>();
  const [houseData, setHouseData] = useState<HouseData | null>(null);
  // Retry counter for loading house data, tagged with the house.
  const [retry, setRetry] = useState<{ houseId: string; n: number } | null>(null);
  const [error, setError] = useState<string | null>(
    isFirebaseConfigured ? null : 'Firebase is not configured. Copy .env.example to .env.local and fill it in.',
  );

  // 1. Sign in silently. Each phone gets an anonymous account, kept between launches.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch((e) => setError(`Sign-in failed: ${e.message}`));
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

  // 3. Everything about their house, live.
  useEffect(() => {
    if (!houseId) return;
    const update = (patch: Partial<HouseData>) =>
      setHouseData((prev) => ({
        ...(prev?.houseId === houseId ? prev : { houseId, house: null, members: [], openRequests: [], logs: [] }),
        ...patch,
      }));
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failed = false;
    const onError = (e: FirestoreError) => {
      if (failed) return;
      failed = true;
      // Straight after joining, the server can briefly refuse reads until it
      // sees our membership. Retry a few times before giving up.
      if (e.code === 'permission-denied' && attempt < 5) {
        retryTimer = setTimeout(() => setRetry({ houseId, n: attempt + 1 }), 500 * (attempt + 1));
      } else {
        setError(`Couldn't load your house: ${e.message}`);
      }
    };
    const unsubs = [
      watchHouse(houseId, (house) => update({ house }), onError),
      watchMembers(houseId, (members) => update({ members }), onError),
      watchOpenRequests(houseId, (openRequests) => update({ openRequests }), onError),
      watchRecentLogs(houseId, (logs) => update({ logs }), onError),
    ];
    return () => {
      clearTimeout(retryTimer);
      unsubs.forEach((u) => u());
    };
  }, [houseId, attempt]);

  // 4. Once in a house, register this phone for chore notifications.
  useEffect(() => {
    if (!houseId || !user) return;
    let cancelled = false;
    registerForPushNotifications().then((token) => {
      if (!cancelled && token) setPushToken(houseId, user.uid, token).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [houseId, user]);

  const current = houseData && houseData.houseId === houseId ? houseData : null;
  const value: AppState = {
    ready: profileReady,
    error,
    user,
    profile,
    house: current?.house ?? null,
    members: current?.members ?? [],
    openRequests: current?.openRequests ?? [],
    logs: current?.logs ?? [],
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
