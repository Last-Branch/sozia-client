import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { firebaseAuth } from './firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isSigning: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'sozia.auth.custom';

function toHttpBaseUrl(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/ws\/?$/, '');
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authSource = useRef<'firebase' | 'custom' | null>(null);

  const [, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    let firebaseSettled = false;
    let customChecked = false;

    const checkDone = () => {
      if (firebaseSettled && customChecked) setIsLoading(false);
    };

    AsyncStorage.getItem(AUTH_STORAGE_KEY).then((raw) => {
      if (raw && authSource.current === null) {
        try {
          const { user: u } = JSON.parse(raw) as { token: string; user: { id: string; email: string; name: string } };
          setUser({ id: u.id, email: u.email, displayName: u.name, photoURL: null });
          authSource.current = 'custom';
        } catch {}
      }
      customChecked = true;
      checkDone();
    }).catch(() => { customChecked = true; checkDone(); });

    const unsub = onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (fbUser) {
        setUser({ id: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName, photoURL: fbUser.photoURL });
        authSource.current = 'firebase';
        void AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } else if (authSource.current === 'firebase') {
        setUser(null);
        authSource.current = null;
      }
      firebaseSettled = true;
      setIsSigning(false);
      checkDone();
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !response) return;
    if (response.type === 'dismiss') { setIsSigning(false); return; }
    if (response.type === 'error') { setAuthError('Google sign-in failed. Please try again.'); setIsSigning(false); return; }
    if (response.type !== 'success') return;

    const idToken = response.authentication?.idToken ?? (response.params as Record<string, string> | undefined)?.id_token;
    if (!idToken) { setAuthError('Google sign-in failed. Please try again.'); setIsSigning(false); return; }

    const credential = GoogleAuthProvider.credential(idToken);
    signInWithCredential(firebaseAuth, credential).catch(() => {
      setAuthError('Google sign-in failed. Please try again.');
      setIsSigning(false);
    });
  }, [response]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSigning(true);
    try {
      if (Platform.OS === 'web') {
        await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      } else {
        await promptAsync();
      }
    } catch {
      setAuthError('Google sign-in failed. Please try again.');
      setIsSigning(false);
    }
  }, [promptAsync]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    setIsSigning(true);
    try {
      const base = toHttpBaseUrl(process.env.EXPO_PUBLIC_SERVER_URL ?? 'wss://...');
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: { id: string; email: string; name: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed');
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user }));
      setUser({ id: data.user!.id, email: data.user!.email, displayName: data.user!.name, photoURL: null });
      authSource.current = 'custom';
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setIsSigning(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    setAuthError(null);
    setIsSigning(true);
    try {
      const base = toHttpBaseUrl(process.env.EXPO_PUBLIC_SERVER_URL ?? 'wss://...');
      const res = await fetch(`${base}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json() as { token?: string; user?: { id: string; email: string; name: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sign up failed');
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user }));
      setUser({ id: data.user!.id, email: data.user!.email, displayName: data.user!.name, photoURL: null });
      authSource.current = 'custom';
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setIsSigning(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (authSource.current === 'firebase') {
      await fbSignOut(firebaseAuth);
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      authSource.current = null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isSigning, authError, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
