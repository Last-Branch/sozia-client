import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SessionControllerProvider } from './src/ui/SessionController';
import { DashboardScreen } from './src/ui/screens/DashboardScreen';
import { LiveTranslationScreen } from './src/ui/screens/LiveTranslationScreen';
import { LoginScreen } from './src/ui/screens/LoginScreen';
import { PermissionsScreen } from './src/ui/screens/PermissionsScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { SignUpScreen } from './src/ui/screens/SignUpScreen';

export default function App() {
  const [route, setRoute] = React.useState<
    'login' | 'signup' | 'permissions' | 'dashboard' | 'live-translation' | 'settings'
  >('login');

  return (
    <SafeAreaProvider>
      <SessionControllerProvider>
        <SafeAreaView className="flex-1 w-full self-stretch bg-white">
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
            <DashboardScreen onOpenLive={() => setRoute('live-translation')} onOpenSettings={() => setRoute('settings')} />
          )}
          {route === 'live-translation' && <LiveTranslationScreen onBack={() => setRoute('dashboard')} />}
          {route === 'settings' && <SettingsScreen onBack={() => setRoute('dashboard')} />}

          <View className="border-t border-neutral-200 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-neutral-500">Route: {route}</Text>
              {route !== 'login' && (
                <TouchableOpacity onPress={() => setRoute('login')}>
                  <Text className="text-xs font-semibold text-neutral-900">Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <StatusBar style="auto" />
        </SafeAreaView>
      </SessionControllerProvider>
    </SafeAreaProvider>
  );
}
