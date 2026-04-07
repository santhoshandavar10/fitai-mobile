import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';
import Toast from '../../components/Toast';

const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const WORKOUT_COLORS: Record<string, string> = {
  Push:       COLORS.orange,
  Pull:       COLORS.cyan,
  Legs:       COLORS.purple,
  Arms:       COLORS.lime,
  Core:       '#FF6B9D',
  Cardio:     '#00D4FF',
  Full:       COLORS.lime,
  REST:       COLORS.text3,
};

interface Exercise { name: string; detail: string; muscle: string; sets: string; }
interface WorkoutDay { day: string; type: string; rest: boolean; }
interface Profile { name: string | null; weight_kg: number | null; goal: number | null; accountability_enabled: boolean | null; }

function CalorieRing({ percent }: { percent: number }) {
  const size = 108;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(percent / 100, 1);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F75855" />
          <Stop offset="1" stopColor="#FF8C42" />
        </SvgGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="url(#ringGrad)"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function DashboardScreen() {
  const showToast = useAppStore((s) => s.showToast);
  const hideToast = useAppStore((s) => s.hideToast);
  const toastMessage = useAppStore((s) => s.toastMessage);
  const toastVisible = useAppStore((s) => s.toastVisible);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedExercises, setCompletedExercises] = useState<boolean[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(2500);
  const [proteinTarget, setProteinTarget] = useState(180);
  const [todayType, setTodayType] = useState<string | null>(null);
  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dayIndex = today.getDay();
  const todayShort = DAY_SHORT[dayIndex];
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const profileRes = await supabase.from('profiles')
        .select('name, weight_kg, goal, accountability_enabled')
        .eq('id', user.id).single();

      const mealLogsRes = await supabase.from('meal_logs')
        .select('calories, protein_g')
        .eq('user_id', user.id)
        .gte('logged_at', todayStart.toISOString());

      const workoutPlanRes = await supabase.from('workout_plans')
        .select('plan')
        .eq('user_id', user.id).maybeSingle();

      const mealPlanRes = await supabase.from('meal_plans')
        .select('plan')
        .eq('user_id', user.id).maybeSingle();

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const workoutLogsRes = await supabase.from('workout_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('logged_at', weekStart.toISOString());

      const streakStart = new Date();
      streakStart.setDate(streakStart.getDate() - 60);
      const { data: streakLogs } = await supabase.from('workout_logs')
        .select('logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', streakStart.toISOString())
        .order('logged_at', { ascending: false });

      if (streakLogs) {
        const days = new Set(streakLogs.map(l => new Date(l.logged_at).toDateString()));
        let s = 0;
        const check = new Date();
        if (!days.has(check.toDateString())) check.setDate(check.getDate() - 1);
        while (days.has(check.toDateString())) { s++; check.setDate(check.getDate() - 1); }
        setStreak(s);
      }

      if (profileRes.data) setProfile(profileRes.data);
      if ((workoutLogsRes as any).count !== null) setWeeklyWorkouts((workoutLogsRes as any).count ?? 0);

      if (mealLogsRes.data) {
        setTodayCalories(mealLogsRes.data.reduce((s: number, m: any) => s + (m.calories ?? 0), 0));
        setTodayProtein(mealLogsRes.data.reduce((s: number, m: any) => s + Number(m.protein_g ?? 0), 0));
      }

      if ((mealPlanRes as any)?.data?.plan) {
        const p = (mealPlanRes as any).data.plan;
        if (p.daily_calories) setCalorieTarget(p.daily_calories);
        if (p.daily_protein_g) setProteinTarget(p.daily_protein_g);
      }

      if (workoutPlanRes.data?.plan) {
        const plan = workoutPlanRes.data.plan as any;
        const schedule: WorkoutDay[] = plan.week_schedule ?? [];
        const todaySchedule = schedule.find((d: WorkoutDay) => d.day === todayShort);
        if (todaySchedule && !todaySchedule.rest) {
          setTodayType(todaySchedule.type);
          const exercises: Exercise[] = plan.workouts?.[todaySchedule.type] ?? [];
          setTodayExercises(exercises);
          setCompletedExercises(new Array(exercises.length).fill(false));
        } else if (todaySchedule?.rest) {
          setTodayType('REST');
        }
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [todayShort]);

  useEffect(() => { load(); }, [load]);

  const toggleExercise = (i: number) => {
    setCompletedExercises((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      if (!prev[i]) { showToast('Exercise complete!'); setTimeout(hideToast, 2000); }
      return next;
    });
  };

  const doneCount = completedExercises.filter(Boolean).length;
  const caloriePercent = Math.min(Math.round((todayCalories / calorieTarget) * 100), 100);
  const remaining = Math.max(calorieTarget - todayCalories, 0);
  const userName = profile?.name?.split(' ')[0] ?? 'Athlete';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const workoutColor = todayType ? (WORKOUT_COLORS[todayType] ?? COLORS.lime) : COLORS.lime;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.lime} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <LinearGradient
          colors={['rgba(247,88,85,0.1)', 'transparent']}
          style={styles.heroGradient}
        >
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.greetingName}>{userName.toUpperCase()}</Text>
          {todayType && todayType !== 'REST' && (
            <View style={[styles.todayBadge, { backgroundColor: workoutColor + '18', borderColor: workoutColor + '40' }]}>
              <View style={[styles.todayDot, { backgroundColor: workoutColor }]} />
              <Text style={[styles.todayBadgeText, { color: workoutColor }]}>
                {todayType} Day · Let's crush it
              </Text>
            </View>
          )}
          {todayType === 'REST' && (
            <View style={[styles.todayBadge, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.todayBadgeText}>Rest & Recover Today</Text>
            </View>
          )}
        </LinearGradient>

        {/* Accountability badge */}
        {profile?.accountability_enabled && (() => {
          const needed = Math.max(3 - weeklyWorkouts, 0);
          const safe = weeklyWorkouts >= 3;
          return (
            <View style={[styles.accountBadge, safe ? styles.accountBadgeSafe : styles.accountBadgeRisk]}>
              <View style={[styles.accountDot, { backgroundColor: safe ? COLORS.lime : COLORS.red }]} />
              <Text style={[styles.accountBadgeText, { color: safe ? COLORS.lime : COLORS.red }]}>
                {safe ? `Safe this week · ${weeklyWorkouts}/3 workouts` : needed === 1 ? `1 workout away from $10 fee` : `${needed} workouts needed — $10 at risk`}
              </Text>
            </View>
          );
        })()}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={[styles.statPillValue, { color: COLORS.lime }]}>{weeklyWorkouts}</Text>
            <Text style={styles.statPillLabel}>Workouts{'\n'}this week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statPillValue, { color: streak > 0 ? COLORS.orange : COLORS.text3 }]}>{streak}</Text>
            <Text style={styles.statPillLabel}>Day{'\n'}streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statPillValue, { color: COLORS.cyan }]}>{caloriePercent}%</Text>
            <Text style={styles.statPillLabel}>Calorie{'\n'}goal</Text>
          </View>
        </View>

        {/* Calorie Card */}
        <Card style={styles.calorieCard}>
          <Text style={styles.cardLabel}>TODAY'S NUTRITION</Text>
          <View style={styles.calorieRow}>
            <View style={styles.ringWrap}>
              <CalorieRing percent={caloriePercent} />
              <View style={styles.ringCenter}>
                <Text style={styles.ringPercent}>{caloriePercent}%</Text>
                <Text style={styles.ringLabel}>FILLED</Text>
              </View>
            </View>
            <View style={styles.macroList}>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.lime }]} />
                <View>
                  <Text style={styles.macroValue}>{todayCalories.toLocaleString()} kcal</Text>
                  <Text style={styles.macroLabel}>Consumed</Text>
                </View>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.cyan }]} />
                <View>
                  <Text style={styles.macroValue}>{Math.round(todayProtein)}g</Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.text3 }]} />
                <View>
                  <Text style={styles.macroValue}>{remaining.toLocaleString()} kcal</Text>
                  <Text style={styles.macroLabel}>Remaining</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.targetRow}>
            <Text style={styles.targetText}>Target {calorieTarget.toLocaleString()} kcal · {proteinTarget}g protein</Text>
          </View>
        </Card>

        {/* Today's Workout */}
        {todayType === 'REST' ? (
          <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']} style={styles.restCard}>
            <Text style={styles.restEmoji}>🌙</Text>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restSub}>Recovery is where the gains happen. Stretch, hydrate, sleep 8 hours.</Text>
          </LinearGradient>
        ) : todayExercises.length > 0 ? (
          <View style={styles.workoutCard}>
            <LinearGradient
              colors={[workoutColor + '20', workoutColor + '05']}
              style={styles.workoutCardGradient}
            >
              <View style={[styles.workoutAccentBar, { backgroundColor: workoutColor }]} />
              <View style={styles.workoutHeader}>
                <View>
                  <Text style={styles.workoutTitle}>{todayType?.toUpperCase()} DAY</Text>
                  <Text style={styles.workoutSub}>{doneCount}/{todayExercises.length} exercises · today</Text>
                </View>
                <View style={[styles.workoutBadge, { backgroundColor: workoutColor + '25', borderColor: workoutColor + '50' }]}>
                  <Text style={[styles.workoutBadgeText, { color: workoutColor }]}>
                    {doneCount === todayExercises.length ? '✓ DONE' : `${doneCount}/${todayExercises.length}`}
                  </Text>
                </View>
              </View>
            </LinearGradient>
            <View style={styles.exerciseListWrap}>
              {todayExercises.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleExercise(i)}
                  style={[styles.exerciseRow, i < todayExercises.length - 1 && styles.exerciseRowBorder]}
                >
                  <View style={[styles.checkCircle, completedExercises[i] && { backgroundColor: workoutColor, borderColor: workoutColor }]}>
                    {completedExercises[i] && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, completedExercises[i] && styles.exerciseDoneText]}>{ex.name}</Text>
                    <Text style={styles.exerciseMuscle}>{ex.muscle}</Text>
                  </View>
                  <Text style={styles.exerciseSets}>{ex.sets}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <Card style={styles.noWorkoutCard}>
            <Text style={styles.noWorkoutTitle}>No Plan Yet</Text>
            <Text style={styles.noWorkoutText}>Complete your profile setup to generate your AI workout plan.</Text>
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Toast message={toastMessage} visible={toastVisible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  heroGradient: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },
  dateLabel: { fontSize: 11, color: COLORS.text3, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  greeting: { fontSize: 16, color: COLORS.text2, fontWeight: '500' },
  greetingName: { fontSize: 38, fontWeight: '900', color: COLORS.text, letterSpacing: -1, lineHeight: 40, marginBottom: 14 },
  todayBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  todayDot: { width: 6, height: 6, borderRadius: 3 },
  todayBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text2 },

  accountBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 22, marginBottom: 14, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  accountBadgeSafe: { backgroundColor: 'rgba(200,255,0,0.08)', borderColor: 'rgba(200,255,0,0.25)' },
  accountBadgeRisk: { backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.25)' },
  accountDot: { width: 6, height: 6, borderRadius: 3 },
  accountBadgeText: { fontSize: 12, fontWeight: '700' },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 22, marginBottom: 16, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  statPill: { flex: 1, alignItems: 'center', gap: 3 },
  statPillValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  statPillLabel: { fontSize: 9, color: COLORS.text3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 12 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  calorieCard: { marginHorizontal: 22, marginBottom: 14 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, marginBottom: 14 },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { position: 'relative', width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPercent: { fontSize: 22, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  ringLabel: { fontSize: 7, color: COLORS.text3, letterSpacing: 1 },
  macroList: { flex: 1, gap: 10 },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroValue: { fontSize: 15, fontWeight: '700', color: COLORS.text, lineHeight: 17 },
  macroLabel: { fontSize: 10, color: COLORS.text3 },
  targetRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  targetText: { fontSize: 11, color: COLORS.text3 },

  workoutCard: { marginHorizontal: 22, marginBottom: 14, backgroundColor: COLORS.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  workoutCardGradient: { position: 'relative', padding: 16 },
  workoutAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  workoutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutTitle: { fontSize: 19, fontWeight: '900', color: COLORS.text, letterSpacing: -0.3 },
  workoutSub: { fontSize: 11, color: COLORS.text3, marginTop: 3 },
  workoutBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  workoutBadgeText: { fontSize: 11, fontWeight: '800' },
  exerciseListWrap: {},
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  exerciseRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, color: COLORS.black, fontWeight: '900' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  exerciseMuscle: { fontSize: 10, color: COLORS.text3, marginTop: 1 },
  exerciseDoneText: { color: COLORS.text3, textDecorationLine: 'line-through' },
  exerciseSets: { fontSize: 11, color: COLORS.text2 },

  restCard: { marginHorizontal: 22, marginBottom: 14, borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  restEmoji: { fontSize: 36, marginBottom: 10 },
  restTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', marginBottom: 8 },
  restSub: { fontSize: 13, color: COLORS.text2, textAlign: 'center', lineHeight: 20 },

  noWorkoutCard: { marginHorizontal: 22, marginBottom: 14, alignItems: 'center', paddingVertical: 32 },
  noWorkoutTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  noWorkoutText: { fontSize: 13, color: COLORS.text3, textAlign: 'center', lineHeight: 20 },
});
