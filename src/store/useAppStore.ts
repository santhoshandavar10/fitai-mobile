import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AppState {
  // Auth session (managed by Supabase)
  session: Session | null;
  setSession: (session: Session | null) => void;

  // Onboarding complete flag (fetched from profiles table)
  isOnboarded: boolean;
  setIsOnboarded: (v: boolean) => void;

  // Subscription status (from RevenueCat entitlement / profiles table)
  isSubscribed: boolean;
  setIsSubscribed: (v: boolean) => void;

  // Pending onboarding step after payment redirect
  pendingOnboardingStep: string | null;
  setPendingOnboardingStep: (step: string | null) => void;

  // Workout tracking
  exerciseDone: boolean[];
  toggleExercise: (index: number) => void;

  // Toast
  toastMessage: string;
  toastVisible: boolean;
  showToast: (message: string) => void;
  hideToast: () => void;

  // Selected exercise for modal
  selectedExercise: number | null;
  setSelectedExercise: (index: number | null) => void;

  // Grocery checklist
  groceryChecked: boolean[];
  toggleGrocery: (index: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),

  isOnboarded: false,
  setIsOnboarded: (v) => set({ isOnboarded: v }),

  isSubscribed: false,
  setIsSubscribed: (v) => set({ isSubscribed: v }),

  pendingOnboardingStep: null,
  setPendingOnboardingStep: (step) => set({ pendingOnboardingStep: step }),

  exerciseDone: [true, true, true, false, false],
  toggleExercise: (index) =>
    set((state) => {
      const next = [...state.exerciseDone];
      next[index] = !next[index];
      return { exerciseDone: next };
    }),

  toastMessage: '',
  toastVisible: false,
  showToast: (message) => set({ toastMessage: message, toastVisible: true }),
  hideToast: () => set({ toastVisible: false }),

  selectedExercise: null,
  setSelectedExercise: (index) => set({ selectedExercise: index }),

  groceryChecked: [false, true, true, false, false, true, false, false],
  toggleGrocery: (index) =>
    set((state) => {
      const next = [...state.groceryChecked];
      next[index] = !next[index];
      return { groceryChecked: next };
    }),
}));
