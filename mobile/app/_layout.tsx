import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
// 1. IMPORT THÊM CÁI STORE CỦA MÌNH VÀO ĐÂY
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isReady, setIsReady] = useState(false);

  // 2. KHỞI TẠO STATE ĐĂNG NHẬP Ở ĐÂY
  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.persist.rehydrate();
      setIsReady(true);
    };
    initAuth();
  }, []);

  // Điều hướng người dùng dựa trên trạng thái đăng nhập
  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      if (!accessToken) {
        router.replace('/login' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [accessToken, isReady]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Khai báo màn hình Đăng nhập */}
        <Stack.Screen name="login" options={{ headerShown: false }} />

        {/* Khai báo màn hình Đăng ký */}
        <Stack.Screen name="register" options={{ headerShown: false }} />

        {/* Khai báo màn hình Quên mật khẩu */}
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />

        {/* Khai báo luồng Tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Đổi cái modal cũ thành màn hình SOS của mình */}
        <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}