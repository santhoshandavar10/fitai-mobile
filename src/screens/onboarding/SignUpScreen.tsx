import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import SocialAuth from '../../components/SocialAuth';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUp'>;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim()) return Alert.alert('Missing field', 'Please enter your name.');
    if (!isValidEmail(email)) return Alert.alert('Invalid email', 'Enter a valid email address.');
    if (password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);

    if (error) return Alert.alert('Sign up failed', error.message);
    navigation.navigate('Subscription');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.label}>GET STARTED</Text>
          <Text style={styles.heading}>Create{'\n'}Account</Text>
          <Text style={styles.subtitle}>
            Join the accountability revolution. Your transformation starts now.
          </Text>

          <View style={styles.form}>
            <Input icon="👤" placeholder="Full name" value={name} onChangeText={setName} />
            <Input icon="✉️" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input icon="🔒" placeholder="Password (min 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <Button
            title={loading ? 'Creating account...' : 'Create Account →'}
            onPress={handleSignUp}
            disabled={loading}
            style={{ marginTop: 32 }}
          />

          <SocialAuth mode="signup" />

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.toggle}>
            <Text style={styles.toggleText}>
              Already have an account?{' '}
              <Text style={styles.toggleAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  backButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  backText: { color: COLORS.text, fontSize: 18 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.text2, lineHeight: 22, marginBottom: 32 },
  form: { gap: 14 },
  toggle: { alignItems: 'center', marginTop: 20 },
  toggleText: { fontSize: 14, color: COLORS.text2 },
  toggleAccent: { color: COLORS.lime, fontWeight: '700' },
});
