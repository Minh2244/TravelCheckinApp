import "../global.css";

import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Text, View, AppState, DeviceEventEmitter } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { io } from "socket.io-client";

import { useAuthStore } from "../src/modules/auth/store";
import { useAppSettingsStore } from "../src/store/app-settings";
import { ConfirmHost } from "../src/modules/ui/confirm-host";
import { ToastHost } from "../src/modules/ui/toast-host";
import { env } from "../src/lib/env";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated]);

  // Handle Global App Settings & Real-time
  const fetchSettings = useAppSettingsStore((state) => state.fetchSettings);
  const updateSettings = useAppSettingsStore((state) => state.updateSettings);

  useEffect(() => {
    // 1. Initial fetch
    void fetchSettings();

    // 2. AppState listener (when returning to app)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        void fetchSettings();
      }
    });

    // 3. Global Socket listener
    const socketUrl = env.apiBaseUrl.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      console.log("Global Socket connected for app settings");
    });

    socket.on("public_settings_updated", (data: any) => {
      console.log("Received realtime settings update", data);
      updateSettings({
        app_background_url: data.app_background_url || "",
        app_primary_color: data.app_primary_color || "",
        app_secondary_color: data.app_secondary_color || "",
        app_text_color: data.app_text_color || "",
      });
    });

    return () => {
      subscription.remove();
      socket.disconnect();
    };
  }, [fetchSettings, updateSettings]);

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    const socketUrl = env.apiBaseUrl.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
    });

    socket.on("realtime_event", (event: unknown) => {
      DeviceEventEmitter.emit("realtime_event", event);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, hydrated]);

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
      <ConfirmHost />
      <ToastHost />
    </SafeAreaProvider>
  );
}
