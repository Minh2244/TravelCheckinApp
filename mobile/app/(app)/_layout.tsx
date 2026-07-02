import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { View, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../src/modules/auth/store";
import { useBookingNotifications } from "../../src/hooks/useBookingNotifications";

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Listen for booking status changes (confirmed/cancelled) from owner
  useBookingNotifications();

  if (status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  // Determine if we should show the AI Chat Bubble
  const isBookingScreen = pathname.includes("/booking");
  const isChatScreen = pathname.includes("/ai/chat") || pathname.includes("/chat/location");
  const showAiBubble = !isBookingScreen && !isChatScreen;

  // Determine bottom offset (above tab bar vs safe bottom inset)
  const isTabScreen =
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/explore" ||
    pathname === "/itineraries" ||
    pathname === "/saved" ||
    pathname === "/profile" ||
    pathname === "/wallet";

  // On location detail screen there's already an owner chat button at the same position;
  // push the AI bubble higher so they don't overlap
  const isLocationDetail = /^\/location\/[^/]+$/.test(pathname);

  const bottomOffset = isTabScreen ? 90 : Math.max(insets.bottom, 16) + 16;
  // When on location detail, raise AI bubble to sit above owner chat FAB (extra 66px)
  const aiBubbleBottom = isLocationDetail ? bottomOffset + 66 : bottomOffset;

  return (
    <View className="flex-1 bg-surface">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>

      {showAiBubble && (
        <Pressable
          onPress={() => router.push("/ai/chat")}
          style={{
            position: "absolute",
            bottom: aiBubbleBottom,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#7c3aed",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#7c3aed",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
            elevation: 8,
          }}
        >
          <Ionicons name="sparkles" size={22} color="white" />
          {/* Green active dot */}
          <View
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#22c55e",
              borderWidth: 2,
              borderColor: "#7c3aed",
            }}
          />
        </Pressable>
      )}
    </View>
  );
}
