import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './sozia/client/ui/auth/AuthContext';
import { LanguageProvider } from './sozia/client/ui/context/LanguageContext';
import { SessionControllerProvider } from './sozia/client/ui/controller/SessionController';
import { DashboardScreen } from './sozia/client/ui/screens/DashboardScreen';
import { HelpScreen } from './sozia/client/ui/screens/HelpScreen';
import { LiveTranslationScreen } from './sozia/client/ui/screens/LiveTranslationScreen';
import { LoginScreen } from './sozia/client/ui/screens/LoginScreen';
import { PermissionsScreen } from './sozia/client/ui/screens/PermissionsScreen';
import { ProfileScreen } from './sozia/client/ui/screens/ProfileScreen';
import { SettingsScreen } from './sozia/client/ui/screens/SettingsScreen';
import { SignUpScreen } from './sozia/client/ui/screens/SignUpScreen';

type Route = 'login' | 'signup' | 'permissions' | 'dashboard' | 'live-translation' | 'settings' | 'help' | 'profile';

function AppContent() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  const [route, setRoute] = React.useState<Route>('login');
  const [dashboardNoticeKey, setDashboardNoticeKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isLoading) return;
    if (user !== null) {
      setRoute((prev) => {
        if (prev === 'login') return 'dashboard';
        if (prev === 'signup') return 'permissions';
        return prev;
      });
    } else {
      setRoute('login');
    }
  }, [user, isLoading]);

  const handleSignOut = React.useCallback(async () => {
    setRoute('login');
    await signOut();
  }, [signOut]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 w-full items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2ECC71" />
      </SafeAreaView>
    );
  }

  return (
    <SessionControllerProvider>
      <SafeAreaView className="flex-1 w-full self-stretch bg-white dark:bg-gray-900">
        {route === 'login' && (
          <LoginScreen
            onSignUp={() => setRoute('signup')}
            onGoogleSignIn={signInWithGoogle}
          />
        )}
        {route === 'signup' && (
          <SignUpScreen
            onNext={() => setRoute('permissions')}
            onBack={() => setRoute('login')}
            onGoogleSignIn={signInWithGoogle}
          />
        )}
        {route === 'permissions' && (
          <PermissionsScreen onNext={() => setRoute('dashboard')} onBack={() => setRoute('signup')} />
        )}
        {route === 'dashboard' && (
          <DashboardScreen
            noticeKey={dashboardNoticeKey}
            onOpenLive={() => setRoute('live-translation')}
            onOpenSettings={() => setRoute('settings')}
            onOpenHelp={() => setRoute('help')}
            onOpenProfile={() => setRoute('profile')}
          />
        )}
        {route === 'help' && <HelpScreen onBack={() => setRoute('dashboard')} />}
        {route === 'live-translation' && (
          <LiveTranslationScreen
            onBack={(noticeKey?: string) => {
              setDashboardNoticeKey(noticeKey ?? null);
              setRoute('dashboard');
            }}
          />
        )}
        {route === 'settings' && <SettingsScreen onBack={() => setRoute('dashboard')} />}
        {route === 'profile' && <ProfileScreen onBack={() => setRoute('dashboard')} />}

        {Platform.OS === 'web' && (
          <View className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Route: {route}</Text>
              {route !== 'login' && (
                <TouchableOpacity onPress={handleSignOut}>
                  <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Sign Out</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <StatusBar style="auto" />
      </SafeAreaView>
    </SessionControllerProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
