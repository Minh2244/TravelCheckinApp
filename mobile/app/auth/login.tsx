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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import authApi from '../../api/authApi';
import useAuthStore from '../../store/authStore';
import { loginSchema, LoginFormData } from '../../utils/validations';
import { saveTokens, saveUser } from '../../utils';

const LoginScreen = () => {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      const response = await authApi.login({
        email: data.email,
        password: data.password,
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // Lưu token và user
        await saveTokens(accessToken, refreshToken);
        await saveUser(user);
        await setTokens(accessToken, refreshToken);
        setUser(user);

        showToast('Đăng nhập thành công!', 'success');

        // Chuyển sang trang chủ
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      } else {
        showToast(response.message || 'Đăng nhập thất bại', 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Sai tài khoản hoặc mật khẩu';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      const returnUrl = Linking.createURL('/auth/callback');
      const authUrl = `${process.env.EXPO_PUBLIC_API_URL}/auth/google/mobile?returnTo=${encodeURIComponent(returnUrl)}`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      
      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);
        
        if (queryParams?.error) {
           showToast(queryParams.error as string, 'error');
           return;
        }

        if (queryParams?.accessToken && queryParams?.refreshToken && queryParams?.user) {
          const accessToken = queryParams.accessToken as string;
          const refreshToken = queryParams.refreshToken as string;
          const userStr = queryParams.user as string;
          let user;
          try {
             user = JSON.parse(decodeURIComponent(userStr));
          } catch(e) {
             user = JSON.parse(userStr);
          }

          await saveTokens(accessToken, refreshToken);
          await saveUser(user);
          await setTokens(accessToken, refreshToken);
          setUser(user);

          showToast('Đăng nhập thành công!', 'success');
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 500);
        }
      }
    } catch (error: any) {
      showToast('Đăng nhập Google thất bại', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

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

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Image 
              source={require('../../assets/mascot.png')} 
              style={{ width: 100, height: 100, marginBottom: 16, borderRadius: 24, backgroundColor: '#ffffff' }} 
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: 8,
              }}
            >
              Travel Checkin
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#6b7280',
                textAlign: 'center',
              }}
            >
              Chạm để khám phá thế giới!
            </Text>
          </View>

          {/* Form */}
          <View style={{ marginBottom: 24 }}>
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
                  leftIcon={<Text style={{ fontSize: 18 }}>👤</Text>}
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

            {/* Links row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={{ color: '#3b82f6', fontWeight: '500' }}>
                  Đăng ký ngay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text style={{ color: '#3b82f6', fontWeight: '500' }}>
                  Quên mật khẩu?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Nút đăng nhập */}
            <Button
              title="ĐĂNG NHẬP"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              size="lg"
            />
          </View>

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: '#e5e7eb',
              }}
            />
            <Text
              style={{
                marginHorizontal: 16,
                color: '#6b7280',
                fontSize: 14,
              }}
            >
              Hoặc
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: '#e5e7eb',
              }}
            />
          </View>

          {/* Google Login */}
          <Button
            title="Đăng nhập với Google"
            onPress={handleGoogleLogin}
            variant="outline"
            loading={googleLoading}
            icon={<Text style={{ fontSize: 20 }}>G</Text>}
            style={{ marginBottom: 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default LoginScreen;
