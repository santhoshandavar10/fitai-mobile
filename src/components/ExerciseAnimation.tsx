import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Ellipse, Path } from 'react-native-svg';
import { COLORS } from '../constants/colors';

const AL  = Animated.createAnimatedComponent(Line);
const AC  = Animated.createAnimatedComponent(Circle);
const AE  = Animated.createAnimatedComponent(Ellipse);

type Category = 'squat' | 'hinge' | 'overhead' | 'push' | 'pull' | 'curl' | 'generic';

interface Pose {
  hcx: number; hcy: number;
  smx: number; smy: number;
  hmx: number; hmy: number;
  lsx: number; lsy: number; rsx: number; rsy: number;
  lex: number; ley: number; rex: number; rey: number;
  lwx: number; lwy: number; rwx: number; rwy: number;
  lhx: number; lhy: number; rhx: number; rhy: number;
  lkx: number; lky: number; rkx: number; rky: number;
  lfx: number; lfy: number; rfx: number; rfy: number;
}

// Standing neutral — 200×300 canvas
const STAND: Pose = {
  hcx: 100, hcy: 22,
  smx: 100, smy: 55,
  hmx: 100, hmy: 148,
  lsx: 68,  lsy: 62,  rsx: 132, rsy: 62,
  lex: 52,  ley: 110, rex: 148, rey: 110,
  lwx: 44,  lwy: 155, rwx: 156, rwy: 155,
  lhx: 80,  lhy: 148, rhx: 120, rhy: 148,
  lkx: 75,  lky: 210, rkx: 125, rky: 210,
  lfx: 70,  lfy: 278, rfx: 130, rfy: 278,
};

const POSES: Record<Category, [Pose, Pose]> = {
  squat: [
    STAND,
    {
      hcx: 100, hcy: 72,
      smx: 100, smy: 108,
      hmx: 100, hmy: 196,
      lsx: 68,  lsy: 116, rsx: 132, rsy: 116,
      lex: 38,  ley: 158, rex: 162, rey: 158,
      lwx: 30,  lwy: 190, rwx: 170, rwy: 190,
      lhx: 66,  lhy: 196, rhx: 134, rhy: 196,
      lkx: 38,  lky: 252, rkx: 162, rky: 252,
      lfx: 54,  lfy: 278, rfx: 146, rfy: 278,
    },
  ],
  hinge: [
    STAND,
    {
      hcx: 54,  hcy: 80,
      smx: 76,  smy: 112,
      hmx: 106, hmy: 148,
      lsx: 56,  lsy: 120, rsx: 96,  rsy: 104,
      lex: 42,  ley: 168, rex: 88,  rey: 152,
      lwx: 36,  lwy: 215, rwx: 82,  rwy: 200,
      lhx: 86,  lhy: 148, rhx: 122, rhy: 148,
      lkx: 75,  lky: 210, rkx: 125, rky: 210,
      lfx: 70,  lfy: 278, rfx: 130, rfy: 278,
    },
  ],
  overhead: [
    { ...STAND, lex: 42, ley: 76, rex: 158, rey: 76, lwx: 50, lwy: 48, rwx: 150, rwy: 48 },
    { ...STAND, lex: 56, ley: 26, rex: 144, rey: 26, lwx: 62, lwy: 8,  rwx: 138, rwy: 8  },
  ],
  push: [
    { ...STAND, lex: 38, ley: 88, rex: 162, rey: 88, lwx: 68, lwy: 72, rwx: 132, rwy: 72 },
    { ...STAND, lex: 50, ley: 44, rex: 150, rey: 44, lwx: 66, lwy: 26, rwx: 134, rwy: 26 },
  ],
  pull: [
    { ...STAND, lex: 48, ley: 20, rex: 152, rey: 20, lwx: 64, lwy: 6,  rwx: 136, rwy: 6  },
    { ...STAND, lex: 42, ley: 96, rex: 158, rey: 96, lwx: 76, lwy: 70, rwx: 124, rwy: 70 },
  ],
  curl: [
    STAND,
    { ...STAND, lex: 58, ley: 112, rex: 142, rey: 112, lwx: 62, lwy: 62, rwx: 138, rwy: 62 },
  ],
  generic: [
    STAND,
    { ...STAND, lex: 50, ley: 104, rex: 150, rey: 104, lwx: 44, lwy: 148, rwx: 156, rwy: 148 },
  ],
};

// Where to draw the muscle glow — [cx, cy] relative to the 200×300 canvas
const GLOW_POS: Record<Category, [number, number]> = {
  squat:    [100, 220],
  hinge:    [100, 148],
  overhead: [100,  62],
  push:     [100,  80],
  pull:     [100,  90],
  curl:     [100, 110],
  generic:  [100, 110],
};

function getCategory(name: string): Category {
  const n = name.toLowerCase();
  if (/squat|lunge|leg press|goblet|bulgarian/.test(n)) return 'squat';
  if (/deadlift|rdl|romanian|stiff.leg|good morning|bent.over|barbell row|db row|dumbbell row/.test(n)) return 'hinge';
  if (/overhead press|shoulder press|military press|ohp|arnold|lateral raise/.test(n)) return 'overhead';
  if (/bench press|push.up|chest press|chest fly|dip|cable fly|incline press|decline press/.test(n)) return 'push';
  if (/pull.up|chin.up|lat pull|pulldown|pull-down|cable row|seated row/.test(n)) return 'pull';
  if (/curl|bicep|hammer curl|preacher/.test(n)) return 'curl';
  return 'generic';
}

interface Props {
  exerciseName: string;
  muscle: string;
  /** If provided, this 0→1 value controls the pose directly (rep-synced mode) */
  animValue?: Animated.Value;
  compact?: boolean;
}

export default function ExerciseAnimation({ exerciseName, muscle, animValue, compact }: Props) {
  const cat = getCategory(exerciseName);
  const [p1, p2] = POSES[cat];
  const [glowX, glowY] = GLOW_POS[cat];

  const internalAnim = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;

  const anim = animValue ?? internalAnim;

  // Auto-loop when not externally controlled
  useEffect(() => {
    if (animValue) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(internalAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.delay(300),
        Animated.timing(internalAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => { loop.stop(); internalAnim.setValue(0); };
  }, [cat, animValue]);

  // Glow pulse — independent loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const lp = (f: number, t: number) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [f, t] });

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] });
  const glowRadius  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 38] });

  const isLeg  = cat === 'squat';
  const isBack = cat === 'hinge';
  const isArm  = !isLeg && !isBack;

  const LIME = COLORS.lime;
  const BODY = '#e8eaf0';       // skin-like off-white
  const BACK = 'rgba(180,184,200,0.45)'; // back-limb depth
  const TORSO_C = '#2a2f3d';   // dark torso fill

  const armC  = isArm  ? LIME : BODY;
  const legC  = isLeg  ? LIME : BODY;
  const armCb = isArm  ? 'rgba(200,255,0,0.3)' : BACK;
  const legCb = isLeg  ? 'rgba(200,255,0,0.3)' : BACK;

  const j = {
    hcx: lp(p1.hcx, p2.hcx), hcy: lp(p1.hcy, p2.hcy),
    smx: lp(p1.smx, p2.smx), smy: lp(p1.smy, p2.smy),
    hmx: lp(p1.hmx, p2.hmx), hmy: lp(p1.hmy, p2.hmy),
    lsx: lp(p1.lsx, p2.lsx), lsy: lp(p1.lsy, p2.lsy),
    rsx: lp(p1.rsx, p2.rsx), rsy: lp(p1.rsy, p2.rsy),
    lex: lp(p1.lex, p2.lex), ley: lp(p1.ley, p2.ley),
    rex: lp(p1.rex, p2.rex), rey: lp(p1.rey, p2.rey),
    lwx: lp(p1.lwx, p2.lwx), lwy: lp(p1.lwy, p2.lwy),
    rwx: lp(p1.rwx, p2.rwx), rwy: lp(p1.rwy, p2.rwy),
    lhx: lp(p1.lhx, p2.lhx), lhy: lp(p1.lhy, p2.lhy),
    rhx: lp(p1.rhx, p2.rhx), rhy: lp(p1.rhy, p2.rhy),
    lkx: lp(p1.lkx, p2.lkx), lky: lp(p1.lky, p2.lky),
    rkx: lp(p1.rkx, p2.rkx), rky: lp(p1.rky, p2.rky),
    lfx: lp(p1.lfx, p2.lfx), lfy: lp(p1.lfy, p2.lfy),
    rfx: lp(p1.rfx, p2.rfx), rfy: lp(p1.rfy, p2.rfy),
  };

  const h = compact ? 220 : 300;
  const scale = compact ? 0.73 : 1;

  return (
    <View style={[styles.svgWrap, compact && styles.svgWrapCompact]}>
      <Svg
        width={200 * scale}
        height={h}
        viewBox={`0 0 200 ${300}`}
      >
        {/* ── Glow on working muscle ── */}
        <AC
          cx={glowX}
          cy={glowY}
          r={glowRadius as any}
          fill={LIME}
          opacity={glowOpacity as any}
        />

        {/* ── BACK LIMBS (drawn behind) ── */}
        {/* Back leg - thigh + calf */}
        <AL x1={j.rhx} y1={j.rhy} x2={j.rkx} y2={j.rky} stroke={legCb} strokeWidth={18} strokeLinecap="round" />
        <AL x1={j.rkx} y1={j.rky} x2={j.rfx} y2={j.rfy} stroke={legCb} strokeWidth={13} strokeLinecap="round" />
        {/* Back arm - upper + fore */}
        <AL x1={j.rsx} y1={j.rsy} x2={j.rex} y2={j.rey} stroke={armCb} strokeWidth={14} strokeLinecap="round" />
        <AL x1={j.rex} y1={j.rey} x2={j.rwx} y2={j.rwy} stroke={armCb} strokeWidth={10} strokeLinecap="round" />
        {/* Back knee */}
        <AC cx={j.rkx} cy={j.rky} r={7} fill={legCb} />
        {/* Back elbow */}
        <AC cx={j.rex} cy={j.rey} r={6} fill={armCb} />

        {/* ── TORSO ── */}
        {/* Hip bar */}
        <AL x1={j.lhx} y1={j.lhy} x2={j.rhx} y2={j.rhy} stroke={BODY} strokeWidth={14} strokeLinecap="round" />
        {/* Spine / torso body */}
        <AL x1={j.smx} y1={j.smy} x2={j.hmx} y2={j.hmy} stroke={TORSO_C} strokeWidth={32} strokeLinecap="round" />
        <AL x1={j.smx} y1={j.smy} x2={j.hmx} y2={j.hmy} stroke={BODY} strokeWidth={20} strokeLinecap="round" />
        {/* Shoulder bar */}
        <AL x1={j.lsx} y1={j.lsy} x2={j.rsx} y2={j.rsy} stroke={BODY} strokeWidth={16} strokeLinecap="round" />

        {/* ── FRONT LIMBS ── */}
        {/* Front leg */}
        <AL x1={j.lhx} y1={j.lhy} x2={j.lkx} y2={j.lky} stroke={legC} strokeWidth={22} strokeLinecap="round" />
        <AL x1={j.lkx} y1={j.lky} x2={j.lfx} y2={j.lfy} stroke={legC} strokeWidth={16} strokeLinecap="round" />
        {/* Front arm */}
        <AL x1={j.lsx} y1={j.lsy} x2={j.lex} y2={j.ley} stroke={armC} strokeWidth={17} strokeLinecap="round" />
        <AL x1={j.lex} y1={j.ley} x2={j.lwx} y2={j.lwy} stroke={armC} strokeWidth={12} strokeLinecap="round" />
        {/* Front knee joint */}
        <AC cx={j.lkx} cy={j.lky} r={9} fill={legC} />
        {/* Front elbow joint */}
        <AC cx={j.lex} cy={j.ley} r={8} fill={armC} />
        {/* Hands */}
        <AC cx={j.lwx} cy={j.lwy} r={5} fill={armC} />
        <AC cx={j.rwx} cy={j.rwy} r={4} fill={armCb} />
        {/* Feet */}
        <AL x1={j.lfx} y1={j.lfy} x2={anim.interpolate({ inputRange:[0,1], outputRange:[p1.lfx+12, p2.lfx+12] })} y2={j.lfy} stroke={legC} strokeWidth={7} strokeLinecap="round" />

        {/* ── NECK ── */}
        <AL x1={j.hcx} y1={j.hcy} x2={j.smx} y2={j.smy} stroke={BODY} strokeWidth={12} strokeLinecap="round" />

        {/* ── HEAD ── */}
        {/* Shadow */}
        <AC cx={j.hcx} cy={j.hcy} r={22} fill="rgba(0,0,0,0.3)" />
        {/* Head fill */}
        <AC cx={j.hcx} cy={j.hcy} r={20} fill="#d4a574" />
        {/* Head outline */}
        <AC cx={j.hcx} cy={j.hcy} r={20} fill="none" stroke={BODY} strokeWidth={2} />
        {/* Eyes */}
        <AC
          cx={anim.interpolate({ inputRange:[0,1], outputRange:[p1.hcx - 7, p2.hcx - 7] })}
          cy={anim.interpolate({ inputRange:[0,1], outputRange:[p1.hcy + 1, p2.hcy + 1] })}
          r={3}
          fill="#1a1a2e"
        />
        <AC
          cx={anim.interpolate({ inputRange:[0,1], outputRange:[p1.hcx + 7, p2.hcx + 7] })}
          cy={anim.interpolate({ inputRange:[0,1], outputRange:[p1.hcy + 1, p2.hcy + 1] })}
          r={3}
          fill="#1a1a2e"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svgWrap: {
    width: 200,
    height: 300,
    alignSelf: 'center',
  },
  svgWrapCompact: {
    width: 146,
    height: 220,
  },
});
