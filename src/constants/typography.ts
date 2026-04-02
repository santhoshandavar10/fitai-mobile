import { Platform } from 'react-native';

// Using system fonts initially — custom fonts (Barlow, JetBrains Mono) will be loaded via expo-font later
export const FONTS = {
  heading: Platform.select({ ios: 'System', android: 'sans-serif-condensed' }) ?? 'System',
  body: Platform.select({ ios: 'System', android: 'sans-serif' }) ?? 'System',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' }) ?? 'monospace',
} as const;

export const FONT_SIZES = {
  xs: 9,
  sm: 11,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 26,
  '4xl': 28,
  '5xl': 34,
  '6xl': 42,
  '7xl': 52,
} as const;

export const FONT_WEIGHTS = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const LINE_HEIGHTS = {
  tight: 0.95,
  snug: 1.0,
  normal: 1.4,
  relaxed: 1.5,
  loose: 1.6,
} as const;
