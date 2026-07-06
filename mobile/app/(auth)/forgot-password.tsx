import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
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

const requestSchema = z.object({
  email: z.string().trim().email("Vui lòng nhập đúng địa chỉ email."),
  phone: z
    .string()
    .trim()
    .min(9, "Số điện thoại cần ít nhất 9 chữ số.")
    .regex(/^[0-9+\s()-]+$/, "Số điện thoại chỉ nên chứa chữ số và ký tự liên quan."),
});

const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .length(6, "Mã xác thực cần đủ 6 chữ số.")
    .regex(/^[0-9]{6}$/, "Mã xác thực chỉ gồm 6 chữ số."),
});

const resetSchema = z
  .object({
    newPassword: z.string().min(6, "Mật khẩu mới cần ít nhất 6 ký tự."),
    confirmPassword: z.string().min(6, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  });

type RequestValues = z.infer<typeof requestSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verifiedOtp, setVerifiedOtp] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const { height: screenHeight } = Dimensions.get("window");
  const topSectionHeight = screenHeight * 0.38;

  const requestForm = useForm<RequestValues>({
    defaultValues: {
      email: "",
      phone: "",
    },
    resolver: zodResolver(requestSchema),
  });

  const otpForm = useForm<OtpValues>({
    defaultValues: {
      otp: "",
    },
    resolver: zodResolver(otpSchema),
  });

  const resetForm = useForm<ResetValues>({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    if (step !== 2) {
      return;
    }

    setCountdown(60);

    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  const screenCopy = useMemo(() => {
    if (step === 1) {
      return {
        title: "Quên mật khẩu",
        subtitle: "Nhập đúng email và số điện thoại để nhận mã xác thực.",
      };
    }

    if (step === 2) {
      return {
        title: "Xác nhận mã",
        subtitle: "Nhập mã 6 số vừa gửi tới email của bạn.",
      };
    }

    return {
      title: "Đặt mật khẩu mới",
      subtitle: "Sau khi đổi xong, bạn sẽ được đưa về màn đăng nhập.",
    };
  }, [step]);

  const goBack = () => {
    setSubmitError(null);

    if (step === 1) {
      router.back();
      return;
    }

    if (step === 2) {
      setStep(1);
      return;
    }

    setStep(2);
  };

  const submitRequest = requestForm.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      await authApi.forgotPassword(values);
      setEmail(values.email);
      setPhone(values.phone);
      setStep(2);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const submitOtp = otpForm.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      await authApi.verifyResetOTP({
        email,
        otp: values.otp,
      });
      setVerifiedOtp(values.otp);
      setStep(3);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const submitReset = resetForm.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      await authApi.resetPassword({
        email,
        otp: verifiedOtp,
        newPassword: values.newPassword,
      });
      router.replace("/sign-in");
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
              <Text className="text-[26px] font-extrabold text-slate-800">{screenCopy.title}</Text>
              <Text className="text-sm text-slate-500 mt-1 max-w-[250px]">{screenCopy.subtitle}</Text>
            </View>
            <Pressable onPress={goBack} className="p-2 bg-slate-200/50 rounded-full">
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          {submitError ? (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text className="flex-1 leading-5 text-rose-700">{submitError}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {step === 1 ? (
              <>
                <Controller
                  control={requestForm.control}
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
                      error={requestForm.formState.errors.email?.message}
                      placeholder="Nhập email"
                    />
                  )}
                />

                <Controller
                  control={requestForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormField
                      label="Số điện thoại"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      keyboardType="phone-pad"
                      error={requestForm.formState.errors.phone?.message}
                      placeholder="Nhập số điện thoại"
                    />
                  )}
                />

                <View className="mt-4">
                  <ActionButton
                    label="Gửi mã xác nhận"
                    loadingLabel="Đang gửi mã..."
                    onPress={submitRequest}
                    loading={requestForm.formState.isSubmitting}
                    disabled={requestForm.formState.isSubmitting}
                  />
                </View>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <View className="gap-1 rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-2">
                  <Text className="text-sm font-bold text-blue-600">Thông tin xác nhận</Text>
                  <Text className="leading-6 text-blue-900">Email: {email}</Text>
                  <Text className="leading-6 text-blue-900">Số điện thoại: {phone}</Text>
                </View>

                <Controller
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormField
                      label="Mã xác thực"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      error={otpForm.formState.errors.otp?.message}
                      placeholder="Nhập 6 chữ số"
                    />
                  )}
                />

                <View className="mt-3 gap-3">
                  <ActionButton
                    label="Xác nhận mã"
                    loadingLabel="Đang kiểm tra mã..."
                    onPress={submitOtp}
                    loading={otpForm.formState.isSubmitting}
                    disabled={otpForm.formState.isSubmitting}
                  />

                  <View className="rounded-2xl border border-slate-200 bg-white p-4">
                    {countdown > 0 ? (
                      <Text className="text-sm leading-5 text-slate-500">
                        Nếu chưa thấy email, hãy kiểm tra lại sau {countdown} giây.
                      </Text>
                    ) : (
                      <Text className="text-sm leading-5 text-slate-500">
                        Bạn có thể quay lại bước đầu để yêu cầu gửi lại mã.
                      </Text>
                    )}
                  </View>
                </View>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <View className="gap-1 rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-2">
                  <Text className="text-sm font-bold text-blue-600">Email đang đổi mật khẩu</Text>
                  <Text className="leading-6 text-blue-900">{email}</Text>
                </View>

                <Controller
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormField
                      label="Mật khẩu mới"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      error={resetForm.formState.errors.newPassword?.message}
                      placeholder="Nhập mật khẩu mới"
                    />
                  )}
                />

                <Controller
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormField
                      label="Nhập lại mật khẩu mới"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      error={resetForm.formState.errors.confirmPassword?.message}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  )}
                />

                <View className="mt-4">
                  <ActionButton
                    label="Xác nhận đổi mật khẩu"
                    loadingLabel="Đang đổi mật khẩu..."
                    onPress={submitReset}
                    loading={resetForm.formState.isSubmitting}
                    disabled={resetForm.formState.isSubmitting}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
