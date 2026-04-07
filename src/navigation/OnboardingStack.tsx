import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types';
import { useAppStore } from '../store/useAppStore';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import SignUpScreen from '../screens/onboarding/SignUpScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import SubscriptionScreen from '../screens/onboarding/SubscriptionScreen';
import PaymentSuccessScreen from '../screens/onboarding/PaymentSuccessScreen';
import BodyScanScreen from '../screens/onboarding/BodyScanScreen';
import SetupScreen from '../screens/onboarding/SetupScreen';
import AnalyzingScreen from '../screens/onboarding/AnalyzingScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingStack() {
  const pendingStep = useAppStore((s) => s.pendingOnboardingStep);
  const setPendingStep = useAppStore((s) => s.setPendingOnboardingStep);

  const initialRoute = (pendingStep as keyof OnboardingStackParamList | null) ?? 'Welcome';

  // Clear it after consuming
  if (pendingStep) setPendingStep(null);

  return (
    <Stack.Navigator
      key={initialRoute}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <Stack.Screen name="BodyScan" component={BodyScanScreen} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Analyzing" component={AnalyzingScreen} />
    </Stack.Navigator>
  );
}
