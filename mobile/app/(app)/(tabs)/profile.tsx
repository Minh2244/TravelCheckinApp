import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../../../src/modules/auth/store";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right", "bottom"]}>
      <View
        className="flex-1 px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
      >
        <View className="gap-2 pb-5">
          <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
            Hồ sơ
          </Text>
          <Text className="text-[15px] leading-[23px] text-slate-600">
            Thông tin tài khoản người dùng và phiên đăng nhập hiện tại.
          </Text>
        </View>

        <View className="gap-4 rounded-2xl border border-line bg-white p-5">
          <View className="gap-2">
            <Text className="text-2xl font-extrabold text-slate-900">
              {user?.full_name ?? "Tài khoản người dùng"}
            </Text>
            <Text className="text-[15px] leading-6 text-slate-600">
              Email: {user?.email ?? "Chưa có"}
            </Text>
            <Text className="text-[15px] leading-6 text-slate-600">
              Vai trò: {user?.role ?? "user"}
            </Text>
            <Text className="text-[15px] leading-6 text-slate-600">
              Mỗi lần mở app sẽ cần đăng nhập lại theo yêu cầu dự án hiện tại.
            </Text>
          </View>

          <View className="h-[1px] w-full bg-line" />

          <Pressable
            className="flex-row items-center justify-between py-2"
            onPress={() => router.push("/wallet")}
          >
            <Text className="text-[17px] font-bold text-slate-900">
              Ví vé & Đơn hàng của tôi
            </Text>
            <Text className="text-slate-400">➔</Text>
          </Pressable>

          <View className="h-[1px] w-full bg-line" />

          <Pressable
            className="min-h-[50px] items-center justify-center rounded-2xl bg-brand-600"
            onPress={async () => {
              await signOut();
              router.replace("/sign-in");
            }}
          >
            <Text className="text-base font-extrabold text-white">Đăng xuất</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
