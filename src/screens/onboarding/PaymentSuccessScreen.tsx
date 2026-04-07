import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import Button from '../../components/Button';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PaymentSuccess'>;

export default function PaymentSuccessScreen({ navigation }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['rgba(247,88,85,0.12)', 'transparent']} style={styles.gradient}>
        <View style={styles.content}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
            <LinearGradient colors={['#F75855', '#FF8C42']} style={styles.iconCircle}>
              <Text style={styles.iconText}>✓</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
            <Text style={styles.welcome}>WELCOME TO</Text>
            <Text style={styles.appName}>FITAI</Text>
            <Text style={styles.subtitle}>
              Your subscription is active. You're about to get a fully personalized AI fitness plan built around your body, your goals, and your life.
            </Text>

            <View style={styles.pillsRow}>
              {['AI Workout Plan', 'Meal Coaching', 'Body Analysis', 'Accountability'].map((item, i) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{item}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>Next — upload your body photos so AI can build your plan</Text>
          <Button
            title="Upload Body Photos →"
            onPress={() => navigation.navigate('BodyScan')}
            style={{ marginTop: 12 }}
          />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  gradient: { flex: 1, paddingHorizontal: 28 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  iconWrap: { marginBottom: 8 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F75855', shadowOpacity: 0.5, shadowRadius: 24,
  },
  iconText: { fontSize: 44, color: COLORS.white, fontWeight: '900' },
  welcome: { fontSize: 13, fontWeight: '700', color: COLORS.text3, letterSpacing: 3, textAlign: 'center', marginBottom: 4 },
  appName: { fontSize: 52, fontWeight: '900', color: COLORS.text, letterSpacing: -2, textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 15, color: COLORS.text2, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: { backgroundColor: COLORS.limeDim, borderWidth: 1, borderColor: COLORS.lime + '40', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.lime },
  footer: { paddingBottom: 36 },
  footerHint: { fontSize: 12, color: COLORS.text3, textAlign: 'center' },
});
