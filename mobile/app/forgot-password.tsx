/**
 * Forgot Password Screen — Quên mật khẩu (3 bước)
 * TravelCheckinApp Mobile
 */

import { useState, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/useAuthStore';
import { colors, fontSize, spacing, borderRadius } from '../constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword, verifyResetOtp, resetPassword, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (step !== 2) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleSendOtp = async () => {
    if (!email.trim() || !phone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và số điện thoại');
      return;
    }
    clearError();
    try {
      const result = await forgotPassword(email.trim(), phone.trim());
      if (result.success) {
        setStep(2);
        setCountdown(60);
        otpRefs.current[0]?.focus();
      } else {
        Alert.alert('Lỗi', result.message || 'Không tìm thấy tài khoản');
      }
    } catch {}
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== '')) handleVerifyOtp(newOtp.join(''));
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async (otpCode: string) => {
    clearError();
    try {
      const result = await verifyResetOtp(email.trim(), otpCode);
      if (result.success) {
        setStep(3);
      } else {
        Alert.alert('Lỗi', result.message || 'OTP không đúng');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu không khớp');
      return;
    }
    clearError();
    try {
      const result = await resetPassword(email.trim(), otp.join(''), newPassword);
      if (result.success) {
        Alert.alert('Thành công', 'Đã đặt lại mật khẩu! Vui lòng đăng nhập.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Lỗi', result.message || 'Đặt lại mật khẩu thất bại');
      }
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <TouchableOpacity style={styles.backButton} onPress={() => (step === 1 ? router.back() : setStep(step - 1))}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.backText}>
              {step === 1 ? 'Quên mật khẩu' : step === 2 ? 'Xác nhận OTP' : 'Đặt mật khẩu mới'}
            </Text>
          </TouchableOpacity>

          {/* STEP 1: Nhập email + SĐT */}
          {step === 1 && (
            <View style={styles.formContainer}>
              <Text style={styles.description}>Nhập email và số điện thoại đã đăng ký để nhận mã OTP.</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textLight} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Số điện thoại" placeholderTextColor={colors.textLight} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} onPress={handleSendOtp} disabled={isLoading} activeOpacity={0.8}>
                {isLoading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>Gửi OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Xác nhận OTP */}
          {step === 2 && (
            <View style={styles.formContainer}>
              <Text style={styles.otpDescription}>
                Mã OTP đã gửi về email{'\n'}
                <Text style={styles.otpEmail}>{email}</Text>
              </Text>

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { otpRefs.current[index] = ref; }}
                    style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text.replace(/[^0-9]/g, ''), index)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} onPress={() => handleVerifyOtp(otp.join(''))} disabled={isLoading || otp.some((d) => !d)} activeOpacity={0.8}>
                {isLoading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>Xác nhận</Text>}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>Gửi lại OTP ({countdown}s)</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp}>
                    <Text style={styles.resendLink}>Gửi lại OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* STEP 3: Đặt mật khẩu mới */}
          {step === 3 && (
            <View style={styles.formContainer}>
              <Text style={styles.description}>Nhập mật khẩu mới cho tài khoản của bạn.</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Mật khẩu mới (≥6 ký tự)" placeholderTextColor={colors.textLight} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Nhập lại mật khẩu mới" placeholderTextColor={colors.textLight} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} onPress={handleResetPassword} disabled={isLoading} activeOpacity={0.8}>
                {isLoading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>Đặt lại mật khẩu</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl },
  backText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginLeft: spacing.sm },
  formContainer: { flex: 1 },
  description: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xxl, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, paddingHorizontal: spacing.lg, height: 52 },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, fontSize: fontSize.base, color: colors.text, height: '100%' },
  eyeButton: { padding: spacing.xs },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  errorText: { fontSize: fontSize.sm, color: colors.error, marginLeft: spacing.xs, flex: 1 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: borderRadius.lg, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { fontSize: fontSize.base, fontWeight: '700', color: colors.textInverse },
  otpDescription: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl, lineHeight: 24 },
  otpEmail: { fontWeight: '700', color: colors.text },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  otpInput: { width: 48, height: 56, borderWidth: 2, borderColor: colors.border, borderRadius: borderRadius.lg, textAlign: 'center', fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, backgroundColor: colors.card },
  otpInputFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '10' },
  resendContainer: { alignItems: 'center', marginTop: spacing.xl },
  countdownText: { fontSize: fontSize.md, color: colors.textSecondary },
  resendLink: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
});
