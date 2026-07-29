import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../src/modules/auth/store";
import { useBookingNotifications } from "../../src/hooks/useBookingNotifications";
import { travelColors, travelShadow } from "../../src/theme/travel";

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



  return (
    <View className="flex-1 bg-surface">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}
