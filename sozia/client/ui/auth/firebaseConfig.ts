import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const existingApps = getApps();
const app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];

function buildAuth(firebaseApp: FirebaseApp): Auth {
  if (existingApps.length > 0 || Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }
  return initializeAuth(firebaseApp, {
    persistence: inMemoryPersistence,
  });
}

export const firebaseAuth = buildAuth(app);
