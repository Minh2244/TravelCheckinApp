/**
 * Login Screen — Đăng nhập
 * TravelCheckinApp Mobile
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import useAuthStore from '../store/useAuthStore';
import { colors, fontSize, spacing, borderRadius, shadow } from '../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải ít nhất 6 ký tự');
      return;
    }

    clearError();
    try {
      await login(email.trim(), password);
      // Navigation sẽ tự động chuyển qua _layout.tsx (isAuthenticated = true)
    } catch {
      // Error đã được set trong store
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const result = await WebBrowser.openAuthSessionAsync(
        `${apiUrl}/auth/google/mobile`,
        'travelcheckin://auth/callback'
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('accessToken');
        const refreshToken = url.searchParams.get('refreshToken');

        if (accessToken && refreshToken) {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('accessToken', accessToken);
          await AsyncStorage.setItem('refreshToken', refreshToken);
          await useAuthStore.getState().loadSession();
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể đăng nhập bằng Google');
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const result = await WebBrowser.openAuthSessionAsync(
        `${apiUrl}/auth/facebook/mobile`,
        'travelcheckin://auth/callback'
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('accessToken');
        const refreshToken = url.searchParams.get('refreshToken');

        if (accessToken && refreshToken) {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('accessToken', accessToken);
          await AsyncStorage.setItem('refreshToken', refreshToken);
          await useAuthStore.getState().loadSession();
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể đăng nhập bằng Facebook');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🏖️</Text>
            <Text style={styles.logoText}>Travel Check-in</Text>
            <Text style={styles.logoSub}>Khám phá du lịch thông minh</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Email */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Error message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Login button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google button */}
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} activeOpacity={0.8}>
              <Text style={styles.googleButtonText}>G</Text>
              <Text style={styles.googleButtonTextFull}>Đăng nhập bằng Google</Text>
            </TouchableOpacity>

            {/* Facebook button */}
            <TouchableOpacity style={styles.facebookButton} onPress={handleFacebookLogin} activeOpacity={0.8}>
              <Text style={styles.facebookButtonText}>f</Text>
              <Text style={styles.facebookButtonTextFull}>Đăng nhập bằng Facebook</Text>
            </TouchableOpacity>
          </View>

          {/* Footer links */}
          <View style={styles.footerContainer}>
            <Link href="/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </Link>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <Link href="/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLinkBold}>Đăng ký</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  logoSub: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  formContainer: {
    marginBottom: spacing.xxl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    height: '100%',
  },
  eyeButton: {
    padding: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.textInverse,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
    marginBottom: spacing.md,
  },
  googleButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.error,
    marginRight: spacing.sm,
  },
  googleButtonTextFull: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  facebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1877F2',
    borderRadius: borderRadius.lg,
    height: 52,
  },
  facebookButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textInverse,
    marginRight: spacing.sm,
  },
  facebookButtonTextFull: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textInverse,
  },
  footerContainer: {
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
  },
  footerLinkBold: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '700',
  },
});
