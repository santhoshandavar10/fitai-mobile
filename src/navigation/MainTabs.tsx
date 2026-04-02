import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import type { MainTabParamList } from '../types';

import DashboardScreen from '../screens/main/DashboardScreen';
import WorkoutScreen from '../screens/main/WorkoutScreen';
import NutritionScreen from '../screens/main/NutritionScreen';
import BodyScreen from '../screens/main/BodyScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Home',
  Workout: 'Train',
  Nutrition: 'Eat',
  Body: 'Body',
  Profile: 'You',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={tabStyles.iconWrap}>
      <Text style={[tabStyles.iconText, focused && tabStyles.iconTextActive]}>
        {name}
      </Text>
      {focused && <View style={tabStyles.dot} />}
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={TAB_LABELS[route.name]} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Workout" component={WorkoutScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Body" component={BodyScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.bg2,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 16,
    paddingTop: 10,
  },
  iconWrap: {
    alignItems: 'center',
    gap: 4,
  },
  iconText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text3,
    letterSpacing: 0.5,
  },
  iconTextActive: {
    color: COLORS.lime,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lime,
  },
});
