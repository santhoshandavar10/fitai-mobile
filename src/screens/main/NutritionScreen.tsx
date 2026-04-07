import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Image, Platform, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';
import Button from '../../components/Button';

interface LoggedMeal {
  id: string;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  score: string;
  score_color: string;
  image_path: string | null;
  logged_at: string;
}

interface PendingMeal {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  score: string;
  score_color: string;
  imagePath: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

async function callEdgeFunction(name: string, body: object) {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[callEdgeFunction] user:', user?.id, 'email:', user?.email);
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[callEdgeFunction] token:', session?.access_token?.slice(0, 40));
  const token = session?.access_token;
  if (!token) throw new Error('No session — please log out and back in');
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[callEdgeFunction] status:', res.status, 'data:', JSON.stringify(data).slice(0, 200));
    return data;
  } catch (e: any) {
    console.error('[callEdgeFunction] fetch threw:', e.message);
    throw new Error(`Network error: ${e.message}`);
  }
}

// Compute personalized macro targets from profile + body fat estimate
function computeTargets(profile: any, bodyFatEstimate: string | null) {
  const weight = profile?.weight_kg ?? 80;
  const height = profile?.height_cm ?? 175;
  const age    = profile?.age ?? 25;
  const gender = profile?.gender ?? 0; // 0=Male,1=Female,2=Other
  const goal   = profile?.goal ?? 0;   // 0=Muscle Gain,1=Fat Loss,2=Body Recomp,3=Endurance
  const env    = profile?.environment ?? 0; // 0=Gym,1=Home

  // Mifflin-St Jeor BMR
  const bmrBase = (10 * weight) + (6.25 * height) - (5 * age);
  const bmr = gender === 1 ? bmrBase - 161 : bmrBase + 5;

  // Activity multiplier
  const activityMult = env === 1 ? 1.375 : 1.55;
  const tdee = bmr * activityMult;

  // Parse body fat % from string like "18–22%" or "20-25%"
  let bfPct = 20;
  if (bodyFatEstimate) {
    const nums = bodyFatEstimate.match(/\d+/g);
    if (nums && nums.length >= 2) bfPct = (parseInt(nums[0]) + parseInt(nums[1])) / 2;
    else if (nums && nums.length === 1) bfPct = parseInt(nums[0]);
  }

  // Lean body mass in kg
  const lbm = weight * (1 - bfPct / 100);

  // Calorie target by goal
  const calMap = [tdee * 1.1, tdee * 0.83, tdee, tdee * 1.1]; // Muscle,Fat Loss,Recomp,Endurance
  const calories = Math.round(calMap[goal] ?? tdee);

  // Protein: higher for leaner / muscle gain; 2–2.4g per kg LBM
  const proteinMultMap = [2.2, 2.4, 2.0, 1.6];
  const protein = Math.round((proteinMultMap[goal] ?? 2.0) * lbm);
  const proteinCals = protein * 4;

  // Fat: 25–30% of calories
  const fatPctMap = [0.25, 0.30, 0.27, 0.22];
  const fat = Math.round((calories * (fatPctMap[goal] ?? 0.25)) / 9);
  const fatCals = fat * 9;

  // Carbs: remainder
  const carbs = Math.max(Math.round((calories - proteinCals - fatCals) / 4), 50);

  return { calories, protein, carbs, fat };
}

export default function NutritionScreen() {
  const [meals, setMeals]               = useState<LoggedMeal[]>([]);
  const [targets, setTargets]           = useState({ calories: 2500, protein: 180, carbs: 300, fat: 75 });
  const [analyzing, setAnalyzing]       = useState(false);
  const [pendingMeal, setPendingMeal]   = useState<PendingMeal | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [logError, setLogError]         = useState('');
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [foodText, setFoodText]         = useState('');
  const [textAnalyzing, setTextAnalyzing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [mealRes, profileRes, workoutRes] = await Promise.all([
      supabase.from('meal_logs').select('*').eq('user_id', user.id)
        .gte('logged_at', today.toISOString()).order('logged_at', { ascending: false }),
      supabase.from('profiles').select('age, weight_kg, height_cm, gender, goal, environment').eq('id', user.id).single(),
      supabase.from('workout_plans').select('plan').eq('user_id', user.id).single(),
    ]);

    if (mealRes.data) setMeals(mealRes.data);

    const profile = profileRes.data;
    const workoutPlan = (workoutRes as any)?.data?.plan;

    // Prefer AI-computed macros from body analysis; fall back to formula
    if (workoutPlan?.daily_calories) {
      setTargets({
        calories: workoutPlan.daily_calories,
        protein:  workoutPlan.daily_protein_g ?? 180,
        carbs:    workoutPlan.daily_carbs_g   ?? 250,
        fat:      workoutPlan.daily_fat_g     ?? 70,
      });
    } else {
      setTargets(computeTargets(profile, workoutPlan?.body_fat_estimate ?? null));
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogManual = async () => {
    const desc = foodText.trim();
    if (!desc) return;
    setTextAnalyzing(true);
    setLogError('');
    try {
      const result = await callEdgeFunction('analyze-food', { textDescription: desc });
      console.log('[analyze-food text] response:', JSON.stringify(result));
      if (result?.error) throw new Error(result.error);
      if (!result?.nutrition) throw new Error('Raw: ' + JSON.stringify(result));
      setTextModalVisible(false);
      setFoodText('');
      setLocalImageUri(null);
      setPendingMeal({ ...result.nutrition, imagePath: '' });
      setModalVisible(true);
    } catch (err: any) {
      setLogError(err.message);
    } finally {
      setTextAnalyzing(false);
    }
  };

  const handleLogMeal = async () => {
    setLogError('');
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setLocalImageUri(asset.uri);
    setAnalyzing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const mime = blob.type || 'image/jpeg';
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const imagePath = `${user.id}/${Date.now()}.${ext}`;
      supabase.storage.from('food-photos').upload(imagePath, blob, { upsert: false, contentType: `image/${ext}` });

      const json = await callEdgeFunction('analyze-food', { imageData: base64, mimeType: blob.type || 'image/jpeg' });
      if (json?.error) throw new Error(json.error);
      if (!json?.nutrition) throw new Error('Raw response: ' + JSON.stringify(json));

      setPendingMeal({ ...json.nutrition, imagePath });
      setModalVisible(true);
    } catch (err: any) {
      setLogError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmLog = async () => {
    if (!pendingMeal) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: newMeal, error } = await supabase.from('meal_logs').insert({
        user_id:     user.id,
        name:        pendingMeal.name,
        description: pendingMeal.description,
        calories:    Math.round(pendingMeal.calories),
        protein_g:   pendingMeal.protein_g,
        carbs_g:     pendingMeal.carbs_g,
        fat_g:       pendingMeal.fat_g,
        score:       pendingMeal.score,
        score_color: pendingMeal.score_color,
        image_path:  pendingMeal.imagePath,
      }).select().single();

      if (error) throw error;
      if (newMeal) setMeals(prev => [newMeal, ...prev]);
      setModalVisible(false); setPendingMeal(null); setLocalImageUri(null);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Totals
  const cals    = meals.reduce((s, m) => s + m.calories, 0);
  const protein = meals.reduce((s, m) => s + Number(m.protein_g), 0);
  const carbs   = meals.reduce((s, m) => s + Number(m.carbs_g), 0);
  const fat     = meals.reduce((s, m) => s + Number(m.fat_g), 0);
  const remaining = Math.max(targets.calories - cals, 0);

  const macros = [
    { label: 'Protein', value: Math.round(protein), target: targets.protein, unit: 'g', color: COLORS.red },
    { label: 'Carbs',   value: Math.round(carbs),   target: targets.carbs,   unit: 'g', color: COLORS.cyan },
    { label: 'Fat',     value: Math.round(fat),      target: targets.fat,     unit: 'g', color: COLORS.orange },
  ];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Nutrition</Text>

        {/* Calorie ring + macro bars */}
        <Card style={styles.calorieCard}>
          <View style={styles.calorieTop}>
            {/* Ring */}
            <View style={styles.ringWrap}>
              <View style={styles.ringOuter}>
                <View style={[styles.ringFill, {
                  borderColor: COLORS.lime,
                  opacity: Math.min(cals / targets.calories, 1),
                }]} />
                <View style={styles.ringCenter}>
                  <Text style={styles.ringNum}>{cals.toLocaleString()}</Text>
                  <Text style={styles.ringLabel}>kcal</Text>
                </View>
              </View>
            </View>

            {/* Right stats */}
            <View style={styles.calStats}>
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>TARGET</Text>
                <Text style={styles.calStatValue}>{targets.calories.toLocaleString()}</Text>
              </View>
              <View style={styles.calDivider} />
              <View style={styles.calStatRow}>
                <Text style={styles.calStatLabel}>REMAINING</Text>
                <Text style={[styles.calStatValue, { color: remaining === 0 ? COLORS.lime : COLORS.text }]}>
                  {remaining.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Macro bars */}
          <View style={styles.macroRows}>
            {macros.map((m) => (
              <View key={m.label} style={styles.macroRow}>
                <Text style={styles.macroLabel}>{m.label}</Text>
                <View style={styles.macroBarWrap}>
                  <View style={styles.macroBar}>
                    <View style={[styles.macroBarFill, {
                      backgroundColor: m.color,
                      width: `${Math.min((m.value / m.target) * 100, 100)}%`,
                    }]} />
                  </View>
                </View>
                <Text style={[styles.macroVal, { color: m.color }]}>
                  {m.value}<Text style={styles.macroTarget}>/{m.target}{m.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Track meals CTA */}
        <View style={styles.trackPrompt}>
          <Text style={styles.trackPromptTitle}>Track every meal to hit your targets</Text>
          <Text style={styles.trackPromptSub}>Snap a photo of what you eat — AI identifies calories, protein, carbs & fat instantly.</Text>
        </View>

        <View style={styles.addMealRow}>
          <TouchableOpacity
            style={[styles.addMealBtn, styles.addMealBtnPrimary, analyzing && styles.addMealBtnDisabled]}
            onPress={handleLogMeal}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color={COLORS.black} size="small" />
            ) : (
              <Text style={styles.addMealIcon}>📸</Text>
            )}
            <Text style={styles.addMealText}>{analyzing ? 'Analyzing...' : 'Scan Meal'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addMealBtn, styles.addMealBtnSecondary]}
            onPress={() => { setLogError(''); setTextModalVisible(true); }}
          >
            <Text style={styles.addMealIcon}>✏️</Text>
            <Text style={[styles.addMealText, { color: COLORS.text }]}>Log Manually</Text>
          </TouchableOpacity>
        </View>
        {logError ? <Text style={styles.logError}>{logError}</Text> : null}

        {/* Today's log */}
        <Text style={styles.sectionTitle}>TODAY'S LOG</Text>
        <View style={styles.mealList}>
          {meals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No meals logged yet</Text>
              <Text style={styles.emptySubtext}>Scan a photo to log your first meal</Text>
            </View>
          ) : (
            meals.map((meal) => (
              <Card key={meal.id} style={styles.mealCard}>
                <View style={styles.mealRow}>
                  <View style={styles.mealLeft}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealMacros}>
                      <Text style={{ color: COLORS.red }}>{Math.round(Number(meal.protein_g))}p</Text>
                      {'  '}
                      <Text style={{ color: COLORS.cyan }}>{Math.round(Number(meal.carbs_g))}c</Text>
                      {'  '}
                      <Text style={{ color: COLORS.orange }}>{Math.round(Number(meal.fat_g))}f</Text>
                    </Text>
                    <Text style={styles.mealTime}>{formatTime(meal.logged_at)}</Text>
                  </View>
                  <View style={styles.mealRight}>
                    <Text style={styles.mealCals}>{meal.calories}</Text>
                    <Text style={styles.mealCalsUnit}>kcal</Text>
                    <View style={[styles.scoreBadge, { backgroundColor: meal.score_color + '20' }]}>
                      <Text style={[styles.scoreText, { color: meal.score_color }]}>{meal.score}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Manual Food Entry Modal */}
      <Modal visible={textModalVisible} transparent animationType="slide" onRequestClose={() => setTextModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.mealNameLarge}>Log Manually</Text>
            <Text style={styles.mealDescLarge}>Describe what you ate — quantities, cooking method, any extras.</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 5 egg whites with 1 oil spray and spinach"
              placeholderTextColor={COLORS.text3}
              value={foodText}
              onChangeText={setFoodText}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <Button
              title={textAnalyzing ? 'Calculating...' : 'Calculate Macros'}
              onPress={handleLogManual}
              disabled={textAnalyzing || !foodText.trim()}
              style={{ marginTop: 16 }}
            />
            <Button title="Cancel" variant="ghost" onPress={() => { setTextModalVisible(false); setFoodText(''); }} style={{ marginTop: 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {localImageUri && (
                <Image source={{ uri: localImageUri }} style={styles.foodImage} />
              )}
              {pendingMeal && (
                <>
                  <Text style={styles.mealNameLarge}>{pendingMeal.name}</Text>
                  <Text style={styles.mealDescLarge}>{pendingMeal.description}</Text>
                  <View style={styles.nutritionGrid}>
                    {[
                      { label: 'Calories', value: Math.round(pendingMeal.calories), unit: 'kcal', color: COLORS.lime },
                      { label: 'Protein',  value: Math.round(pendingMeal.protein_g), unit: 'g',    color: COLORS.red },
                      { label: 'Carbs',    value: Math.round(pendingMeal.carbs_g),   unit: 'g',    color: COLORS.cyan },
                      { label: 'Fat',      value: Math.round(pendingMeal.fat_g),     unit: 'g',    color: COLORS.orange },
                    ].map((n, i) => (
                      <View key={i} style={styles.nutritionItem}>
                        <Text style={[styles.nutritionValue, { color: n.color }]}>{n.value}</Text>
                        <Text style={styles.nutritionUnit}>{n.unit}</Text>
                        <Text style={styles.nutritionLabel}>{n.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.scoreBadgeLarge}>
                    <View style={[styles.scoreCircle, { backgroundColor: pendingMeal.score_color + '20', borderColor: pendingMeal.score_color + '40' }]}>
                      <Text style={[styles.scoreLetter, { color: pendingMeal.score_color }]}>{pendingMeal.score}</Text>
                    </View>
                    <Text style={styles.scoreCaption}>Health Score</Text>
                  </View>
                </>
              )}
            </ScrollView>
            <Button title={saving ? 'Saving...' : 'Log This Meal'} onPress={handleConfirmLog} disabled={saving} style={{ marginTop: 16 }} />
            <Button title="Discard" variant="ghost" onPress={() => { setModalVisible(false); setPendingMeal(null); setLocalImageUri(null); }} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, paddingHorizontal: 22, paddingTop: 12, marginBottom: 20 },

  // Calorie card
  calorieCard: { marginHorizontal: 22 },
  calorieTop: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: { width: 96, height: 96, borderRadius: 48, borderWidth: 6, borderColor: COLORS.surface3, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringFill: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 6 },
  ringCenter: { alignItems: 'center' },
  ringNum: { fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  ringLabel: { fontSize: 9, color: COLORS.text3, fontWeight: '700', letterSpacing: 1 },
  calStats: { flex: 1, gap: 10 },
  calStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calStatLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5 },
  calStatValue: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  calDivider: { height: 1, backgroundColor: COLORS.border },

  // Macro bars
  macroRows: { gap: 10 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macroLabel: { fontSize: 11, fontWeight: '700', color: COLORS.text3, width: 52 },
  macroBarWrap: { flex: 1 },
  macroBar: { height: 6, backgroundColor: COLORS.surface3, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },
  macroVal: { fontSize: 12, fontWeight: '800', width: 80, textAlign: 'right' },
  macroTarget: { fontSize: 10, color: COLORS.text3, fontWeight: '500' },

  // Add meal
  addMealRow: { flexDirection: 'row', marginHorizontal: 22, marginTop: 16, gap: 10 },
  addMealBtn: {
    flex: 1, height: 56, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addMealBtnPrimary: { backgroundColor: COLORS.lime },
  addMealBtnSecondary: { backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border },
  addMealBtnDisabled: { opacity: 0.6 },
  addMealIcon: { fontSize: 18 },
  addMealText: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  logError: { fontSize: 12, color: COLORS.red, marginHorizontal: 22, marginTop: 8, textAlign: 'center' },
  textInput: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    color: COLORS.text, fontSize: 14, lineHeight: 22,
    borderWidth: 1.5, borderColor: COLORS.border, minHeight: 90,
    textAlignVertical: 'top',
  },

  // Meal list
  sectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, paddingHorizontal: 22, marginTop: 24, marginBottom: 12 },
  mealList: { paddingHorizontal: 22, gap: 10 },
  mealCard: { padding: 16 },
  mealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  mealLeft: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  mealMacros: { fontSize: 12, marginBottom: 4 },
  mealTime: { fontSize: 11, color: COLORS.text3 },
  mealRight: { alignItems: 'flex-end' },
  mealCals: { fontSize: 20, fontWeight: '900', color: COLORS.text, lineHeight: 22 },
  mealCalsUnit: { fontSize: 10, color: COLORS.text3, marginBottom: 4 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  scoreText: { fontSize: 11, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.text2 },
  emptySubtext: { fontSize: 13, color: COLORS.text3, marginTop: 6 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: COLORS.surface3, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  foodImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 20, backgroundColor: COLORS.surface2 },
  mealNameLarge: { fontSize: 24, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, marginBottom: 4 },
  mealDescLarge: { fontSize: 13, color: COLORS.text2, marginBottom: 20, lineHeight: 20 },
  nutritionGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  nutritionItem: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, alignItems: 'center' },
  nutritionValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  nutritionUnit: { fontSize: 11, color: COLORS.text3, marginTop: 1 },
  nutritionLabel: { fontSize: 10, color: COLORS.text3, marginTop: 4 },
  scoreBadgeLarge: { alignItems: 'center', marginBottom: 8 },
  scoreCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  scoreLetter: { fontSize: 24, fontWeight: '900' },
  scoreCaption: { fontSize: 11, color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1 },
  trackPrompt: { marginHorizontal: 22, marginTop: 16, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  trackPromptTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  trackPromptSub: { fontSize: 12, color: COLORS.text2, lineHeight: 18 },
});
