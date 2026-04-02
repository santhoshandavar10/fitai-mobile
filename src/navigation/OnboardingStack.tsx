import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import SignUpScreen from '../screens/onboarding/SignUpScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import SubscriptionScreen from '../screens/onboarding/SubscriptionScreen';
import BodyScanScreen from '../screens/onboarding/BodyScanScreen';
import SetupScreen from '../screens/onboarding/SetupScreen';
import AnalyzingScreen from '../screens/onboarding/AnalyzingScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function getPendingStep(): keyof OnboardingStackParamList {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const step = localStorage.getItem('pending_onboarding_step');
    if (step) {
      localStorage.removeItem('pending_onboarding_step');
      return step as keyof OnboardingStackParamList;
    }
  }
  return 'Welcome';
}

export default function OnboardingStack() {
  const initialRouteName = getPendingStep();

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="BodyScan" component={BodyScanScreen} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Analyzing" component={AnalyzingScreen} />
    </Stack.Navigator>
  );
}
