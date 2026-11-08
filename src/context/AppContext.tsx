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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [openRequests, setOpenRequests] = useState<ChoreRequest[]>([]);
  const [logs, setLogs] = useState<ChoreLog[]>([]);
  const [error, setError] = useState<string | null>(
    isFirebaseConfigured ? null : 'Firebase is not configured. Copy .env.example to .env.local and fill it in.',
  );

  // 1. Sign in silently. Each phone gets an anonymous account, kept between launches.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setAuthReady(true);
      } else {
        signInAnonymously(auth).catch((e) => setError(`Sign-in failed: ${e.message}`));
      }
    });
  }, []);

  // 2. Their profile (demographics + which house they're in).
  useEffect(() => {
    if (!user) return;
    setProfileReady(false);
    return watchProfile(user.uid, (p) => {
      setProfile(p);
      setProfileReady(true);
    });
  }, [user]);

  // 3. Everything about their house, live.
  const houseId = profile?.houseId ?? null;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [houseId]);
  useEffect(() => {
    if (!houseId) {
      setHouse(null);
      setMembers([]);
      setOpenRequests([]);
      setLogs([]);
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failed = false;
    const onError = (e: FirestoreError) => {
      if (failed) return;
      failed = true;
      // Straight after joining, the server can briefly refuse reads until it
      // sees our membership. Retry a few times before giving up.
      if (e.code === 'permission-denied' && attempt < 5) {
        retryTimer = setTimeout(() => setAttempt((a) => a + 1), 500 * (attempt + 1));
      } else {
        setError(`Couldn't load your house: ${e.message}`);
      }
    };
    const unsubs = [
      watchHouse(houseId, setHouse, onError),
      watchMembers(houseId, setMembers, onError),
      watchOpenRequests(houseId, setOpenRequests, onError),
      watchRecentLogs(houseId, setLogs, onError),
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

  const value: AppState = {
    ready: authReady && profileReady,
    error,
    user,
    profile,
    house,
    members,
    openRequests,
    logs,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
