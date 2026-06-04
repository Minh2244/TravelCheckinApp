// components/SessionRevokedModal.tsx
// Modal canh bao khi bi dang nhap o thiet bi khac

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fontSize, spacing, radius, fontWeight } from '../constants/theme';

export default function SessionRevokedModal() {
  const { isSessionRevoked, logout, setSessionRevoked } = useAuthStore();

  const handleForceLogout = () => {
    setSessionRevoked(false);
    logout();
    router.replace('/login' as any);
  };

  return (
    <Modal visible={isSessionRevoked} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Ionicons name="warning-outline" size={48} color={colors.error} />
          <Text style={styles.title}>Phiên đăng nhập hết hạn</Text>
          <Text style={styles.body}>
            Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.
            Vui lòng đăng nhập lại để tiếp tục sử dụng dịch vụ.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleForceLogout}>
            <Text style={styles.buttonText}>Đăng nhập lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
