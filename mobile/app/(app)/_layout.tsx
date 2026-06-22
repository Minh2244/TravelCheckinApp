import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "../../src/modules/auth/store";

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);

  if (status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
