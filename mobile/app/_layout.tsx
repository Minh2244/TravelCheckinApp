// app/_layout.tsx
// Root layout — dang ky tat ca screen, auth gate

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

export { ErrorBoundary } from 'expo-router';

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

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.persist.rehydrate();
      setIsReady(true);
    };
    initAuth();
  }, []);

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
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="location/[id]" />
        <Stack.Screen name="booking/[serviceId]" />
        <Stack.Screen name="checkin" />
        <Stack.Screen name="saved-locations" />
        <Stack.Screen name="vouchers" />
        <Stack.Screen name="booking-reminders" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="diary" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="ai-chat" />
        <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
