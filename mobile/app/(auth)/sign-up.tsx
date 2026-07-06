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
  ImageBackground,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { ActionButton } from "../../src/components/action-button";
import { FormField } from "../../src/components/form-field";
import { getErrorMessage } from "../../src/lib/error";
import { authApi } from "../../src/modules/auth/auth.api";
import { resolveBackendUrl } from "../../src/lib/url";
import { WavyDivider } from "../../src/components/WavyDivider";

const signUpSchema = z
  .object({
    full_name: z.string().trim().min(2, "Vui lòng nhập họ và tên đầy đủ."),
    email: z.string().trim().email("Vui lòng nhập đúng địa chỉ email."),
    phone: z
      .string()
      .trim()
      .min(9, "Số điện thoại cần ít nhất 9 chữ số.")
      .regex(/^[0-9+\s()-]+$/, "Số điện thoại chỉ nên chứa chữ số và ký tự liên quan."),
    password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
    confirmPassword: z.string().min(6, "Vui lòng nhập lại mật khẩu."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { height: screenHeight } = Dimensions.get("window");
  const topSectionHeight = screenHeight * 0.38;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setSubmitError(null);

      await authApi.register({
        email: values.email,
        phone: values.phone,
        password: values.password,
        full_name: values.full_name,
      });

      router.push({
        pathname: "/verify-email",
        params: {
          email: values.email,
        },
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Section */}
        <View style={{ height: topSectionHeight, width: "100%", position: "relative" }}>
          <View className="absolute inset-0 bg-blue-600" />

          {/* Logo Content */}
          <View
            style={{ paddingTop: insets.top + 10 }}
            className="absolute inset-0 items-center justify-center"
          >
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-sm overflow-hidden">
              <Image source={require("../../assets/logo-transparent.png")} style={{ width: "105%", height: "105%", resizeMode: "cover", transform: [{ translateX: 2 }] }} />
            </View>
            <Text className="mt-3 text-[24px] font-black tracking-widest text-white uppercase shadow-sm">Dấu Ấn Hành Trình</Text>
          </View>

          {/* Wavy Divider */}
          <WavyDivider color="#f8fafc" height={40} />
        </View>

        {/* Bottom Section (Form) */}
        <View className="flex-1 bg-slate-50 px-6 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-[26px] font-extrabold text-slate-800">Đăng Ký</Text>
              <Text className="text-sm text-slate-500 mt-1">Tạo tài khoản mới</Text>
            </View>
            <Pressable onPress={() => router.back()} className="p-2 bg-slate-200/50 rounded-full">
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          {submitError ? (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text className="flex-1 leading-5 text-rose-700">{submitError}</Text>
            </View>
          ) : null}

          <View className="gap-3.5">
            <Controller
              control={control}
              name="full_name"
              render={({ field }) => (
                <FormField
                  label="Họ và tên"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.full_name?.message}
                  placeholder="Nhập họ và tên"
                />
              )}
            />

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
                  placeholder="Nhập email"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <FormField
                  label="Số điện thoại"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  keyboardType="phone-pad"
                  error={errors.phone?.message}
                  placeholder="Nhập số điện thoại"
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
                  placeholder="Tạo mật khẩu"
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <FormField
                  label="Nhập lại mật khẩu"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.confirmPassword?.message}
                  placeholder="Nhập lại mật khẩu"
                />
              )}
            />
          </View>

          <View className="mt-5 gap-3.5">
            <ActionButton
              label="Đăng ký"
              loadingLabel="Đang gửi đăng ký..."
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-center gap-2">
            <Text className="text-[15px] text-slate-500">Đã có tài khoản?</Text>
            <Pressable onPress={() => router.replace("/sign-in")}>
              <Text className="text-[15px] font-extrabold text-blue-600">Đăng nhập ngay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
