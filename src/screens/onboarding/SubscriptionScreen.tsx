import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { getCustomerInfo, isEntitled, ENTITLEMENT_ID } from '../../lib/purchases';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Subscription'>;

export default function SubscriptionScreen({ navigation }: Props) {
  const [checking, setChecking] = useState(true);

  // On mount, check if already entitled (e.g. restored from another device)
  useEffect(() => {
    getCustomerInfo().then((info) => {
      if (isEntitled(info)) {
        handleSuccess();
      } else {
        setChecking(false);
        showPaywall();
      }
    });
  }, []);

  async function handleSuccess() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('profiles')
          .update({ is_subscribed: true })
          .eq('id', session.user.id);
      }
    } catch (e) {
      console.warn('[RC] profile update failed:', e);
    }
    navigation.navigate('PaymentSuccess');
  }

  async function showPaywall() {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });

      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          await handleSuccess();
          break;
        case PAYWALL_RESULT.NOT_PRESENTED:
          // Already subscribed — go straight through
          await handleSuccess();
          break;
        case PAYWALL_RESULT.CANCELLED:
          navigation.goBack();
          break;
        case PAYWALL_RESULT.ERROR:
          Alert.alert('Something went wrong', 'Could not load the subscription page. Please try again.');
          navigation.goBack();
          break;
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Unknown error');
      navigation.goBack();
    }
  }

  // Show a loading state while the native paywall is launching
  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.lime} size="large" />
      </SafeAreaView>
    );
  }

  // Fallback in case paywall takes a moment — show a manual trigger
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>FIT AI PRO</Text>
        <Text style={styles.subtitle}>Unlock your AI coach — body analysis, personalized workouts, and nutrition.</Text>
        <ActivityIndicator color={COLORS.lime} style={{ marginTop: 32 }} />
        <Text style={styles.loadingText}>Loading plans...</Text>

        <TouchableOpacity style={styles.retryBtn} onPress={showPaywall}>
          <Text style={styles.retryText}>Tap to view plans</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  backButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center', margin: 24,
  },
  backText: { color: COLORS.text, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: 1, marginBottom: 12 },
  subtitle: { fontSize: 15, color: COLORS.text2, textAlign: 'center', lineHeight: 22 },
  loadingText: { fontSize: 13, color: COLORS.text3, marginTop: 12 },
  retryBtn: { marginTop: 32, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: COLORS.lime, borderRadius: 14 },
  retryText: { fontSize: 15, fontWeight: '800', color: COLORS.black },
});
