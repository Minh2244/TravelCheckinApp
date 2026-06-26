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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

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
  const clearNotice = useAuthStore((state) => state.clearNotice);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

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
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 40,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-teal-100">
            <Ionicons name="planet" size={48} color="#0d9488" />
          </View>
          <Text className="mb-2 text-[28px] font-black text-slate-900">Chào mừng trở lại!</Text>
          <Text className="px-5 text-center text-[15px] leading-[22px] text-slate-500">
            Đăng nhập để khám phá hàng ngàn điểm đến hấp dẫn.
          </Text>
        </View>

        <View className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">

          {submitError ? (
            <View className="mb-5 flex-row items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text className="flex-1 leading-5 text-rose-700">{submitError}</Text>
            </View>
          ) : null}

          {warning ? (
            <View className="mb-5 flex-row items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3.5">
              <Ionicons name="warning" size={20} color="#9a3412" />
              <Text className="flex-1 leading-5 text-orange-700">{warning}</Text>
            </View>
          ) : null}

          <View className="gap-5">
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

          <View className="mb-6 mt-3 items-end">
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
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-2">
          <Text className="text-[15px] text-slate-500">Chưa có tài khoản?</Text>
          <Pressable onPress={() => router.push("/sign-up")}>
            <Text className="text-[15px] font-extrabold text-brand-600">Đăng ký ngay</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
