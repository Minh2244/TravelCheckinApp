// components/Badge.tsx
// Nhan trang thai (success/warning/error/info)

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fontSize, spacing, fontWeight, radius } from '../constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'muted';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  info: { bg: colors.infoLight, text: colors.info },
  muted: { bg: colors.surfaceAlt, text: colors.textSecondary },
};

export default function Badge({ text, variant = 'info', style }: BadgeProps) {
  const vc = VARIANT_COLORS[variant];

  return (
    <View style={[styles.badge, { backgroundColor: vc.bg }, style]}>
      <Text style={[styles.text, { color: vc.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
