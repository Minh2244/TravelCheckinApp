import "../global.css";

import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuthStore } from "../src/modules/auth/store";
import { ToastHost } from "../src/modules/ui/toast-host";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setStyle("dark");
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#eef2f3" />
      {hydrated ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#eef2f3" },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 bg-surface px-6">
          <Text className="text-center text-xl font-bold text-ink">
            Đang chuẩn bị ứng dụng
          </Text>
          <Text className="max-w-[280px] text-center leading-6 text-slate-600">
            Mình đang khôi phục phiên đăng nhập và kiểm tra kết nối.
          </Text>
        </View>
      )}
      <ToastHost />
    </SafeAreaProvider>
  );
}
 
