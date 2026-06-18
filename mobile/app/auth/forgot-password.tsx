import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import OTPInput from '../../components/OTPInput';
import authApi from '../../api/authApi';
import {
  forgotPasswordSchema,
  ForgotPasswordFormData,
  resetPasswordSchema,
  ResetPasswordFormData,
} from '../../utils/validations';

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    control: requestControl,
    handleSubmit: handleRequestSubmit,
    formState: { errors: requestErrors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
      phone: '',
    },
  });

  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: '',
      confirmPassword: '',
    },
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onRequestSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setLoading(true);
      const response = await authApi.forgotPassword({
        email: data.email,
        phone: data.phone,
      });

      if (response.success) {
        setEmail(data.email);
        setPhone(data.phone);
        setStep('verify');
        startCountdown();
        showToast('Mã xác thực đã được gửi đến email của bạn', 'success');
      } else {
        showToast(response.message || 'Gửi mã thất bại', 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Gửi mã thất bại';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setOtpError('');

      if (otp.length !== 6) {
        setOtpError('Vui lòng nhập đủ 6 ký tự');
        return;
      }

      // Chuyển sang bước đặt lại mật khẩu
      setStep('reset');
    } catch (error: any) {
      showToast('Mã xác thực không đúng', 'error');
    }
  };

  const onResetSubmit = async (data: ResetPasswordFormData) => {
    try {
      setLoading(true);
      const response = await authApi.resetPassword({
        email,
        otp,
        new_password: data.new_password,
      });

      if (response.success) {
        showToast('Đổi mật khẩu thành công!', 'success');
        setTimeout(() => {
          router.replace('/auth/login');
        }, 1000);
      } else {
        showToast(response.message || 'Đổi mật khẩu thất bại', 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Đổi mật khẩu thất bại';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      if (countdown > 0) return;

      setLoading(true);
      const response = await authApi.forgotPassword({ email, phone });

      if (response.success) {
        showToast('Mã xác thực mới đã được gửi', 'success');
        startCountdown();
      } else {
        showToast(response.message || 'Gửi lại mã thất bại', 'error');
      }
    } catch (error: any) {
      showToast('Gửi lại mã thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderRequestForm = () => (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        >
          <Text style={{ fontSize: 16, color: '#3b82f6' }}>← Quay lại</Text>
        </TouchableOpacity>

        <Image 
          source={require('../../assets/mascot.png')} 
          style={{ width: 80, height: 80, marginBottom: 16, borderRadius: 20, backgroundColor: '#ffffff' }} 
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          Quên mật khẩu?
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Vui lòng nhập thông tin để nhận mã xác nhận
        </Text>
      </View>

      {/* Form */}
      <View style={{ marginBottom: 24 }}>
        <Controller
          control={requestControl}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="Nhập email của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={requestErrors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Text style={{ fontSize: 18 }}>✉️</Text>}
            />
          )}
        />

        <Controller
          control={requestControl}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Số điện thoại"
              placeholder="Nhập số điện thoại của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={requestErrors.phone?.message}
              keyboardType="phone-pad"
              leftIcon={<Text style={{ fontSize: 18 }}>📞</Text>}
            />
          )}
        />

        <Button
          title="GỬI MÃ XÁC NHẬN"
          onPress={handleRequestSubmit(onRequestSubmit)}
          loading={loading}
          size="lg"
        />
      </View>
    </ScrollView>
  );

  const renderVerifyForm = () => (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
      }}
    >
      <TouchableOpacity
        onPress={() => setStep('request')}
        style={{ marginBottom: 24 }}
      >
        <Text style={{ fontSize: 16, color: '#3b82f6' }}>← Quay lại</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Image 
          source={require('../../assets/mascot.png')} 
          style={{ width: 80, height: 80, marginBottom: 16, borderRadius: 20, backgroundColor: '#ffffff' }} 
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          Xác thực mã
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Mã xác thực đã được gửi đến email của bạn
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#3b82f6',
            fontWeight: '500',
          }}
        >
          {email}
        </Text>
      </View>

      {/* OTP Input */}
      <View style={{ marginBottom: 32 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: '#374151',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          Nhập mã 6 số
        </Text>

        <OTPInput
          value={otp}
          onChange={setOtp}
          error={otpError}
          autoFocus
        />
      </View>

      {/* Verify Button */}
      <Button
        title="XÁC NHẬN MÃ"
        onPress={handleVerifyOTP}
        loading={loading}
        size="lg"
        style={{ marginBottom: 24 }}
      />

      {/* Resend OTP */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#6b7280', fontSize: 14 }}>
          Không nhận được mã?{' '}
        </Text>
        <TouchableOpacity
          onPress={handleResendOTP}
          disabled={countdown > 0}
        >
          <Text
            style={{
              color: countdown > 0 ? '#9ca3af' : '#3b82f6',
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            {countdown > 0 ? `Gửi lại mã sau: ${countdown} giây` : 'Gửi lại mã'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResetForm = () => (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => setStep('verify')}
        style={{ marginBottom: 24 }}
      >
        <Text style={{ fontSize: 16, color: '#3b82f6' }}>← Quay lại</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Image 
          source={require('../../assets/mascot.png')} 
          style={{ width: 80, height: 80, marginBottom: 16, borderRadius: 20, backgroundColor: '#ffffff' }} 
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          Đặt lại mật khẩu
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Nhập mật khẩu mới của bạn
        </Text>
      </View>

      {/* Form */}
      <View style={{ marginBottom: 24 }}>
        <Controller
          control={resetControl}
          name="new_password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={resetErrors.new_password?.message}
              isPassword
              leftIcon={<Text style={{ fontSize: 18 }}>🔒</Text>}
            />
          )}
        />

        <Controller
          control={resetControl}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nhập lại mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={resetErrors.confirmPassword?.message}
              isPassword
              leftIcon={<Text style={{ fontSize: 18 }}>🔒</Text>}
            />
          )}
        />

        <Button
          title="XÁC NHẬN ĐỔI MẬT KHẨU"
          onPress={handleResetSubmit(onResetSubmit)}
          loading={loading}
          size="lg"
        />
      </View>
    </ScrollView>
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />

        {step === 'request' && renderRequestForm()}
        {step === 'verify' && renderVerifyForm()}
        {step === 'reset' && renderResetForm()}
      </KeyboardAvoidingView>
    </View>
  );
};

export default ForgotPasswordScreen;
