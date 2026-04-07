import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { GOALS } from '../../constants/mockData';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Setup'>;

function lbsToKg(lbs: number): number { return parseFloat((lbs * 0.453592).toFixed(1)); }
function ftInToCm(ft: number, inch: number): number { return Math.round((ft * 12 + inch) * 2.54); }

const GENDERS = [
  { label: 'Male', icon: '♂' },
  { label: 'Female', icon: '♀' },
  { label: 'Other', icon: '⚧' },
];

function Stepper({
  label, display, onInc, onDec,
}: { label: string; display: string; onInc: () => void; onDec: () => void }) {
  return (
    <View style={stepperStyles.wrap}>
      <Text style={stepperStyles.label}>{label}</Text>
      <View style={stepperStyles.row}>
        <TouchableOpacity style={stepperStyles.btn} onPress={onDec} activeOpacity={0.7}>
          <Text style={stepperStyles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={stepperStyles.value}>{display}</Text>
        <TouchableOpacity style={stepperStyles.btn} onPress={onInc} activeOpacity={0.7}>
          <Text style={stepperStyles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SetupScreen({ navigation }: Props) {
  const [age, setAge] = useState('');
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(9);
  const [weightLbs, setWeightLbs] = useState(160);
  const [goal, setGoal] = useState(0);
  const [env, setEnv] = useState(0);
  const [gender, setGender] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError('Not logged in. Please sign in again.');
      return;
    }

    const { error: dbError } = await supabase.from('profiles').update({
      age: Number(age) || 25,
      height_cm: ftInToCm(heightFt, heightIn),
      weight_kg: lbsToKg(weightLbs),
      goal,
      environment: env,
      gender,
    }).eq('id', user.id);

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    navigation.navigate('Analyzing');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.label}>STEP 2 OF 2</Text>
        <Text style={styles.heading}>Your{'\n'}Profile</Text>
        <Text style={styles.subtitle}>Tell us about yourself so our AI can build the perfect plan.</Text>

        {/* Age */}
        <View style={styles.inputs}>
          <Input icon="" placeholder="Age" value={age} onChangeText={setAge} keyboardType="numeric" />
        </View>

        {/* Height */}
        <Text style={styles.sectionLabel}>HEIGHT</Text>
        <View style={styles.stepperRow}>
          <Stepper
            label="Feet"
            display={`${heightFt} ft`}
            onDec={() => setHeightFt(f => Math.max(4, f - 1))}
            onInc={() => setHeightFt(f => Math.min(8, f + 1))}
          />
          <Stepper
            label="Inches"
            display={`${heightIn} in`}
            onDec={() => setHeightIn(i => Math.max(0, i - 1))}
            onInc={() => setHeightIn(i => Math.min(11, i + 1))}
          />
        </View>

        {/* Weight */}
        <Text style={styles.sectionLabel}>WEIGHT</Text>
        <View style={styles.stepperRow}>
          <Stepper
            label="Pounds"
            display={`${weightLbs} lbs`}
            onDec={() => setWeightLbs(w => Math.max(80, w - 1))}
            onInc={() => setWeightLbs(w => Math.min(400, w + 1))}
          />
        </View>

        {/* Gender */}
        <Text style={styles.sectionLabel}>GENDER</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setGender(i)}
              style={[styles.genderCard, gender === i && styles.genderCardSelected]}
            >
              <Text style={styles.genderIcon}>{g.icon}</Text>
              <Text style={[styles.genderLabel, gender === i && styles.genderLabelSelected]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal */}
        <Text style={styles.sectionLabel}>PRIMARY GOAL</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((g, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setGoal(i)}
              style={[styles.goalCard, goal === i && styles.goalCardSelected]}
            >
              <Text style={styles.goalIcon}>{g.icon}</Text>
              <Text style={styles.goalName}>{g.name}</Text>
              <Text style={styles.goalDesc}>{g.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Environment */}
        <Text style={styles.sectionLabel}>WORKOUT ENVIRONMENT</Text>
        <View style={styles.envRow}>
          {[{ icon: '🏋️', label: 'Gym' }, { icon: '🏠', label: 'Home' }].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setEnv(i)}
              style={[styles.envCard, env === i && styles.envCardSelected]}
            >
              <Text style={styles.envIcon}>{item.icon}</Text>
              <Text style={styles.envLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={loading ? 'Saving...' : 'Build My Plan →'}
          onPress={handleNext}
          disabled={loading}
          loading={loading}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const stepperStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface2, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  btn: {
    width: 48, height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface3,
  },
  btnText: { fontSize: 22, fontWeight: '300', color: COLORS.text, lineHeight: 26 },
  value: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  backText: { color: COLORS.text, fontSize: 18 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.text2, lineHeight: 22, marginBottom: 32 },
  inputs: { gap: 14, marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  stepperRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  genderCard: { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 6 },
  genderCardSelected: { backgroundColor: COLORS.limeDim, borderColor: COLORS.lime },
  genderIcon: { fontSize: 22 },
  genderLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text2 },
  genderLabelSelected: { color: COLORS.lime },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  goalCard: { width: '47%', backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border, borderRadius: 16, padding: 18, alignItems: 'center' },
  goalCardSelected: { backgroundColor: COLORS.limeDim, borderColor: COLORS.lime },
  goalIcon: { fontSize: 28, marginBottom: 8 },
  goalName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  goalDesc: { fontSize: 11, color: COLORS.text2, marginTop: 3 },
  envRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  envCard: { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border, borderRadius: 16, padding: 18, alignItems: 'center' },
  envCardSelected: { backgroundColor: COLORS.limeDim, borderColor: COLORS.lime },
  envIcon: { fontSize: 28, marginBottom: 8 },
  envLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  error: { fontSize: 13, color: COLORS.red, textAlign: 'center', marginTop: 8 },
});
