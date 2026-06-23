import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { parseGoogleAuthResultUrl } from "../../src/modules/auth/google";
import { useAuthStore } from "../../src/modules/auth/store";

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const handledRef = useRef(false);
  const finishGoogleSignIn = useAuthStore((state) => state.finishGoogleSignIn);
  const setNotice = useAuthStore((state) => state.setNotice);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;

    const run = async () => {
      try {
        const error = getSingleValue(params.error);

        if (error) {
          setNotice(decodeURIComponent(error));
          router.replace("/sign-in");
          return;
        }

        const accessToken = getSingleValue(params.accessToken);
        const refreshToken = getSingleValue(params.refreshToken);
        const user = getSingleValue(params.user);

        if (!accessToken || !refreshToken || !user) {
          setNotice("Không nhận đủ dữ liệu đăng nhập từ Google.");
          router.replace("/sign-in");
          return;
        }

        const query = new URLSearchParams({
          accessToken,
          refreshToken,
          user,
        });

        const session = parseGoogleAuthResultUrl(`travelcheckin://auth/callback?${query.toString()}`);
        await finishGoogleSignIn(session);
        router.replace("/home");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập Google.";
        setNotice(message);
        router.replace("/sign-in");
      }
    };

    void run();
  }, [finishGoogleSignIn, params.accessToken, params.error, params.refreshToken, params.user, router, setNotice]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Đang hoàn tất đăng nhập</Text>
        <Text style={styles.text}>Ứng dụng đang nhận lại phiên Google và kiểm tra tài khoản.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f3",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  text: {
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
});
