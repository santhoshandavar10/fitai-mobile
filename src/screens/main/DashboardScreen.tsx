import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';
import Toast from '../../components/Toast';

const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Exercise {
  name: string;
  detail: string;
  muscle: string;
  sets: string;
}

interface WorkoutDay {
  day: string;
  type: string;
  rest: boolean;
}

interface Profile {
  name: string | null;
  weight_kg: number | null;
  goal: number | null;
  accountability_enabled: boolean | null;
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
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Run queries individually so one failure doesn't block others
      const profileRes = await supabase.from('profiles')
        .select('name, weight_kg, goal, accountability_enabled')
        .eq('id', user.id).single();

      const mealLogsRes = await supabase.from('meal_logs')
        .select('calories, protein_g')
        .eq('user_id', user.id)
        .gte('logged_at', todayStart.toISOString());

      const workoutPlanRes = await supabase.from('workout_plans')
        .select('plan, body_assessment')
        .eq('user_id', user.id).single();

      // meal_plans may not exist yet — catch gracefully
      const mealPlanRes = await supabase.from('meal_plans')
        .select('plan')
        .eq('user_id', user.id).single().catch(() => ({ data: null }));

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const workoutLogsRes = await supabase.from('workout_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('logged_at', weekStart.toISOString())
        .catch(() => ({ count: 0 }));

      // Streak: fetch last 60 days of logs, count consecutive days with workouts
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
        // allow today or yesterday to start streak
        if (!days.has(check.toDateString())) check.setDate(check.getDate() - 1);
        while (days.has(check.toDateString())) {
          s++;
          check.setDate(check.getDate() - 1);
        }
        setStreak(s);
      }

      if (profileRes.data) setProfile(profileRes.data);
      if ((workoutLogsRes as any).count !== null) setWeeklyWorkouts((workoutLogsRes as any).count ?? 0);

      if (mealLogsRes.data) {
        const cals = mealLogsRes.data.reduce((s: number, m: any) => s + (m.calories ?? 0), 0);
        const prot = mealLogsRes.data.reduce((s: number, m: any) => s + Number(m.protein_g ?? 0), 0);
        setTodayCalories(cals);
        setTodayProtein(prot);
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
      const wasOff = !next[i];
      next[i] = !next[i];
      if (wasOff) {
        showToast('💪 Exercise complete!');
        setTimeout(hideToast, 2000);
      }
      return next;
    });
  };

  const doneCount = completedExercises.filter(Boolean).length;
  const caloriePercent = Math.min(Math.round((todayCalories / calorieTarget) * 100), 100);
  const remaining = Math.max(calorieTarget - todayCalories, 0);

  const userName = profile?.name?.split(' ')[0] ?? 'There';
  const greeting = dayIndex === 0 || dayIndex === 6 ? 'Rest well' : 'Let\'s go';

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.dayLabel}>{dateLabel}</Text>
          <Text style={styles.greeting}>
            {greeting},{'\n'}<Text style={styles.greetingAccent}>{userName}</Text>
          </Text>
          {profile?.accountability_enabled && (() => {
            const needed = Math.max(3 - weeklyWorkouts, 0);
            const safe = weeklyWorkouts >= 3;
            return (
              <View style={[styles.accountBadge, safe ? styles.accountBadgeSafe : styles.accountBadgeRisk]}>
                <View style={[styles.accountDot, { backgroundColor: safe ? COLORS.lime : COLORS.red }]} />
                <Text style={[styles.accountBadgeText, { color: safe ? COLORS.lime : COLORS.red }]}>
                  {safe
                    ? `Safe this week · ${weeklyWorkouts}/3 workouts`
                    : needed === 1
                    ? `1 workout away from $10 fee`
                    : `${needed} workouts needed — $10 at risk`}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Calorie Card */}
        <Card style={styles.calorieCard}>
          <Text style={styles.cardLabel}>TODAY'S NUTRITION</Text>
          <View style={styles.calorieRow}>
            <View style={styles.ringContainer}>
              <View style={styles.ringOuter}>
                <View style={styles.ringCenter}>
                  <Text style={styles.ringPercent}>{caloriePercent}%</Text>
                  <Text style={styles.ringLabel}>CALORIES</Text>
                </View>
              </View>
            </View>
            <View style={styles.calorieStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.lime }]}>{todayCalories.toLocaleString()}</Text>
                <Text style={styles.statLabel}>KCAL CONSUMED</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.red }]}>{Math.round(todayProtein)}g</Text>
                <Text style={styles.statLabel}>PROTEIN TODAY</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{remaining.toLocaleString()}</Text>
                <Text style={styles.statLabel}>KCAL REMAINING</Text>
              </View>
            </View>
          </View>
          <View style={styles.targetRow}>
            <Text style={styles.targetText}>Target: {calorieTarget.toLocaleString()} kcal · {proteinTarget}g protein</Text>
          </View>
        </Card>

        {/* Today's Workout */}
        {todayType === 'REST' ? (
          <Card style={styles.restCard}>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restSub}>Recovery is part of the plan. Stretch, hydrate, sleep well.</Text>
          </Card>
        ) : todayExercises.length > 0 ? (
          <Card style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <View>
                <Text style={styles.workoutTitle}>{todayType} Day · Today</Text>
                <Text style={styles.workoutSub}>{doneCount}/{todayExercises.length} EXERCISES DONE</Text>
              </View>
              <View style={[styles.workoutProgress, { backgroundColor: doneCount === todayExercises.length ? COLORS.limeDim : COLORS.surface3 }]}>
                <Text style={[styles.workoutProgressText, { color: doneCount === todayExercises.length ? COLORS.lime : COLORS.text3 }]}>
                  {doneCount === todayExercises.length ? '✓ DONE' : `${doneCount}/${todayExercises.length}`}
                </Text>
              </View>
            </View>
            {todayExercises.map((ex, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleExercise(i)}
                style={[styles.exerciseRow, i < todayExercises.length - 1 && styles.exerciseRowBorder]}
              >
                <View style={[styles.checkCircle, completedExercises[i] && styles.checkCircleDone]}>
                  {completedExercises[i] && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <View style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseName, completedExercises[i] && styles.exerciseDoneText]}>
                    {ex.name}
                  </Text>
                  <Text style={styles.exerciseMuscle}>{ex.muscle}</Text>
                </View>
                <Text style={styles.exerciseSets}>{ex.sets}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        ) : (
          <Card style={styles.noWorkoutCard}>
            <Text style={styles.noWorkoutText}>No workout plan yet. Complete onboarding to generate your AI plan.</Text>
          </Card>
        )}

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={[styles.bigStat, { color: COLORS.lime }]}>
              {weeklyWorkouts}<Text style={styles.bigStatUnit}>/wk</Text>
            </Text>
            <Text style={styles.statCardLabel}>Workouts{'\n'}This Week</Text>
            <View style={styles.miniBar}>
              <View style={[styles.miniBarFill, { width: `${Math.min((weeklyWorkouts / 6) * 100, 100)}%`, backgroundColor: COLORS.lime }]} />
            </View>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.bigStat, { color: streak > 0 ? COLORS.orange : COLORS.text }]}>
              {streak}<Text style={styles.bigStatUnit}>d</Text>
            </Text>
            <Text style={styles.statCardLabel}>Workout{'\n'}Streak</Text>
            <View style={styles.miniBar}>
              <View style={[styles.miniBarFill, { width: `${Math.min((streak / 30) * 100, 100)}%`, backgroundColor: COLORS.orange }]} />
            </View>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.bigStat, { color: COLORS.cyan }]}>
              {caloriePercent}<Text style={styles.bigStatUnit}>%</Text>
            </Text>
            <Text style={styles.statCardLabel}>Calorie{'\n'}Goal</Text>
          </Card>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Toast message={toastMessage} visible={toastVisible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 20 },
  dayLabel: { fontSize: 12, color: COLORS.text3, letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
  greeting: { fontSize: 36, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', lineHeight: 38 },
  greetingAccent: { color: COLORS.lime },
  accountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 12, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  accountBadgeSafe: { backgroundColor: 'rgba(200,255,0,0.08)', borderColor: 'rgba(200,255,0,0.25)' },
  accountBadgeRisk: { backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.25)' },
  accountDot: { width: 6, height: 6, borderRadius: 3 },
  accountBadgeText: { fontSize: 12, fontWeight: '700' },
  calorieCard: { marginHorizontal: 22 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, marginBottom: 12 },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringContainer: { width: 100, height: 100 },
  ringOuter: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenter: { alignItems: 'center' },
  ringPercent: { fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  ringLabel: { fontSize: 7, color: COLORS.text3, letterSpacing: 1 },
  calorieStats: { flex: 1 },
  statItem: { marginBottom: 12 },
  statValue: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5, lineHeight: 28 },
  statLabel: { fontSize: 9, color: COLORS.text3, letterSpacing: 1, marginTop: 2 },
  targetRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  targetText: { fontSize: 11, color: COLORS.text3 },
  workoutCard: { marginHorizontal: 22, marginTop: 14, padding: 0 },
  workoutHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  workoutTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  workoutSub: { fontSize: 10, color: COLORS.text3, marginTop: 2 },
  workoutProgress: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  workoutProgressText: { fontSize: 11, fontWeight: '700' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  exerciseRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: COLORS.lime, borderColor: COLORS.lime },
  checkMark: { fontSize: 12, color: COLORS.black, fontWeight: '900' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  exerciseMuscle: { fontSize: 10, color: COLORS.text3, marginTop: 1 },
  exerciseDoneText: { color: COLORS.text3, textDecorationLine: 'line-through' },
  exerciseSets: { fontSize: 11, color: COLORS.text2 },
  restCard: { marginHorizontal: 22, marginTop: 14, alignItems: 'center', paddingVertical: 28 },
  restIcon: { fontSize: 40, marginBottom: 10 },
  restTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase' },
  restSub: { fontSize: 13, color: COLORS.text2, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  noWorkoutCard: { marginHorizontal: 22, marginTop: 14 },
  noWorkoutText: { fontSize: 14, color: COLORS.text3, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 22, marginTop: 14 },
  statCard: { flex: 1, padding: 14 },
  bigStat: { fontSize: 24, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5, lineHeight: 26 },
  bigStatUnit: { fontSize: 13, color: COLORS.text3 },
  statCardLabel: { fontSize: 9, color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  miniBar: { height: 4, backgroundColor: COLORS.surface3, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  miniBarFill: { height: '100%', borderRadius: 2 },
  aiCard: {
    marginHorizontal: 22, marginTop: 14,
    backgroundColor: '#05120a', borderColor: 'rgba(200,255,0,0.15)',
  },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  aiBadge: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.lime,
    alignItems: 'center', justifyContent: 'center',
  },
  aiBadgeText: { fontSize: 13, fontWeight: '900', color: COLORS.black },
  aiLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(200,255,0,0.5)', letterSpacing: 1.5, marginBottom: 4 },
  aiText: { fontSize: 13, color: COLORS.text2, lineHeight: 20 },
});
