import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "../../src/modules/auth/store";
import { useBookingNotifications } from "../../src/hooks/useBookingNotifications";

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);

  // Listen for booking status changes (confirmed/cancelled) from owner
  useBookingNotifications();

  if (status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
