import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuthStore } from "../src/modules/auth/store";

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

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.stackContent }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      ) : (
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingTitle}>Đang chuẩn bị ứng dụng</Text>
          <Text style={styles.loadingText}>
            Mình đang khôi phục phiên đăng nhập và kiểm tra kết nối.
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  stackContent: {
    backgroundColor: "#eef2f3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#eef2f3",
    gap: 12,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  loadingText: {
    maxWidth: 280,
    textAlign: "center",
    color: "#475569",
    lineHeight: 22,
  },
});
