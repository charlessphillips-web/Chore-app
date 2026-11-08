import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Values come from .env.local (see .env.example). EXPO_PUBLIC_ vars are
// bundled into the app; Firebase web config is designed to be public —
// security comes from firestore.rules, not from hiding these.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Set EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 to use local emulators
// (`npx firebase-tools emulators:start`) instead of the real database.
const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
if (useEmulator) {
  firebaseConfig.apiKey ||= 'demo-key';
  firebaseConfig.projectId ||= 'demo-choreboard';
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const firstInit = getApps().length === 0;
const app = firstInit ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = firstInit
  ? initializeAuth(
      app,
      Platform.OS === 'web' ? {} : { persistence: getReactNativePersistence(AsyncStorage) },
    )
  : getAuth(app);

export const db: Firestore = firstInit
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);

if (useEmulator && firstInit) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}
