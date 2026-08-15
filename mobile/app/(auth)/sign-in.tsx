import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { WavyDivider } from "../../src/components/WavyDivider";

import { ActionButton } from "../../src/components/action-button";
import { FormField } from "../../src/components/form-field";
import { getErrorMessage } from "../../src/lib/error";
import { beginGoogleSignIn } from "../../src/modules/auth/google";
import { useAuthStore } from "../../src/modules/auth/store";

const signInSchema = z.object({
  email: z.string().trim().email("Vui lòng nhập đúng địa chỉ email."),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((state) => state.signIn);
  const notice = useAuthStore((state) => state.notice);
  const clearNotice = useAuthStore((state) => state.clearNotice);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const { height: screenHeight } = Dimensions.get("window");
  const topSectionHeight = screenHeight * 0.38;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      clearNotice();
      setSubmitError(null);
      const result = await signIn(values.email, values.password);
      setWarning(result.warning ?? null);
      router.replace("/home");
    } catch (error) {
      setWarning(null);
      setSubmitError(getErrorMessage(error));
    }
  });

  const handleGoogleLogin = async () => {
    try {
      clearNotice();
      setSubmitError(null);
      setWarning(null);
      setGoogleBusy(true);

      const session = await beginGoogleSignIn();
      await useAuthStore.getState().finishGoogleSignIn(session);

      router.replace("/home");
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: topSectionHeight, width: "100%", position: "relative" }}>
          <View className="absolute inset-0 bg-blue-600" />

          <View
            style={{ paddingTop: insets.top + 10 }}
            className="absolute inset-0 items-center justify-center"
          >
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-sm overflow-hidden">
              <Image source={require("../../assets/logo-transparent.png")} style={{ width: "105%", height: "105%", resizeMode: "cover", transform: [{ translateX: 2 }] }} />
            </View>
            <Text className="mt-3 text-[24px] font-black tracking-widest text-white uppercase shadow-sm">Dấu Ấn Hành Trình</Text>
            <Text className="mt-1 px-8 text-center text-[13px] italic text-blue-50 font-serif">
              Hành trình hôm nay - Kỷ niệm mai sau.
            </Text>
          </View>

          <WavyDivider color="#f8fafc" height={40} />
        </View>

        <View className="flex-1 bg-slate-50 px-6 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
          <View className="mb-4">
            <Text className="text-[28px] font-extrabold text-slate-800 mb-1">Đăng Nhập</Text>
            <Text className="text-[15px] text-slate-500 mt-1">Chào mừng bạn trở lại!</Text>
          </View>

          {submitError ? (
            <View className="mb-5 flex-row items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text className="flex-1 leading-5 text-rose-700">{submitError}</Text>
            </View>
          ) : null}

          {notice ? (
            <View className="mb-5 flex-row items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text className="flex-1 leading-5 text-rose-700">{notice}</Text>
            </View>
          ) : null}

          {warning ? (
            <View className="mb-5 flex-row items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3.5">
              <Ionicons name="warning" size={20} color="#9a3412" />
              <Text className="flex-1 leading-5 text-orange-700">{warning}</Text>
            </View>
          ) : null}

          <View className="gap-3.5">
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <FormField
                  label="Email"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.email?.message}
                  placeholder="Nhập email của bạn"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <FormField
                  label="Mật khẩu"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.password?.message}
                  placeholder="Nhập mật khẩu"
                />
              )}
            />
          </View>

          <View className="mb-4 mt-2 items-end">
            <Pressable onPress={() => router.push("/forgot-password")}>
              <Text className="text-sm font-bold text-brand-600">Quên mật khẩu?</Text>
            </Pressable>
          </View>

          <View className="gap-4">
            <ActionButton
              label="Đăng nhập"
              loadingLabel="Đang xử lý..."
              onPress={onSubmit}
              disabled={isSubmitting || googleBusy}
              loading={isSubmitting}
            />

            <View className="my-1 flex-row items-center">
              <View className="h-px flex-1 bg-slate-200" />
              <Text className="px-3 text-sm font-medium text-slate-400">hoặc</Text>
              <View className="h-px flex-1 bg-slate-200" />
            </View>

            <Pressable
              className={[
                "h-[54px] flex-row items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white",
                isSubmitting || googleBusy ? "opacity-60" : "",
              ].join(" ")}
              onPress={handleGoogleLogin}
              disabled={isSubmitting || googleBusy}
            >
              <Ionicons name="logo-google" size={20} color="#ea4335" />
              <Text className="text-base font-bold text-slate-700">
                {googleBusy ? "Đang mở Google..." : "Đăng nhập bằng Google"}
              </Text>
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-center gap-2">
            <Text className="text-[15px] text-slate-500">Chưa có tài khoản?</Text>
            <Pressable onPress={() => router.push("/sign-up")}>
              <Text className="text-[15px] font-extrabold text-brand-600">Đăng ký ngay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
