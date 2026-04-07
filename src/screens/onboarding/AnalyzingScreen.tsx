import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Analyzing'>;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const STEPS = [
  { label: 'Scanning body composition...' },
  { label: 'Building personalized workout plan...' },
  { label: 'Calculating nutrition targets...' },
  { label: 'Finalizing your program...' },
  { label: 'Your plan is ready!' },
];

const BODY_HEIGHT = 220;

function BodyScanSVG({ scanY }: { scanY: Animated.Value }) {
  const clipHeight = scanY.interpolate({ inputRange: [0, 1], outputRange: [0, BODY_HEIGHT] });
  const lineY = scanY.interpolate({ inputRange: [0, 1], outputRange: [0, BODY_HEIGHT] });
  const glowOpacity = scanY.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1, 0.9] });

  return (
    <View style={{ width: 140, height: BODY_HEIGHT, marginBottom: 24 }}>
      <Svg width={140} height={BODY_HEIGHT} viewBox="0 0 140 220">
        <Defs>
          <SvgGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.lime} stopOpacity="0.15" />
            <Stop offset="1" stopColor={COLORS.lime} stopOpacity="0.05" />
          </SvgGradient>
          <SvgGradient id="filledGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.lime} stopOpacity="0.7" />
            <Stop offset="1" stopColor={COLORS.lime} stopOpacity="0.3" />
          </SvgGradient>
        </Defs>

        {/* Body outline — dim base */}
        {/* Head */}
        <Circle cx="70" cy="22" r="16" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Neck */}
        <Path d="M63 37 L63 45 L77 45 L77 37" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Torso */}
        <Path d="M45 45 L30 85 L32 130 L108 130 L110 85 L95 45 Z" fill="url(#bodyGrad)" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Left arm */}
        <Path d="M45 50 L28 55 L20 90 L26 125 L34 125 L38 92 L50 88" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Right arm */}
        <Path d="M95 50 L112 55 L120 90 L114 125 L106 125 L102 92 L90 88" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Left leg */}
        <Path d="M57 130 L50 170 L48 210 L64 210 L68 172 L70 155" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />
        {/* Right leg */}
        <Path d="M83 130 L90 170 L92 210 L76 210 L72 172 L70 155" fill="none" stroke={COLORS.lime} strokeWidth="1.5" opacity="0.2" />

        {/* Muscle lines — dim */}
        {/* Chest */}
        <Path d="M55 60 Q70 70 85 60" fill="none" stroke={COLORS.lime} strokeWidth="0.8" opacity="0.15" />
        {/* Abs */}
        <Path d="M60 80 L80 80 M62 95 L78 95 M63 110 L77 110" fill="none" stroke={COLORS.lime} strokeWidth="0.8" opacity="0.15" />
        {/* Center line */}
        <Path d="M70 55 L70 130" fill="none" stroke={COLORS.lime} strokeWidth="0.8" strokeDasharray="3 4" opacity="0.15" />
      </Svg>

      {/* Scanned / lit up body — clipped by scan progress */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: 140, overflow: 'hidden', height: clipHeight }}>
        <Svg width={140} height={BODY_HEIGHT} viewBox="0 0 140 220">
          {/* Head */}
          <Circle cx="70" cy="22" r="16" fill="none" stroke={COLORS.lime} strokeWidth="2" opacity="0.9" />
          {/* Neck */}
          <Path d="M63 37 L63 45 L77 45 L77 37" fill="none" stroke={COLORS.lime} strokeWidth="2" opacity="0.9" />
          {/* Torso */}
          <Path d="M45 45 L30 85 L32 130 L108 130 L110 85 L95 45 Z" fill="url(#filledGrad)" stroke={COLORS.lime} strokeWidth="2" />
          {/* Left arm */}
          <Path d="M45 50 L28 55 L20 90 L26 125 L34 125 L38 92 L50 88" fill="none" stroke={COLORS.lime} strokeWidth="2" />
          {/* Right arm */}
          <Path d="M95 50 L112 55 L120 90 L114 125 L106 125 L102 92 L90 88" fill="none" stroke={COLORS.lime} strokeWidth="2" />
          {/* Left leg */}
          <Path d="M57 130 L50 170 L48 210 L64 210 L68 172 L70 155" fill="none" stroke={COLORS.lime} strokeWidth="2" />
          {/* Right leg */}
          <Path d="M83 130 L90 170 L92 210 L76 210 L72 172 L70 155" fill="none" stroke={COLORS.lime} strokeWidth="2" />
          {/* Chest */}
          <Path d="M55 60 Q70 70 85 60" fill="none" stroke={COLORS.lime} strokeWidth="1.2" />
          {/* Abs */}
          <Path d="M60 80 L80 80 M62 95 L78 95 M63 110 L77 110" fill="none" stroke={COLORS.lime} strokeWidth="1.2" />
          {/* Center line */}
          <Path d="M70 55 L70 130" fill="none" stroke={COLORS.lime} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
        </Svg>
      </Animated.View>

      {/* Scan line */}
      <Animated.View style={[styles.scanLine, { top: lineY }]}>
        <Animated.View style={[styles.scanLineGlow, { opacity: glowOpacity }]} />
      </Animated.View>
    </View>
  );
}

export default function AnalyzingScreen(_: Props) {
  const [step, setStep] = useState(0);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const scanY = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scan animation — loops up and down
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(scanY, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    ).start();

    // Advance steps
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < 3) { currentStep += 1; setStep(currentStep); }
      else clearInterval(interval);
    }, 750);

    // Fire-and-forget plan generation
    const runAnalysis = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        if (user && session) {
          fetch(`${SUPABASE_URL}/functions/v1/analyze-body`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({}),
          }).then(r => r.json()).then(result => {
            if (result.error) console.error('analyze-body error:', result.error);
          }).catch(e => console.error('analyze-body exception:', e));
        }
      } catch (e) {
        console.error('analyze-body exception:', e);
      }
    };

    const markOnboarded = async () => {
      clearInterval(interval);
      setStep(4);
      Animated.timing(progressWidth, { toValue: 1, duration: 600, useNativeDriver: false }).start();
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
        setIsOnboarded(true);
      }, 1200);
    };

    Animated.timing(progressWidth, { toValue: 0.85, duration: 3500, useNativeDriver: false }).start();
    runAnalysis();
    setTimeout(markOnboarded, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>AI BODY SCAN</Text>
        <Text style={styles.heading}>Analyzing{'\n'}Your Body</Text>

        <BodyScanSVG scanY={scanY} />

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.stepRow, i <= step && styles.stepActive]}>
              <View style={[styles.stepDot, i < step && styles.stepDotDone, i === step && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, {
            width: progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Text style={styles.progressText}>{step < 4 ? 'Scanning with AI...' : '100% complete'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.lime, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  heading: { fontSize: 32, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', textAlign: 'center', letterSpacing: -0.5, lineHeight: 34, marginBottom: 28 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  scanLineGlow: { height: 2, backgroundColor: COLORS.lime, shadowColor: COLORS.lime, shadowOpacity: 1, shadowRadius: 8, borderRadius: 1 },
  steps: { width: '100%', gap: 10, marginBottom: 28 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.25 },
  stepActive: { opacity: 1 },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.surface3 },
  stepDotActive: { backgroundColor: COLORS.lime },
  stepDotDone: { backgroundColor: COLORS.lime },
  stepLabel: { fontSize: 13, color: COLORS.text3 },
  stepLabelActive: { color: COLORS.text2 },
  progressBar: { width: '100%', height: 4, backgroundColor: COLORS.surface3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.lime, borderRadius: 2 },
  progressText: { fontSize: 11, color: COLORS.text3, marginTop: 8, letterSpacing: 0.5 },
});
