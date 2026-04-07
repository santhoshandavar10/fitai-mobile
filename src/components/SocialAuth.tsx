import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { COLORS } from '../constants/colors';
import { supabase } from '../lib/supabase';

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.36.74 3.17.8 1.2-.24 2.35-.93 3.63-.84 1.54.12 2.7.7 3.44 1.8-3.13 1.85-2.38 5.9.48 7.03-.57 1.5-1.33 3-2.72 4.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill={COLORS.text} />
    </Svg>
  );
}

interface Props {
  mode: 'signup' | 'signin';
}

export default function SocialAuth({ mode }: Props) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const setLoading = provider === 'google' ? setLoadingGoogle : setLoadingApple;
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert(`${provider === 'google' ? 'Google' : 'Apple'} sign-in failed`, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => handleOAuth('google')}
          disabled={loadingGoogle || loadingApple}
          activeOpacity={0.75}
        >
          {loadingGoogle ? <ActivityIndicator size="small" color={COLORS.text} /> : <GoogleIcon />}
          <Text style={styles.socialBtnText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialBtn, styles.appleBtn]}
          onPress={() => handleOAuth('apple')}
          disabled={loadingGoogle || loadingApple}
          activeOpacity={0.75}
        >
          {loadingApple ? <ActivityIndicator size="small" color={COLORS.text} /> : <AppleIcon />}
          <Text style={styles.socialBtnText}>Apple</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.text3, fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border2,
    borderRadius: 14, paddingVertical: 14,
  },
  appleBtn: { backgroundColor: COLORS.surface2 },
  socialBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
});
