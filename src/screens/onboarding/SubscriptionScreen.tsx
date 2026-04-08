import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Subscription'>;

export default function SubscriptionScreen({ navigation }: Props) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [accountability, setAccountability] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  async function loadOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      setPackages(pkgs);
      // Default select the second package if available (quarterly = best value)
      if (pkgs.length > 1) setSelectedIndex(1);
    } catch (e: any) {
      console.warn('RevenueCat offerings error:', e.message);
    } finally {
      setLoadingPackages(false);
    }
  }

  const handlePurchase = async () => {
    if (packages.length === 0) {
      Alert.alert('Not available', 'No subscription packages found. Check App Store Connect setup.');
      return;
    }
    setLoading(true);
    try {
      const pkg = packages[selectedIndex];
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
      if (isActive) {
        // Mark subscription in Supabase profile
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase
            .from('profiles')
            .update({ is_subscribed: true, accountability_enabled: accountability })
            .eq('id', session.user.id);
        }
        navigation.navigate('PaymentSuccess');
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
      if (isActive) {
        navigation.navigate('PaymentSuccess');
      } else {
        Alert.alert('No purchases found', 'No active subscription found for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fallback UI data when packages haven't loaded yet
  const FALLBACK_PLANS = [
    { name: 'Monthly', price: '$29', period: '/month', afterTrial: 'Then $29/month', features: ['AI body analysis', 'Personalized workout plan', 'AI nutrition coaching', 'Form video check'] },
    { name: 'Quarterly', price: '$19', period: '/month', afterTrial: 'Then $57 every 3 months', features: ['Everything in Monthly', 'Priority AI analysis', 'Best value — save 34%'], popular: true },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.trialBanner}>
          <View>
            <Text style={styles.trialBannerTitle}>3 DAYS FREE</Text>
            <Text style={styles.trialBannerSub}>No charge today · Cancel anytime</Text>
          </View>
        </View>

        <Text style={styles.heading}>Start Your{'\n'}Free Trial</Text>
        <Text style={styles.subtitle}>
          Try FitAI free for 3 days. Your AI coach analyzes your body and builds a personalized plan on day one.
        </Text>

        {/* Plans */}
        {loadingPackages ? (
          <View style={styles.loadingPlans}>
            <ActivityIndicator color={COLORS.lime} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : (
          <View style={styles.plans}>
            {(packages.length > 0 ? packages : FALLBACK_PLANS).map((item, i) => {
              const isPkg = 'product' in item;
              const name = isPkg ? item.product.title : (item as any).name;
              const price = isPkg ? item.product.priceString : (item as any).price;
              const period = isPkg ? '' : (item as any).period;
              const afterTrial = isPkg
                ? `Then ${item.product.priceString}/${item.packageType.toLowerCase()}`
                : (item as any).afterTrial;
              const features: string[] = isPkg ? [] : (item as any).features ?? [];
              const isPopular = isPkg ? i === 1 : !!(item as any).popular;

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedIndex(i)}
                  style={[styles.planCard, selectedIndex === i && styles.planCardSelected]}
                >
                  {isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>BEST VALUE</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>{price}</Text>
                    {period ? <Text style={styles.planPeriod}>{period}</Text> : null}
                  </View>
                  <Text style={styles.afterTrialText}>{afterTrial}</Text>
                  {features.length > 0 && (
                    <View style={styles.planFeatures}>
                      {features.map((feat, j) => (
                        <Text key={j} style={styles.planFeature}>✓  {feat}</Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Accountability opt-in */}
        <View style={styles.accountabilityCard}>
          <View style={styles.accountabilityHeader}>
            <Text style={styles.accountabilityTitle}>$10 Accountability Fee</Text>
          </View>
          <Text style={styles.accountabilityDesc}>
            Miss your weekly workout targets? A $10 charge applies every Monday. Hit your goals and you never pay it.
          </Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              onPress={() => setAccountability(true)}
              style={[styles.optionCard, accountability === true && styles.optionCardYes]}
            >
              <Text style={[styles.optionLabel, accountability === true && styles.optionLabelYes]}>I'm in</Text>
              <Text style={styles.optionSub}>Hold me accountable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccountability(false)}
              style={[styles.optionCard, accountability === false && styles.optionCardNo]}
            >
              <Text style={[styles.optionLabel, accountability === false && styles.optionLabelNo]}>Skip</Text>
              <Text style={styles.optionSub}>No fee, no pressure</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title={loading ? 'Processing...' : 'Start Free Trial →'}
          onPress={handlePurchase}
          disabled={loading || loadingPackages}
          style={{ marginTop: 24 }}
        />

        <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreButton}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          Free for 3 days. After trial, billed as selected above. Cancel anytime before trial ends to avoid charges. Payment charged to your Apple ID account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  backButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  backText: { color: COLORS.text, fontSize: 18 },
  trialBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.limeDim, borderWidth: 1, borderColor: COLORS.lime + '40',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24,
  },
  trialBannerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.lime, letterSpacing: 0.5 },
  trialBannerSub: { fontSize: 12, color: COLORS.text2, marginTop: 1 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.text2, lineHeight: 22, marginBottom: 24 },
  loadingPlans: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  loadingText: { color: COLORS.text2, fontSize: 13 },
  plans: { gap: 14 },
  planCard: {
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 20, padding: 20, position: 'relative',
  },
  planCardSelected: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  popularBadge: {
    position: 'absolute', top: -10, right: 16,
    backgroundColor: COLORS.lime, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100,
  },
  popularText: { fontSize: 9, fontWeight: '800', color: COLORS.black, letterSpacing: 1 },
  planName: { fontSize: 14, fontWeight: '700', color: COLORS.text2, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 36, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  planPeriod: { fontSize: 14, color: COLORS.text3 },
  afterTrialText: { fontSize: 11, color: COLORS.text3, marginTop: 2, marginBottom: 2 },
  planFeatures: { marginTop: 14, gap: 6 },
  planFeature: { fontSize: 13, color: COLORS.text2 },
  accountabilityCard: {
    marginTop: 24, backgroundColor: 'rgba(255,71,87,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)', borderRadius: 20, padding: 20,
  },
  accountabilityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  accountabilityTitle: { fontSize: 16, fontWeight: '800', color: COLORS.red },
  accountabilityDesc: { fontSize: 13, color: COLORS.text2, lineHeight: 20, marginBottom: 16 },
  optionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  optionCard: {
    flex: 1, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
  },
  optionCardYes: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  optionCardNo: { borderColor: COLORS.border2, backgroundColor: COLORS.surface2 },
  optionLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text3 },
  optionLabelYes: { color: COLORS.lime },
  optionLabelNo: { color: COLORS.text2 },
  optionSub: { fontSize: 11, color: COLORS.text3, textAlign: 'center' },
  restoreButton: { alignItems: 'center', paddingVertical: 14 },
  restoreText: { fontSize: 13, color: COLORS.text3, textDecorationLine: 'underline' },
  legalNote: { fontSize: 11, color: COLORS.text3, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
