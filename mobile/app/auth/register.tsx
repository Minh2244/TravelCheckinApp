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
import { registerSchema, RegisterFormData, otpSchema } from '../../utils/validations';

const RegisterScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
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

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      const response = await authApi.register({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      if (response.success) {
        setEmail(data.email);
        setStep('verify');
        startCountdown();
        showToast('Mã xác thực đã được gửi đến email của bạn', 'success');
      } else {
        showToast(response.message || 'Đăng ký thất bại', 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Đăng ký thất bại';
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

      setLoading(true);
      const response = await authApi.verifyOTP({
        email,
        otp,
      });

      if (response.success) {
        showToast('Tạo tài khoản thành công!', 'success');
        setTimeout(() => {
          router.replace('/auth/login');
        }, 1000);
      } else {
        showToast(response.message || 'Mã xác thực không đúng', 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Mã xác thực không đúng';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      if (countdown > 0) return;

      setLoading(true);
      const response = await authApi.resendOTP(email);

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

  const renderRegisterForm = () => (
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

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          Tạo tài khoản
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Bắt đầu hành trình của bạn
        </Text>
      </View>

      {/* Form */}
      <View style={{ marginBottom: 24 }}>
        <Controller
          control={control}
          name="full_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Họ và tên"
              placeholder="Nhập họ và tên của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.full_name?.message}
              autoCapitalize="words"
              leftIcon={<Text style={{ fontSize: 18 }}>👤</Text>}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="Nhập email của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Text style={{ fontSize: 18 }}>✉️</Text>}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Số điện thoại"
              placeholder="Nhập số điện thoại của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
              keyboardType="phone-pad"
              leftIcon={<Text style={{ fontSize: 18 }}>📞</Text>}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Mật khẩu"
              placeholder="Nhập mật khẩu của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              isPassword
              leftIcon={<Text style={{ fontSize: 18 }}>🔒</Text>}
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nhập lại mật khẩu"
              placeholder="Nhập lại mật khẩu của bạn"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              isPassword
              leftIcon={<Text style={{ fontSize: 18 }}>🔒</Text>}
            />
          )}
        />

        <Button
          title="ĐĂNG KÝ"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          size="lg"
        />
      </View>

      {/* Login link */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#6b7280', fontSize: 14 }}>
          Đã có tài khoản?{' '}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/auth/login')}>
          <Text
            style={{
              color: '#3b82f6',
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            Đăng nhập ngay
          </Text>
        </TouchableOpacity>
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
        onPress={() => setStep('register')}
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
          Xác thực Email
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

        {step === 'register' ? renderRegisterForm() : renderVerifyForm()}
      </KeyboardAvoidingView>
    </View>
  );
};

export default RegisterScreen;
