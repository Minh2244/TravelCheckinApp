/**
 * 404 — Không tìm thấy trang
 */

import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, fontSize, spacing, borderRadius } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.title}>Không tìm thấy trang</Text>
      <Text style={styles.subtitle}>Trang bạn tìm không tồn tại hoặc đã bị xóa.</Text>
      <Link href="/(tabs)" style={styles.link}>
        ← Về trang chủ
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  link: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: '600',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.md,
  },
});
