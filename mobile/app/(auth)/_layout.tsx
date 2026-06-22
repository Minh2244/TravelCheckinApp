import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "../../src/modules/auth/store";

export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
