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

  const bottomOffset = isTabScreen ? 90 : Math.max(insets.bottom, 16) + 16;

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
            bottom: bottomOffset,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#7c3aed", // Purple-600
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#7c3aed",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          }}
        >
          {/* Cute robot/AI helper avatar or icon */}
          <Ionicons name="chatbubble-ellipses" size={26} color="white" />
          
          {/* Green active dot indicator */}
          <View
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#22c55e", // Green-500
              borderWidth: 2,
              borderColor: "#7c3aed",
            }}
          />
        </Pressable>
      )}
    </View>
  );
}
