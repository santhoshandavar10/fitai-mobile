import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { MUSCLE_COLORS } from '../../constants/mockData';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';
import ExerciseModal from '../../components/ExerciseModal';

interface Exercise {
  name: string;
  detail: string;
  muscle: string;
  sets: string;
  instructions: string;
}

interface DaySchedule {
  day: string;
  type: string;
  rest: boolean;
}

interface WorkoutPlan {
  body_assessment: string;
  body_fat_estimate: string;
  body_fat_category: string;
  weeks_to_goal: number;
  milestone_4wk: string;
  milestone_8wk: string;
  week_schedule: DaySchedule[];
  workouts: Record<string, Exercise[]>;
}

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export default function WorkoutScreen() {
  const selectedExercise = useAppStore((s) => s.selectedExercise);
  const setSelectedExercise = useAppStore((s) => s.setSelectedExercise);
  const showToast = useAppStore((s) => s.showToast);
  const hideToast = useAppStore((s) => s.hideToast);

  interface WorkoutLog {
    id: string;
    workout_type: string;
    exercises_completed: number;
    exercises_total: number;
    logged_at: string;
  }

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [planGenFailed, setPlanGenFailed] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [logged, setLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [history, setHistory] = useState<WorkoutLog[]>([]);

  const todayIndex = new Date().getDay();

  const fetchPlan = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [planRes, historyRes] = await Promise.all([
      supabase.from('workout_plans').select('plan').eq('user_id', user.id).maybeSingle(),
      supabase.from('workout_logs').select('*').eq('user_id', user.id)
        .order('logged_at', { ascending: false }).limit(10),
    ]);
    if (planRes.data?.plan) setPlan(planRes.data.plan as WorkoutPlan);
    if (historyRes.data) setHistory(historyRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // Poll every 6s until plan arrives; give up after 90s
  useEffect(() => {
    if (plan || loading) return;
    setPlanGenFailed(false);
    let elapsed = 0;
    const id = setInterval(async () => {
      elapsed += 6;
      if (elapsed >= 90) { clearInterval(id); setPlanGenFailed(true); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('workout_plans').select('plan').eq('user_id', user.id).maybeSingle();
      if (data?.plan) { setPlan(data.plan as WorkoutPlan); clearInterval(id); }
    }, 6000);
    return () => clearInterval(id);
  }, [plan, loading]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setPlanGenFailed(false);
    setRegenError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session — please log out and back in');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-body`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(`${res.status}: ${result.error ?? JSON.stringify(result)}`);
      await fetchPlan();
      showToast('Plan generated!');
      setTimeout(hideToast, 2500);
    } catch (e: any) {
      setRegenError(e.message ?? 'Unknown error');
      setPlanGenFailed(true);
    } finally {
      setRegenerating(false);
    }
  };

  const weekSchedule = plan?.week_schedule ?? [];
  const selectedDayKey = DAY_KEYS[selectedDay];
  const selectedSchedule = weekSchedule.find((d) => d.day === selectedDayKey);
  const isRest = selectedSchedule?.rest ?? false;
  const dayType = isRest ? null : (selectedSchedule?.type ?? null);
  const exercises: Exercise[] = plan && dayType ? (plan.workouts[dayType] ?? []) : [];

  // Reset completed state when day or plan changes
  useEffect(() => {
    setCompleted(new Array(exercises.length).fill(false));
    setLogged(false);
  }, [selectedDay, plan]);

  const toggleExercise = (i: number) => {
    setCompleted((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const doneCount = completed.filter(Boolean).length;
  const allDone = exercises.length > 0 && doneCount === exercises.length;

  const handleLogWorkout = async () => {
    if (!dayType || exercises.length === 0) return;
    setLogging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('workout_logs').insert({
        user_id: user.id,
        workout_type: dayType,
        exercises_completed: doneCount,
        exercises_total: exercises.length,
        logged_at: new Date().toISOString(),
      });
      setLogged(true);
      showToast('Workout logged!');
      setTimeout(hideToast, 2500);
    } catch {
      // silent fail
    } finally {
      setLogging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['rgba(247,88,85,0.08)', 'transparent']} style={styles.header}>
          <View style={styles.headerRow2}>
            <View>
              <Text style={styles.heading}>Workout</Text>
              <Text style={styles.subheading}>{DAY_FULL[todayIndex]}</Text>
            </View>
            <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerate} disabled={regenerating}>
              {regenerating
                ? <ActivityIndicator size="small" color={COLORS.lime} />
                : <Text style={styles.regenBtnText}>↺ Regenerate</Text>}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
          <View style={styles.weekRow}>
            {DAY_KEYS.map((key, i) => {
              const sched = weekSchedule.find((d) => d.day === key);
              const isSelected = selectedDay === i;
              const isToday = i === todayIndex;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDay(i)}
                  style={[styles.dayPill, isSelected && styles.dayPillSelected, sched?.rest && styles.dayPillRest]}
                >
                  {isToday && <View style={styles.todayDot} />}
                  <Text style={[styles.dayKey, isSelected && styles.dayKeySelected]}>{key}</Text>
                  <Text style={[styles.dayType, isSelected && styles.dayTypeSelected, sched?.rest && styles.dayTypeRest]}>
                    {sched?.rest ? 'Rest' : (sched?.type ?? '—')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* AI Coach Report */}
        {plan?.body_assessment ? (
          <View style={styles.assessmentCard}>
            <Text style={styles.assessmentLabel}>AI COACH REPORT</Text>

            {/* Body fat + target date row */}
            {plan.body_fat_estimate ? (
              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{plan.body_fat_estimate}</Text>
                  <Text style={styles.metricLabel}>Body Fat</Text>
                  {plan.body_fat_category ? (
                    <Text style={styles.metricSub}>{plan.body_fat_category}</Text>
                  ) : null}
                </View>
                {plan.weeks_to_goal ? (
                  <View style={styles.metricBox}>
                    <Text style={styles.metricValue}>
                      {new Date(Date.now() + plan.weeks_to_goal * 7 * 24 * 60 * 60 * 1000)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={styles.metricLabel}>Est. Goal Date</Text>
                    <Text style={styles.metricSub}>if consistent</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Milestones */}
            {plan.milestone_4wk ? (
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneDot}><Text style={styles.milestoneDotText}>4W</Text></View>
                <Text style={styles.milestoneText}>{plan.milestone_4wk}</Text>
              </View>
            ) : null}
            {plan.milestone_8wk ? (
              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneDot, { backgroundColor: COLORS.orange + '22' }]}>
                  <Text style={[styles.milestoneDotText, { color: COLORS.orange }]}>8W</Text>
                </View>
                <Text style={styles.milestoneText}>{plan.milestone_8wk}</Text>
              </View>
            ) : null}

            {/* Assessment paragraph */}
            <View style={styles.assessmentDivider} />
            <Text style={styles.assessmentText}>{plan.body_assessment}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.lime} />
          </View>
        ) : !plan ? (
          <View style={styles.center}>
            {planGenFailed ? (
              <>
                <Text style={styles.emptyTitle}>Generation failed</Text>
                <Text style={styles.emptyDesc}>Tap retry to try again.</Text>
                {regenError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>{regenError}</Text></View> : null}
                <TouchableOpacity
                  style={[styles.logBtn, { marginTop: 16, marginHorizontal: 0, paddingHorizontal: 28 }]}
                  onPress={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating
                    ? <ActivityIndicator color={COLORS.black} size="small" />
                    : <Text style={styles.logBtnText}>Retry — Generate My Plan</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator color={COLORS.lime} size="large" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>Building your plan...</Text>
                <Text style={styles.emptyDesc}>AI is analyzing your body and creating your personalized program. Takes ~30 seconds.</Text>
              </>
            )}
          </View>
        ) : isRest ? (
          <Card style={styles.restCard}>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restDesc}>Recovery is part of the process. Stretch, hydrate, sleep 8 hours.</Text>
          </Card>
        ) : exercises.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyDesc}>No exercises found for this day.</Text>
          </View>
        ) : (
          <>
            <View style={styles.dayHeader}>
              <View>
                <Text style={styles.dayTitle}>{dayType} Day</Text>
                <Text style={styles.dayMeta}>{exercises.length} exercises · ~55 min</Text>
              </View>
              <View style={styles.progressPill}>
                <Text style={[styles.progressText, allDone && { color: COLORS.lime }]}>
                  {doneCount}/{exercises.length}
                </Text>
              </View>
            </View>

            <View style={styles.exerciseList}>
              {exercises.map((ex, i) => {
                const muscleColor = MUSCLE_COLORS[ex.muscle] || COLORS.lime;
                const isDone = completed[i];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}
                    onPress={() => toggleExercise(i)}
                    onLongPress={() => setSelectedExercise(i)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.muscleStripe, { backgroundColor: muscleColor }]} />
                    <View style={styles.exerciseBody}>
                      <View style={styles.exerciseTop}>
                        <View style={[styles.checkCircle, isDone && styles.checkCircleDone]}>
                          {isDone && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                        <Text style={[styles.exerciseName, isDone && styles.exerciseNameDone]}>{ex.name}</Text>
                        <View style={[styles.muscleTag, { backgroundColor: muscleColor + '15' }]}>
                          <Text style={[styles.muscleTagText, { color: muscleColor }]}>{ex.muscle}</Text>
                        </View>
                      </View>
                      <Text style={styles.exerciseDetail}>{ex.detail}</Text>
                    </View>
                    <TouchableOpacity style={styles.infoBtn} onPress={() => setSelectedExercise(i)}>
                      <Text style={styles.infoBtnText}>›</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Log workout button */}
            {selectedDay === todayIndex && (
              <TouchableOpacity
                style={[
                  styles.logBtn,
                  (!allDone || logged) && styles.logBtnDisabled,
                ]}
                onPress={handleLogWorkout}
                disabled={!allDone || logged || logging}
              >
                {logging ? (
                  <ActivityIndicator color={COLORS.black} size="small" />
                ) : (
                  <Text style={styles.logBtnText}>
                    {logged ? 'Workout Logged' : allDone ? 'Log Workout' : `Complete all ${exercises.length} exercises to log`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Recent workouts history */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>RECENT WORKOUTS</Text>
            {history.map((log) => {
              const date = new Date(log.logged_at);
              const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const pct = log.exercises_total > 0 ? Math.round((log.exercises_completed / log.exercises_total) * 100) : 0;
              return (
                <View key={log.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyType}>{log.workout_type}</Text>
                    <Text style={styles.historyDate}>{label}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={[styles.historyPct, pct === 100 && { color: COLORS.lime }]}>{pct}%</Text>
                    <Text style={styles.historyMeta}>{log.exercises_completed}/{log.exercises_total} done</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ExerciseModal
        exercises={exercises}
        exerciseIndex={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        onVerified={(idx, verified) => {
          if (verified) {
            setCompleted((prev) => {
              const next = [...prev];
              next[idx] = true;
              return next;
            });
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  heading: { fontSize: 32, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5 },
  subheading: { fontSize: 13, color: COLORS.text3, marginTop: 2 },
  assessmentCard: {
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: 'rgba(200,255,0,0.12)',
    borderRadius: 16, padding: 16,
  },
  assessmentLabel: { fontSize: 9, fontWeight: '700', color: COLORS.lime, letterSpacing: 1.5, marginBottom: 6 },
  assessmentText: { fontSize: 13, color: COLORS.text2, lineHeight: 20 },
  weekScroll: { marginBottom: 8 },
  weekRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingVertical: 4 },
  dayPill: {
    backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    alignItems: 'center', minWidth: 52, position: 'relative',
  },
  dayPillSelected: { backgroundColor: COLORS.limeDim, borderColor: COLORS.lime },
  dayPillRest: { opacity: 0.45 },
  todayDot: {
    position: 'absolute', top: 5, right: 5,
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.lime,
  },
  dayKey: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1 },
  dayKeySelected: { color: COLORS.lime },
  dayType: { fontSize: 9, color: COLORS.text3, marginTop: 3 },
  dayTypeSelected: { color: COLORS.lime },
  dayTypeRest: { fontStyle: 'italic' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 },
  dayTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  dayMeta: { fontSize: 12, color: COLORS.text3, marginTop: 3 },
  progressPill: { backgroundColor: COLORS.surface2, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  progressText: { fontSize: 13, fontWeight: '700', color: COLORS.text3 },
  center: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.text3, textAlign: 'center', lineHeight: 20 },
  restCard: { marginHorizontal: 22, paddingVertical: 32, alignItems: 'center' },
  restTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', marginBottom: 8 },
  restDesc: { fontSize: 13, color: COLORS.text2, textAlign: 'center', lineHeight: 20 },
  exerciseList: { paddingHorizontal: 22, gap: 8 },
  exerciseCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  exerciseCardDone: { borderColor: COLORS.lime + '40', backgroundColor: '#05120a' },
  muscleStripe: { width: 3, alignSelf: 'stretch' },
  exerciseBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: COLORS.lime, borderColor: COLORS.lime },
  checkMark: { fontSize: 11, color: COLORS.black, fontWeight: '900' },
  exerciseName: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  exerciseNameDone: { color: COLORS.text3 },
  exerciseDetail: { fontSize: 11, color: COLORS.text3, marginLeft: 32 },
  muscleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  muscleTagText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  infoBtnText: { fontSize: 22, color: COLORS.text3 },
  logBtn: {
    marginHorizontal: 22, marginTop: 20, height: 52, backgroundColor: COLORS.lime,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  logBtnDisabled: { backgroundColor: COLORS.surface2 },
  logBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  historySection: { paddingHorizontal: 22, marginTop: 28 },
  historyTitle: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, marginBottom: 10 },
  historyCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  historyLeft: { flex: 1 },
  historyType: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  historyDate: { fontSize: 11, color: COLORS.text3, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyPct: { fontSize: 16, fontWeight: '800', color: COLORS.text2 },
  historyMeta: { fontSize: 10, color: COLORS.text3, marginTop: 2 },
  headerRow2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regenBtn: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 40, alignItems: 'center' },
  regenBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.lime },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricBox: { flex: 1, backgroundColor: COLORS.surface2, borderRadius: 12, padding: 12 },
  metricValue: { fontSize: 16, fontWeight: '900', color: COLORS.lime, marginBottom: 2 },
  metricLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1 },
  metricSub: { fontSize: 9, color: COLORS.text3, marginTop: 2, fontStyle: 'italic' },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  milestoneDot: { backgroundColor: COLORS.limeDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, minWidth: 30, alignItems: 'center' },
  milestoneDotText: { fontSize: 9, fontWeight: '900', color: COLORS.lime, letterSpacing: 0.5 },
  milestoneText: { flex: 1, fontSize: 12, color: COLORS.text2, lineHeight: 18 },
  assessmentDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  errorBox: { backgroundColor: '#2a0a0a', borderWidth: 1, borderColor: '#ff4444', borderRadius: 10, padding: 12, marginTop: 10, width: '100%' },
  errorBoxText: { fontSize: 12, color: '#ff6666', lineHeight: 18 },
});
