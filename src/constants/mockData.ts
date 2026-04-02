import { COLORS } from './colors';

// ─── Muscle colors ─────────────────────────────────────────
export const MUSCLE_COLORS: Record<string, string> = {
  Chest: COLORS.red,
  Shoulders: COLORS.orange,
  Triceps: COLORS.purple,
  Back: COLORS.cyan,
  Legs: COLORS.lime,
};

// ─── Week schedule ─────────────────────────────────────────
export interface WeekDay {
  day: string;
  type: string;
  active: boolean;
  rest: boolean;
}

export const WEEK_DAYS: WeekDay[] = [
  { day: 'MON', type: 'Pull', active: false, rest: false },
  { day: 'TUE', type: 'Legs', active: false, rest: false },
  { day: 'WED', type: 'REST', active: false, rest: true },
  { day: 'THU', type: 'Pull', active: false, rest: false },
  { day: 'FRI', type: 'Arms', active: false, rest: false },
  { day: 'SAT', type: 'Push', active: true, rest: false },
  { day: 'SUN', type: 'REST', active: false, rest: true },
];

// ─── Meals ─────────────────────────────────────────────────
export interface Meal {
  emoji: string;
  name: string;
  desc: string;
  cals: number;
  score: string;
  scoreColor: string;
}

export const MEALS: Meal[] = [
  { emoji: '🥣', name: 'Breakfast · 7:30 AM', desc: 'Oats · eggs · banana', cals: 480, score: 'A', scoreColor: COLORS.lime },
  { emoji: '🍗', name: 'Lunch · 12:45 PM', desc: 'Chicken · rice · broccoli', cals: 720, score: 'A', scoreColor: COLORS.lime },
  { emoji: '🥤', name: 'Snack · 3:15 PM', desc: 'Protein shake · almonds', cals: 340, score: 'B+', scoreColor: COLORS.cyan },
];

// ─── Groceries ─────────────────────────────────────────────
export interface GroceryItem {
  emoji: string;
  name: string;
  qty: string;
  checked: boolean;
}

export const GROCERIES: GroceryItem[] = [
  { emoji: '🐔', name: 'Chicken breast', qty: '2 kg', checked: false },
  { emoji: '🥚', name: 'Eggs', qty: '24 pc', checked: true },
  { emoji: '🍚', name: 'Brown rice', qty: '1 kg', checked: true },
  { emoji: '🥦', name: 'Broccoli', qty: '500 g', checked: false },
  { emoji: '🍌', name: 'Bananas', qty: '12 pc', checked: false },
  { emoji: '🥛', name: 'Greek yogurt', qty: '1.5 kg', checked: true },
  { emoji: '🐟', name: 'Salmon fillet', qty: '600 g', checked: false },
  { emoji: '🥜', name: 'Peanut butter', qty: '500 g', checked: false },
];

// ─── Exercises ─────────────────────────────────────────────
export interface Exercise {
  name: string;
  detail: string;
  muscle: string;
  sets: string;
  instructions: string;
}

export const GYM_EXERCISES: Exercise[] = [
  { name: 'Bench Press', detail: '4 × 8 reps · 80kg · 90s rest', muscle: 'Chest', sets: '4 sets × 8 reps · 75% 1RM', instructions: 'Lie flat on bench. Lower bar to chest, press explosively. Keep shoulder blades retracted throughout.' },
  { name: 'Overhead Press', detail: '3 × 10 reps · 60kg · 90s rest', muscle: 'Shoulders', sets: '3 sets × 10 reps · 70% 1RM', instructions: 'Stand with bar at collarbone. Press overhead until lockout. Control the descent.' },
  { name: 'Incline DB Press', detail: '3 × 12 reps · 20kg · 60s rest', muscle: 'Chest', sets: '3 sets × 12 reps · 20kg DBs', instructions: 'Bench at 30-45°. Press dumbbells from chest. Full stretch at bottom.' },
  { name: 'Lateral Raises', detail: '4 × 15 reps · 12kg · 45s rest', muscle: 'Shoulders', sets: '4 sets × 15 reps · 12kg', instructions: 'Arms slightly bent. Raise to shoulder height. 2-second hold at top.' },
  { name: 'Tricep Pushdowns', detail: '3 × 15 reps · Cable · 45s rest', muscle: 'Triceps', sets: '3 sets × 15 reps · Cable', instructions: 'Elbows locked at sides. Push rope down to full extension. Squeeze at bottom.' },
];

export const HOME_EXERCISES: Exercise[] = [
  { name: 'Push-Up Variations', detail: '4 × 15 reps · Bodyweight · 60s rest', muscle: 'Chest', sets: '4 sets × 15 reps', instructions: 'Wide grip, close grip, and diamond variations. Keep core tight throughout. Full range of motion.' },
  { name: 'Pike Push-Ups', detail: '3 × 12 reps · Bodyweight · 60s rest', muscle: 'Shoulders', sets: '3 sets × 12 reps', instructions: 'Hips high in pike position. Lower head toward floor. Press back up. Targets shoulders heavily.' },
  { name: 'Chair Dips', detail: '3 × 15 reps · Bodyweight · 45s rest', muscle: 'Triceps', sets: '3 sets × 15 reps', instructions: 'Hands on chair edge, lower body until arms at 90°. Press back up. Keep elbows tucked.' },
  { name: 'Diamond Push-Ups', detail: '3 × 10 reps · Slow neg · 45s rest', muscle: 'Chest', sets: '3 sets × 10 reps', instructions: 'Hands in diamond shape under chest. Slow 3-second descent. Isolates triceps and inner chest.' },
];

// ─── Dashboard exercises ───────────────────────────────────
export const DASHBOARD_EXERCISES = ['Bench Press', 'Overhead Press', 'Cable Flies', 'Lateral Raises', 'Tricep Pushdowns'];
export const DASHBOARD_SETS = ['4×8', '3×10', '3×15', '4×15', '3×15'];

// ─── Goals ─────────────────────────────────────────────────
export interface Goal {
  icon: string;
  name: string;
  desc: string;
}

export const GOALS: Goal[] = [
  { icon: '', name: 'Muscle Gain', desc: 'Build lean mass' },
  { icon: '', name: 'Fat Loss', desc: 'Cut body fat' },
  { icon: '', name: 'Recomp', desc: 'Both at once' },
  { icon: '', name: 'Endurance', desc: 'Stamina & cardio' },
];

// ─── Features for onboarding ──────────────────────────────
export const FEATURES = [
  { icon: '', text: 'AI body analysis + personalized plans' },
  { icon: '', text: 'Encrypted body data, seen only by AI' },
  { icon: '', text: '$10 accountability system that works' },
  { icon: '', text: 'Workout form analysis via video AI' },
];

// ─── Body measurements ────────────────────────────────────
export interface BodyMeasurement {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export const BODY_MEASUREMENTS: BodyMeasurement[] = [
  { label: 'Weight', value: '87 kg', change: '-4 kg', positive: true },
  { label: 'Body Fat', value: '18.2%', change: '-2.1%', positive: true },
  { label: 'Muscle Mass', value: '34.6 kg', change: '+1.8 kg', positive: true },
  { label: 'Chest', value: '104 cm', change: '+2 cm', positive: true },
  { label: 'Waist', value: '82 cm', change: '-3 cm', positive: true },
  { label: 'Arms', value: '38 cm', change: '+1.5 cm', positive: true },
];
