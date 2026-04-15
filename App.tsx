import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LanguageProvider } from './sozia/client/ui/context/LanguageContext';
import { SessionControllerProvider } from './sozia/client/ui/controller/SessionController';
import { DashboardScreen } from './sozia/client/ui/screens/DashboardScreen';
import { HelpScreen } from './sozia/client/ui/screens/HelpScreen';
import { LiveTranslationScreen } from './sozia/client/ui/screens/LiveTranslationScreen';
import { LoginScreen } from './sozia/client/ui/screens/LoginScreen';
import { PermissionsScreen } from './sozia/client/ui/screens/PermissionsScreen';
import { SettingsScreen } from './sozia/client/ui/screens/SettingsScreen';
import { SignUpScreen } from './sozia/client/ui/screens/SignUpScreen';

export default function App() {
  const [route, setRoute] = React.useState<
    'login' | 'signup' | 'permissions' | 'dashboard' | 'live-translation' | 'settings' | 'help'
  >('login');

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SessionControllerProvider>
          <SafeAreaView className="flex-1 w-full self-stretch bg-white dark:bg-gray-900">
          {route === 'login' && (
            <LoginScreen
              onSignIn={() => setRoute('dashboard')}
              onSignUp={() => setRoute('signup')}
            />
          )}
          {route === 'signup' && <SignUpScreen onNext={() => setRoute('permissions')} onBack={() => setRoute('login')} />}
          {route === 'permissions' && (
            <PermissionsScreen onNext={() => setRoute('dashboard')} onBack={() => setRoute('signup')} />
          )}
          {route === 'dashboard' && (
            <DashboardScreen
              onOpenLive={() => setRoute('live-translation')}
              onOpenSettings={() => setRoute('settings')}
              onOpenHelp={() => setRoute('help')}
            />
          )}
          {route === 'help' && <HelpScreen onBack={() => setRoute('dashboard')} />}
          {route === 'live-translation' && <LiveTranslationScreen onBack={() => setRoute('dashboard')} />}
          {route === 'settings' && <SettingsScreen onBack={() => setRoute('dashboard')} />}

          {Platform.OS === 'web' && (
            <View className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Route: {route}</Text>
                {route !== 'login' && (
                  <TouchableOpacity onPress={() => setRoute('login')}>
                    <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <StatusBar style="auto" />
        </SafeAreaView>
        </SessionControllerProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
