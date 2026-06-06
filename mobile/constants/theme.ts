/**
 * Theme System — Bảng màu + kích thước chung cho toàn app
 * TravelCheckinApp Mobile
 */

export const colors = {
  // Primary — Xanh dương (tin cậy, du lịch)
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',

  // Accent — Cam vàng (nút CTA, highlight)
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  accentDark: '#D97706',

  // Background
  background: '#F8FAFC',
  card: '#FFFFFF',

  // Text
  text: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',

  // Border
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Status
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Map
  mapDot: '#10B981',
  mapDotPulse: 'rgba(16, 185, 129, 0.3)',

  // SOS
  sos: '#DC2626',
  sosLight: '#FEE2E2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  hero: 32,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// Export theme object gộp
const theme = {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
};

export default theme;
