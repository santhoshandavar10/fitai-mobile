import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Subscription'>;

const PLANS = [
  {
    name: 'Monthly',
    price: '$29',
    period: '/month',
    afterTrial: 'Then $29/month',
    features: ['AI body analysis', 'Personalized workout plan', 'AI nutrition coaching', 'Form video check'],
    popular: false,
  },
  {
    name: 'Quarterly',
    price: '$19',
    period: '/month',
    afterTrial: 'Then $57 every 3 months',
    features: ['Everything in Monthly', 'Priority AI analysis', 'Best value — save 34%'],
    popular: true,
  },
];

const PLAN_KEYS = ['monthly', 'quarterly'];

export default function SubscriptionScreen({ navigation }: Props) {
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [accountability, setAccountability] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Force refresh session to ensure token is valid
      await supabase.auth.refreshSession();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('session:', session?.access_token?.slice(0, 30), 'error:', sessionError?.message);
      if (sessionError || !session) throw new Error('Not logged in — please sign in again.');
      const user = session.user;

      await supabase.from('profiles')
        .update({ accountability_enabled: accountability })
        .eq('id', user.id);

      const res = await fetch(
        'https://nxauqxctaqzivjfxdjdu.supabase.co/functions/v1/create-checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            plan: PLAN_KEYS[selectedPlan],
            successUrl: typeof window !== 'undefined' ? 'http://localhost:8081?checkout=success' : 'fitai://checkout/success',
            cancelUrl: typeof window !== 'undefined' ? 'http://localhost:8081?checkout=cancelled' : 'fitai://checkout/cancelled',
          }),
        }
      );

      const body = await res.json();
      console.log('checkout response:', JSON.stringify(body));
      if (body.error) throw new Error(body.error);
      if (!body.url) throw new Error(`No URL. Response: ${JSON.stringify(body)}`);

      if (typeof window !== 'undefined') {
        window.location.href = body.url;
      } else {
        Linking.openURL(body.url);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        {/* Free trial banner */}
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
        <View style={styles.plans}>
          {PLANS.map((plan, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedPlan(i)}
              style={[styles.planCard, selectedPlan === i && styles.planCardSelected]}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
              <Text style={styles.afterTrialText}>{plan.afterTrial}</Text>
              <View style={styles.planFeatures}>
                {plan.features.map((feat, j) => (
                  <Text key={j} style={styles.planFeature}>✓  {feat}</Text>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

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
          title={loading ? 'Opening checkout...' : 'Start Free Trial →'}
          onPress={handleContinue}
          disabled={accountability === null || loading}
          style={{ marginTop: 24 }}
        />


        <Text style={styles.legalNote}>
          Free for 3 days. After trial, billed as selected above. Cancel anytime before trial ends to avoid charges.
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
  trialBannerEmoji: { fontSize: 24 },
  trialBannerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.lime, letterSpacing: 0.5 },
  trialBannerSub: { fontSize: 12, color: COLORS.text2, marginTop: 1 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.text2, lineHeight: 22, marginBottom: 24 },
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
  accountabilityIcon: { fontSize: 20 },
  accountabilityTitle: { fontSize: 16, fontWeight: '800', color: COLORS.red },
  accountabilityDesc: { fontSize: 13, color: COLORS.text2, lineHeight: 20, marginBottom: 16 },
  optionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  optionCard: {
    flex: 1, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
  },
  optionCardYes: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  optionCardNo: { borderColor: COLORS.border2, backgroundColor: COLORS.surface2 },
  optionEmoji: { fontSize: 26, marginBottom: 4 },
  optionLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text3 },
  optionLabelYes: { color: COLORS.lime },
  optionLabelNo: { color: COLORS.text2 },
  optionSub: { fontSize: 11, color: COLORS.text3, textAlign: 'center' },
  legalNote: { fontSize: 11, color: COLORS.text3, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
