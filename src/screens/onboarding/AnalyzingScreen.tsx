import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Analyzing'>;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const STEPS = [
  { label: 'Analyzing body composition...' },
  { label: 'Building personalized workout plan...' },
  { label: 'Calculating nutrition targets...' },
  { label: 'Finalizing your program...' },
  { label: 'Your plan is ready!' },
];

export default function AnalyzingScreen(_: Props) {
  const [step, setStep] = useState(0);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const spinValue = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Advance steps 0→3 automatically
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < 3) {
        currentStep += 1;
        setStep(currentStep);
      } else {
        clearInterval(interval);
      }
    }, 2000);

    // Call AI analysis in parallel
    const runAnalysis = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();

        if (user && session) {
          await fetch(`${SUPABASE_URL}/functions/v1/analyze-body`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({}),
          });
        }
      } catch {
        // Non-fatal — plan generation failed but we still onboard the user
      }

      // Mark onboarded after analysis (whether or not it succeeded)
      clearInterval(interval);

      // Animate to step 4
      setStep(4);

      Animated.timing(progressWidth, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();

      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
        }
        setIsOnboarded(true);
      }, 1200);
    };

    // Start progress bar
    Animated.timing(progressWidth, {
      toValue: 0.85,
      duration: STEPS.length * 2000,
      useNativeDriver: false,
    }).start();

    runAnalysis();

    return () => clearInterval(interval);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <View style={styles.spinnerDot} />
        </Animated.View>

        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>

        <Text style={styles.heading}>Building{'\n'}Your Plan</Text>
        <Text style={styles.subtitle}>
          Our AI is analyzing your body and creating a personalized program...
        </Text>

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.stepRow, i <= step && styles.stepActive]}>
              <View style={[styles.stepDot, i < step && styles.stepDotDone, i === step && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {step < 4 ? 'Analyzing with AI...' : '100% complete'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center',
  },
  spinner: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: COLORS.border,
    borderTopColor: COLORS.lime,
    marginBottom: 24,
  },
  spinnerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.lime, position: 'absolute', top: -4, left: 33,
  },
  aiBadge: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.lime,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  aiBadgeText: { fontSize: 15, fontWeight: '900', color: COLORS.black },
  heading: {
    fontSize: 34, fontWeight: '900', color: COLORS.text,
    textTransform: 'uppercase', textAlign: 'center', letterSpacing: -0.5,
    lineHeight: 36, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: COLORS.text2, textAlign: 'center', marginBottom: 32,
  },
  steps: { width: '100%', gap: 14, marginBottom: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.3 },
  stepActive: { opacity: 1 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surface3 },
  stepDotActive: { backgroundColor: COLORS.lime },
  stepDotDone: { backgroundColor: COLORS.lime },
  stepLabel: { fontSize: 14, color: COLORS.text3 },
  stepLabelActive: { color: COLORS.text2 },
  progressBar: {
    width: '100%', height: 6, backgroundColor: COLORS.surface3,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.lime, borderRadius: 3 },
  progressText: { fontSize: 12, color: COLORS.text3, marginTop: 8 },
});
