import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';
import { supabase } from './src/lib/supabase';
import { useAppStore } from './src/store/useAppStore';
import { requestNotificationPermission, scheduleDailyReminders } from './src/lib/notifications';

const queryClient = new QueryClient();

function AuthListener() {
  const setSession = useAppStore((s) => s.setSession);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);

  useEffect(() => {
    // On web, check if returning from Stripe checkout
    const checkoutSuccess =
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('checkout') === 'success';

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        if (checkoutSuccess) {
          // Payment done — store step so OnboardingStack can resume at BodyScan
          localStorage.setItem('pending_onboarding_step', 'BodyScan');
          window.history.replaceState({}, '', window.location.pathname);
          await fetchProfile(session.user.id);
        } else {
          await fetchProfile(session.user.id);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        if (Platform.OS === 'web') {
          requestNotificationPermission().then((granted) => {
            if (granted) scheduleDailyReminders();
          });
        }
      } else {
        setIsOnboarded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', userId)
      .single();
    setIsOnboarded(data?.is_onboarded ?? false);
  }

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthListener />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
