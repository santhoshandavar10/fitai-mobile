import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS } from '../constants/colors';
import type { MainTabParamList } from '../types';

import DashboardScreen from '../screens/main/DashboardScreen';
import WorkoutScreen from '../screens/main/WorkoutScreen';
import NutritionScreen from '../screens/main/NutritionScreen';
import BodyScreen from '../screens/main/BodyScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeIcon({ focused }: { focused: boolean }) {
  const c = focused ? COLORS.lime : COLORS.text3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinejoin="round" />
      <Path d="M9 21V12h6v9" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    </Svg>
  );
}

function WorkoutIcon({ focused }: { focused: boolean }) {
  const c = focused ? COLORS.lime : COLORS.text3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 8.5h11M6.5 15.5h11" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
      <Rect x="2" y="7" width="3" height="10" rx="1.5" stroke={c} strokeWidth={focused ? 2 : 1.5} />
      <Rect x="19" y="7" width="3" height="10" rx="1.5" stroke={c} strokeWidth={focused ? 2 : 1.5} />
      <Rect x="4.5" y="10" width="2" height="4" rx="1" fill={c} />
      <Rect x="17.5" y="10" width="2" height="4" rx="1" fill={c} />
    </Svg>
  );
}

function NutritionIcon({ focused }: { focused: boolean }) {
  const c = focused ? COLORS.lime : COLORS.text3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8 2 5 6 5 10c0 3.5 2 6.5 5 8v3h4v-3c3-1.5 5-4.5 5-8 0-4-3-8-7-8z" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinejoin="round" />
      <Path d="M12 6v6M9.5 8.5L12 6l2.5 2.5" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BodyIcon({ focused }: { focused: boolean }) {
  const c = focused ? COLORS.lime : COLORS.text3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="4.5" r="2" stroke={c} strokeWidth={focused ? 2 : 1.5} />
      <Path d="M8 9h8l-1 5h-6L8 9z" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinejoin="round" />
      <Path d="M9 14l-2 7M15 14l2 7" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
      <Path d="M7 11H4M17 11h3" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ focused }: { focused: boolean }) {
  const c = focused ? COLORS.lime : COLORS.text3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={focused ? 2 : 1.5} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    </Svg>
  );
}

const ICONS = {
  Dashboard: HomeIcon,
  Workout: WorkoutIcon,
  Nutrition: NutritionIcon,
  Body: BodyIcon,
  Profile: ProfileIcon,
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Home',
  Workout: 'Train',
  Nutrition: 'Fuel',
  Body: 'Body',
  Profile: 'You',
};

function TabIcon({ name, focused }: { name: keyof typeof ICONS; focused: boolean }) {
  const Icon = ICONS[name];
  return (
    <View style={tabStyles.iconWrap}>
      {focused && <View style={tabStyles.activePill} />}
      <Icon focused={focused} />
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
        {TAB_LABELS[name]}
      </Text>
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
          <TabIcon name={route.name as keyof typeof ICONS} focused={focused} />
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
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    height: 76,
    paddingBottom: 12,
    paddingTop: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -6,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.lime,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text3,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: COLORS.lime,
    fontWeight: '700',
  },
});
