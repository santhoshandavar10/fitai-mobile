import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Missing fields', 'Please enter your email and password.');
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) return Alert.alert('Sign in failed', error.message);
    // Session is set automatically via onAuthStateChange in App.tsx
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.label}>WELCOME BACK</Text>
          <Text style={styles.heading}>Sign{'\n'}In</Text>
          <Text style={styles.subtitle}>Continue your fitness journey.</Text>

          <View style={styles.form}>
            <Input icon="✉️" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input icon="🔒" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <Button
            title={loading ? 'Signing in...' : 'Sign In →'}
            onPress={handleLogin}
            disabled={loading}
            style={{ marginTop: 32 }}
          />

          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.toggle}>
            <Text style={styles.toggleText}>
              Don't have an account?{' '}
              <Text style={styles.toggleAccent}>Sign Up</Text>
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
