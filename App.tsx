import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';
import { supabase } from './src/lib/supabase';
import { useAppStore } from './src/store/useAppStore';
import { requestNotificationPermission, scheduleDailyReminders } from './src/lib/notifications';
import { configurePurchases, identifyPurchasesUser, resetPurchasesUser } from './src/lib/purchases';

const queryClient = new QueryClient();

// Configure RevenueCat once at startup
configurePurchases();

function AuthListener() {
  const setSession = useAppStore((s) => s.setSession);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const setIsSubscribed = useAppStore((s) => s.setIsSubscribed);
  const setPendingOnboardingStep = useAppStore((s) => s.setPendingOnboardingStep);

  useEffect(() => {
    // On web, check if returning from Stripe checkout
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success') {
        setPendingOnboardingStep('PaymentSuccess');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await identifyPurchasesUser(session.user.id);
        await fetchProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await identifyPurchasesUser(session.user.id);
        fetchProfile(session.user.id);
        if (Platform.OS === 'web') {
          requestNotificationPermission().then((granted) => {
            if (granted) scheduleDailyReminders();
          });
        }
      } else {
        setIsOnboarded(false);
        setIsSubscribed(false);
        await resetPurchasesUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('is_onboarded, is_subscribed')
      .eq('id', userId)
      .single();
    setIsOnboarded(data?.is_onboarded ?? false);
    setIsSubscribed(data?.is_subscribed ?? false);
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
