export type OnboardingScreen =
  | 'Welcome'
  | 'SignUp'
  | 'Login'
  | 'Subscription'
  | 'Setup'
  | 'BodyScan'
  | 'Analyzing';

export type MainTab =
  | 'Dashboard'
  | 'Workout'
  | 'Nutrition'
  | 'Body'
  | 'Profile';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
  Subscription: undefined;
  PaymentSuccess: undefined;
  Setup: undefined;
  BodyScan: undefined;
  Analyzing: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Workout: undefined;
  Nutrition: undefined;
  Body: undefined;
  Profile: undefined;
};

export interface UserProfile {
  name: string;
  email: string;
  password: string;
  age: number;
  height: number;
  weight: number;
  goal: number;
  environment: number;
  isOnboarded: boolean;
}
