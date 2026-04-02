import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing, Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/colors';
import { GYM_EXERCISES, MUSCLE_COLORS } from '../constants/mockData';
import ExerciseAnimation from './ExerciseAnimation';

const ACircle = Animated.createAnimatedComponent(Circle);

interface Exercise {
  name: string; detail: string; muscle: string; sets: string; instructions: string;
}
interface ExerciseModalProps {
  exerciseIndex: number | null;
  onClose: () => void;
  exercises?: Exercise[];
  onVerified?: (exerciseIndex: number, verified: boolean) => void;
}
type Phase = 'guide' | 'workout' | 'rest' | 'complete';
type MotionState = 'idle' | 'active' | 'paused';

const RING_R    = 54;
const RING_CIRC = 2 * Math.PI * RING_R;
const SAMPLE_MS      = 120;
const MOTION_HIGH    = 0.012;
const MOTION_LOW     = 0.006;
const MIN_REP_GAP_MS = 700;

function parseSetsReps(str: string): { sets: number; reps: number; rest: number } {
  const cross = str.match(/(\d+)\s*[×x]\s*(\d+)/i);
  const sets  = str.match(/(\d+)\s*sets?/i);
  const reps  = str.match(/(\d+)\s*reps?/i);
  const rest  = str.match(/(\d+)\s*s\s*rest/i);
  return {
    sets: cross ? parseInt(cross[1]) : sets ? parseInt(sets[1]) : 3,
    reps: cross ? parseInt(cross[2]) : reps ? parseInt(reps[1]) : 10,
    rest: rest  ? parseInt(rest[1])  : 60,
  };
}

export default function ExerciseModal({
  exerciseIndex, onClose, exercises: propExercises, onVerified,
}: ExerciseModalProps) {
  const exerciseList = propExercises ?? GYM_EXERCISES;

  const [phase, setPhase]             = useState<Phase>('guide');
  const [currentSet, setCurrentSet]   = useState(1);
  const [restSeconds, setRestSeconds] = useState(60);

  // Camera rep counting
  const [camMode, setCamMode]         = useState(false);
  const [repCount, setRepCount]       = useState(0);
  const [motionLevel, setMotionLevel] = useState(0); // 0–1 for the indicator bar

  const restAnim        = useRef(new Animated.Value(0)).current;
  const restTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const videoElRef      = useRef<HTMLVideoElement | null>(null);
  const camContRef      = useRef<any>(null);
  const offCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef    = useRef<ImageData | null>(null);
  const motionStateRef  = useRef<MotionState>('idle');
  const halfRepsRef     = useRef(0);
  const lastRepTimeRef  = useRef(0);
  const repCountRef     = useRef(0); // mirror of repCount for use inside intervals
  const targetRepsRef   = useRef(10);

  const exercise = exerciseIndex !== null ? exerciseList[exerciseIndex] : null;
  const { sets: totalSets, reps: targetReps, rest: restDuration } =
    exercise ? parseSetsReps(exercise.sets) : { sets: 3, reps: 10, rest: 60 };

  useEffect(() => { targetRepsRef.current = targetReps; }, [targetReps]);

  // ── Reset on exercise change ─────────────────────────────────────────────
  useEffect(() => {
    setPhase('guide');
    setCurrentSet(1);
    setRepCount(0);
    repCountRef.current = 0;
    setCamMode(false);
    restAnim.setValue(0);
    stopCamera();
    if (restTimerRef.current) clearInterval(restTimerRef.current);
  }, [exerciseIndex]);

  useEffect(() => () => { stopCamera(); if (restTimerRef.current) clearInterval(restTimerRef.current); }, []);

  // ── Camera + motion detection ────────────────────────────────────────────
  const stopCamera = () => {
    if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoElRef.current) { videoElRef.current.srcObject = null; videoElRef.current = null; }
    prevFrameRef.current = null;
    motionStateRef.current = 'idle';
    halfRepsRef.current = 0;
  };

  const startCamera = async () => {
    if (Platform.OS !== 'web') return;
    try {
      const stream = await (navigator as any).mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.style.cssText = 'width:100%;height:220px;object-fit:cover;border-radius:16px;display:block;background:#000';
      videoElRef.current = video;

      setTimeout(() => {
        const container = camContRef.current;
        if (!container) return;
        const node: HTMLElement | null =
          typeof container.getDOMNode === 'function' ? container.getDOMNode() : (container as any);
        if (node) { node.innerHTML = ''; node.appendChild(video); }
      }, 80);

      // Small offscreen canvas for fast pixel diff
      const oc = document.createElement('canvas');
      oc.width = 80; oc.height = 60;
      offCanvasRef.current = oc;

      // Reset counters
      repCountRef.current = 0;
      setRepCount(0);
      halfRepsRef.current = 0;
      motionStateRef.current = 'idle';
      lastRepTimeRef.current = 0;

      setCamMode(true);
      sampleTimerRef.current = setInterval(sampleFrame, SAMPLE_MS);
    } catch {
      // camera denied — stay in manual mode
    }
  };

  const sampleFrame = () => {
    const video = videoElRef.current;
    const oc = offCanvasRef.current;
    if (!video || !oc || video.readyState < 2) return;

    const ctx = oc.getContext('2d')!;
    ctx.drawImage(video, 0, 0, oc.width, oc.height);
    const curr = ctx.getImageData(0, 0, oc.width, oc.height);

    if (prevFrameRef.current) {
      const motion = computeMotion(prevFrameRef.current, curr);
      setMotionLevel(Math.min(motion / MOTION_HIGH, 1));
      updateMotionState(motion);
    }
    prevFrameRef.current = curr;
  };

  const computeMotion = (prev: ImageData, curr: ImageData): number => {
    let diff = 0;
    const d = prev.data;
    const c = curr.data;
    const len = d.length;
    for (let i = 0; i < len; i += 16) diff += Math.abs(c[i] - d[i]);
    return (diff / (len / 16)) / 255;
  };

  const updateMotionState = (motion: number) => {
    const state = motionStateRef.current;
    const now = Date.now();

    if (state === 'idle' || state === 'paused') {
      if (motion > MOTION_HIGH) {
        motionStateRef.current = 'active';
      }
    } else if (state === 'active') {
      if (motion < MOTION_LOW) {
        motionStateRef.current = 'paused';
        halfRepsRef.current += 1;
        // Every 2 half-reps (down+up) = 1 full rep
        if (halfRepsRef.current >= 2 && now - lastRepTimeRef.current > MIN_REP_GAP_MS) {
          halfRepsRef.current = 0;
          lastRepTimeRef.current = now;
          const next = repCountRef.current + 1;
          repCountRef.current = next;
          setRepCount(next);
        }
      }
    }
  };

  // Auto-advance when camera counts enough reps
  useEffect(() => {
    if (camMode && repCount >= targetReps) {
      stopCamera();
      setCamMode(false);
      if (currentSet >= totalSets) setPhase('complete');
      else startRest();
    }
  }, [repCount, camMode, targetReps, currentSet, totalSets]);

  // ── Rest timer ───────────────────────────────────────────────────────────
  const beginNextSet = useCallback(() => {
    const next = currentSet + 1;
    if (next > totalSets) { setPhase('complete'); }
    else {
      setCurrentSet(next);
      setRepCount(0); repCountRef.current = 0;
      restAnim.setValue(0);
      setPhase('workout');
    }
  }, [currentSet, totalSets]);

  const startRest = useCallback(() => {
    stopCamera(); setCamMode(false);
    setPhase('rest');
    setRestSeconds(restDuration);
    restAnim.setValue(0);
    Animated.timing(restAnim, { toValue: 1, duration: restDuration * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    let secs = restDuration;
    restTimerRef.current = setInterval(() => {
      secs -= 1; setRestSeconds(secs);
      if (secs <= 0) { clearInterval(restTimerRef.current!); beginNextSet(); }
    }, 1000);
  }, [restDuration, beginNextSet]);

  const skipRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restAnim.stopAnimation();
    beginNextSet();
  };

  const handleSetDone = () => {
    stopCamera(); setCamMode(false);
    if (currentSet >= totalSets) setPhase('complete');
    else startRest();
  };

  const handleMarkDone = () => { stopCamera(); setCamMode(false); setPhase('complete'); };

  useEffect(() => {
    if (phase === 'complete' && onVerified && exerciseIndex !== null) onVerified(exerciseIndex, true);
  }, [phase]);

  const handleClose = () => {
    stopCamera();
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restAnim.stopAnimation();
    onClose();
  };

  if (exerciseIndex === null || !exercise) return null;
  const muscleColor = MUSCLE_COLORS[exercise.muscle] || COLORS.lime;
  const restRingOffset = restAnim.interpolate({ inputRange: [0, 1], outputRange: [RING_CIRC, 0] });
  const repProgress = Math.min(repCount / targetReps, 1);
  const isWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!(navigator as any).mediaDevices;

  return (
    <Modal visible={exerciseIndex !== null} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── COMPLETE ── */}
          {phase === 'complete' ? (
            <View style={styles.completeWrap}>
              <View style={styles.completeIcon}><Text style={styles.completeIconText}>✓</Text></View>
              <Text style={styles.completeTitle}>Exercise Done!</Text>
              <Text style={styles.completeStats}>{totalSets} sets · {targetReps} reps each</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

          ) : phase === 'rest' ? (
            /* ── REST ── */
            <View style={styles.restWrap}>
              <Text style={styles.restLabel}>REST</Text>
              <View style={styles.restRingWrap}>
                <Svg width={140} height={140}>
                  <Circle cx={70} cy={70} r={RING_R} stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" />
                  <ACircle cx={70} cy={70} r={RING_R} stroke={COLORS.lime} strokeWidth={6} fill="none"
                    strokeDasharray={RING_CIRC} strokeDashoffset={restRingOffset as any}
                    strokeLinecap="round" transform="rotate(-90 70 70)" />
                </Svg>
                <View style={styles.restCenter}>
                  <Text style={styles.restSeconds}>{restSeconds}</Text>
                  <Text style={styles.restSLabel}>seconds</Text>
                </View>
              </View>
              <Text style={styles.restNextLabel}>Next: Set {currentSet + 1} of {totalSets} · {targetReps} reps</Text>
              <TouchableOpacity style={styles.skipBtn} onPress={skipRest}>
                <Text style={styles.skipBtnText}>Skip Rest</Text>
              </TouchableOpacity>
            </View>

          ) : (
            /* ── GUIDE / WORKOUT ── */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.muscleTag, { backgroundColor: muscleColor + '22' }]}>
                    <Text style={[styles.muscleText, { color: muscleColor }]}>{exercise.muscle}</Text>
                  </View>
                  <Text style={styles.title}>{exercise.name}</Text>
                </View>
                {phase === 'workout' && (
                  <View style={styles.setBadge}>
                    <Text style={styles.setBadgeNum}>{currentSet}</Text>
                    <Text style={styles.setBadgeOf}>/{totalSets}</Text>
                  </View>
                )}
              </View>

              {phase === 'workout' && (
                <View style={styles.setDots}>
                  {Array.from({ length: totalSets }).map((_, i) => (
                    <View key={i} style={[styles.setDot, i < currentSet - 1 && styles.setDotDone, i === currentSet - 1 && styles.setDotActive]} />
                  ))}
                  <Text style={styles.setDotsLabel}>SET {currentSet} OF {totalSets}</Text>
                </View>
              )}

              {/* ── CAMERA MODE ── */}
              {phase === 'workout' && camMode ? (
                <View style={styles.camSection}>
                  {/* Live feed */}
                  <View ref={camContRef} style={styles.camBox} />

                  {/* Rep counter overlay */}
                  <View style={styles.repOverlay}>
                    <Text style={styles.repOverlayCount}>{repCount}</Text>
                    <Text style={styles.repOverlaySlash}>/{targetReps}</Text>
                  </View>

                  {/* Rep progress ring */}
                  <View style={styles.repRingRow}>
                    <Svg width={64} height={64}>
                      <Circle cx={32} cy={32} r={26} stroke="rgba(255,255,255,0.08)" strokeWidth={4} fill="none" />
                      <Circle cx={32} cy={32} r={26}
                        stroke={COLORS.lime} strokeWidth={4} fill="none"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - repProgress)}
                        strokeLinecap="round" transform="rotate(-90 32 32)" />
                    </Svg>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.motionLabel}>MOTION</Text>
                      <View style={styles.motionBarBg}>
                        <View style={[styles.motionBarFill, { width: `${motionLevel * 100}%` as any }]} />
                      </View>
                      <Text style={styles.motionHint}>
                        {motionLevel > 0.5 ? 'Moving...' : motionLevel > 0.2 ? 'Keep going' : 'Start your rep'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.setDoneBtn} onPress={handleSetDone}>
                    <Text style={styles.setDoneBtnText}>
                      {currentSet >= totalSets ? 'Finish Exercise' : 'Done — Next Set'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stopCamBtn} onPress={() => { stopCamera(); setCamMode(false); }}>
                    <Text style={styles.stopCamText}>Stop camera</Text>
                  </TouchableOpacity>
                </View>

              ) : phase === 'workout' ? (
                /* ── MANUAL WORKOUT (no camera) ── */
                <View style={styles.workoutSection}>
                  <ExerciseAnimation exerciseName={exercise.name} muscle={exercise.muscle} compact />

                  <View style={styles.repTargetCard}>
                    <Text style={styles.repTargetNum}>{targetReps}</Text>
                    <Text style={styles.repTargetLabel}>reps</Text>
                  </View>

                  <Text style={styles.workoutHint}>Follow the animation · complete your {targetReps} reps</Text>

                  {isWeb && (
                    <TouchableOpacity style={styles.camBtn} onPress={startCamera} activeOpacity={0.85}>
                      <Text style={styles.camBtnIcon}>⬤</Text>
                      <Text style={styles.camBtnText}>Count reps with camera</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.setDoneBtn} onPress={handleSetDone}>
                    <Text style={styles.setDoneBtnText}>
                      {currentSet >= totalSets ? 'Finish Exercise' : 'Done — Rest & Next Set'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipSetBtn} onPress={handleMarkDone}>
                    <Text style={styles.skipSetText}>Mark all complete</Text>
                  </TouchableOpacity>
                </View>

              ) : (
                /* ── GUIDE ── */
                <>
                  <ExerciseAnimation exerciseName={exercise.name} muscle={exercise.muscle} />

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>SETS & REPS</Text>
                    <Text style={styles.infoValue}>{exercise.sets}</Text>
                  </View>
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>HOW TO PERFORM</Text>
                    {exercise.instructions.split('. ').filter(Boolean).map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                        <Text style={styles.stepText}>{step.replace(/\.$/, '')}.</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.startBtn} onPress={() => { setRepCount(0); repCountRef.current = 0; setPhase('workout'); }} activeOpacity={0.85}>
                    <Text style={styles.startBtnText}>Start — Set 1 of {totalSets}</Text>
                    <Text style={styles.startBtnSub}>{targetReps} reps · use camera or track manually</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipSetupBtn} onPress={handleMarkDone}>
                    <Text style={styles.skipSetupText}>Already done — mark complete</Text>
                  </TouchableOpacity>
                </>
              )}

            </ScrollView>
          )}

          {phase !== 'complete' && phase !== 'rest' && (
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, maxHeight: '95%' },
  scroll: { paddingBottom: 8 },
  handle: { width: 36, height: 4, backgroundColor: COLORS.surface3, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  muscleTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, marginBottom: 6 },
  muscleText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5 },
  setBadge: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  setBadgeNum: { fontSize: 36, fontWeight: '900', color: COLORS.lime, lineHeight: 38 },
  setBadgeOf: { fontSize: 16, fontWeight: '700', color: COLORS.text3 },

  setDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  setDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surface3 },
  setDotDone: { backgroundColor: COLORS.lime + '60' },
  setDotActive: { backgroundColor: COLORS.lime, width: 20 },
  setDotsLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, marginLeft: 4 },

  // Camera mode
  camSection: { gap: 14 },
  camBox: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
  repOverlay: {
    flexDirection: 'row', alignItems: 'baseline',
    position: 'absolute', top: 12, right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  repOverlayCount: { fontSize: 40, fontWeight: '900', color: COLORS.lime, lineHeight: 44 },
  repOverlaySlash: { fontSize: 16, fontWeight: '700', color: 'rgba(200,255,0,0.55)' },
  repRingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  motionLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, marginBottom: 6 },
  motionBarBg: { height: 6, borderRadius: 3, backgroundColor: COLORS.surface3, overflow: 'hidden', marginBottom: 6 },
  motionBarFill: { height: '100%', backgroundColor: COLORS.lime, borderRadius: 3 },
  motionHint: { fontSize: 11, color: COLORS.text3 },
  stopCamBtn: { alignItems: 'center', paddingVertical: 6 },
  stopCamText: { fontSize: 12, color: COLORS.text3, textDecorationLine: 'underline' },

  // Camera start button
  camBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.lime + '50', borderRadius: 14,
    paddingVertical: 13, backgroundColor: COLORS.limeDim, width: '100%',
  },
  camBtnIcon: { fontSize: 10, color: COLORS.red },
  camBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.lime },

  // Manual workout
  workoutSection: { alignItems: 'center', gap: 14, paddingTop: 4 },
  repTargetCard: { flexDirection: 'row', alignItems: 'baseline', gap: 6, backgroundColor: COLORS.limeDim, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.lime + '30' },
  repTargetNum: { fontSize: 52, fontWeight: '900', color: COLORS.lime, lineHeight: 56 },
  repTargetLabel: { fontSize: 20, fontWeight: '700', color: COLORS.lime + 'aa' },
  workoutHint: { fontSize: 13, color: COLORS.text3, textAlign: 'center' },
  setDoneBtn: { width: '100%', backgroundColor: COLORS.lime, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  setDoneBtnText: { fontSize: 16, fontWeight: '900', color: COLORS.black },
  skipSetBtn: { paddingVertical: 6 },
  skipSetText: { fontSize: 12, color: COLORS.text3, textDecorationLine: 'underline' },

  // Guide
  infoBlock: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  infoLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  infoValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.surface3, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 10, fontWeight: '800', color: COLORS.lime },
  stepText: { fontSize: 13, color: COLORS.text2, lineHeight: 20, flex: 1 },
  startBtn: { backgroundColor: COLORS.lime, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 10 },
  startBtnText: { fontSize: 16, fontWeight: '900', color: COLORS.black },
  startBtnSub: { fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 3 },
  skipSetupBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  skipSetupText: { fontSize: 12, color: COLORS.text3, textDecorationLine: 'underline' },

  // Rest
  restWrap: { alignItems: 'center', paddingVertical: 24 },
  restLabel: { fontSize: 11, fontWeight: '800', color: COLORS.text3, letterSpacing: 3, marginBottom: 24 },
  restRingWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  restCenter: { position: 'absolute', alignItems: 'center' },
  restSeconds: { fontSize: 48, fontWeight: '900', color: COLORS.text, lineHeight: 52 },
  restSLabel: { fontSize: 11, color: COLORS.text3 },
  restNextLabel: { fontSize: 13, color: COLORS.text2, marginBottom: 20 },
  skipBtn: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  skipBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text2 },

  // Complete
  completeWrap: { alignItems: 'center', paddingVertical: 36 },
  completeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  completeIconText: { fontSize: 32, fontWeight: '900', color: COLORS.black },
  completeTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  completeStats: { fontSize: 13, color: COLORS.text3, marginBottom: 32 },
  doneBtn: { backgroundColor: COLORS.lime, borderRadius: 14, paddingHorizontal: 48, paddingVertical: 16 },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.black },

  closeBtn: { marginTop: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: COLORS.text3 },
});
