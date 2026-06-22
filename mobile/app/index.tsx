import { Redirect } from "expo-router";

import { useAuthStore } from "../src/modules/auth/store";

export default function IndexScreen() {
  const status = useAuthStore((state) => state.status);

  return <Redirect href={status === "authenticated" ? "/home" : "/sign-in"} />;
}
