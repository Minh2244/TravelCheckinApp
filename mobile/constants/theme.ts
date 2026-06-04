// constants/theme.ts
// Tap trung tat ca mau sac, font, spacing de toan bo app dung chung

export const colors = {
  primary: '#14b8a6',
  primaryDark: '#0d9488',
  primaryLight: '#ccfbf1',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  errorLight: '#fef2f2',
  success: '#22c55e',
  successLight: '#f0fdf4',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  info: '#3b82f6',
  infoLight: '#eff6ff',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
