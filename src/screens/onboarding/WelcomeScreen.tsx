import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { FEATURES } from '../../constants/mockData';
import Button from '../../components/Button';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <LinearGradient
      colors={['rgba(200,255,0,0.05)', 'transparent', 'rgba(0,212,255,0.03)']}
      start={{ x: 0.5, y: 1 }}
      end={{ x: 0.8, y: 0 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>F</Text>
        </View>

        {/* Headline */}
        <Text style={styles.heading}>
          Train{'\n'}Smarter.{'\n'}
          <Text style={styles.headingAccent}>Win.</Text>
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          AI-powered fitness & nutrition coaching with real accountability. Your body, analyzed and optimized.
        </Text>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Free trial badge */}
        <View style={styles.trialBadge}>
          <Text style={styles.trialBadgeText}>3-day free trial · No credit card risk</Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <Button title="Start Free Trial →" onPress={() => navigation.navigate('SignUp')} />
          <Button
            title="I already have an account"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    justifyContent: 'center',
  },
  logo: {
    width: 52,
    height: 52,
    backgroundColor: COLORS.lime,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
  },
  heading: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: -1,
    lineHeight: 52,
    marginBottom: 16,
  },
  headingAccent: {
    color: COLORS.lime,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text2,
    lineHeight: 26,
    marginBottom: 32,
    maxWidth: 280,
  },
  features: {
    gap: 12,
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lime,
    marginTop: 2,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text2,
    flex: 1,
  },
  trialBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.lime,
  },
  ctas: {
    gap: 12,
    marginTop: 'auto',
    paddingBottom: 20,
  },
});
