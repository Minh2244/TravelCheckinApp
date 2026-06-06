import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // Navigation sẽ tự chuyển về Login qua _layout.tsx
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>👤 Hồ sơ</Text>
      {user && (
        <Text style={styles.userName}>{user.full_name}</Text>
      )}
      <Text style={styles.sub}>Sẽ code đầy đủ ở Giai đoạn 3</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  text: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  userName: { fontSize: fontSize.lg, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
  sub: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xxxl },
  logoutButton: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
  },
  logoutText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
