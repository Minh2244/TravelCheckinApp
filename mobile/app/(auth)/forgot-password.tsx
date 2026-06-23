import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../src/components/action-button";
import { FormField } from "../../src/components/form-field";
import { ScreenShell } from "../../src/components/screen-shell";
import { getErrorMessage } from "../../src/lib/error";
import { authApi } from "../../src/modules/auth/auth.api";

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verifiedOtp, setVerifiedOtp] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

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
    <ScreenShell title={screenCopy.title} subtitle={screenCopy.subtitle} onBack={goBack}>
      <View className="gap-[18px]">
        {submitError ? (
          <View className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
            <Text className="leading-5 text-rose-700">{submitError}</Text>
          </View>
        ) : null}

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

            <ActionButton
              label="Gửi mã xác nhận"
              loadingLabel="Đang gửi mã..."
              onPress={submitRequest}
              loading={requestForm.formState.isSubmitting}
              disabled={requestForm.formState.isSubmitting}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View className="gap-1 rounded-xl border border-cyan-200 bg-cyan-50 p-3.5">
              <Text className="text-[13px] font-bold text-brand-600">Thông tin xác nhận</Text>
              <Text className="leading-6 text-cyan-900">Email: {email}</Text>
              <Text className="leading-6 text-cyan-900">Số điện thoại: {phone}</Text>
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

            <ActionButton
              label="Xác nhận mã"
              loadingLabel="Đang kiểm tra mã..."
              onPress={submitOtp}
              loading={otpForm.formState.isSubmitting}
              disabled={otpForm.formState.isSubmitting}
            />

            <View className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              {countdown > 0 ? (
                <Text className="leading-5 text-slate-600">
                  Nếu chưa thấy email, hãy kiểm tra lại sau {countdown} giây.
                </Text>
              ) : (
                <Text className="leading-5 text-slate-600">
                  Backend hiện chưa có route gửi lại mã riêng. Bạn có thể quay lại bước đầu để yêu cầu lại.
                </Text>
              )}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View className="gap-1 rounded-xl border border-cyan-200 bg-cyan-50 p-3.5">
              <Text className="text-[13px] font-bold text-brand-600">Email đang đổi mật khẩu</Text>
              <Text className="leading-6 text-cyan-900">{email}</Text>
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

            <ActionButton
              label="Xác nhận đổi mật khẩu"
              loadingLabel="Đang đổi mật khẩu..."
              onPress={submitReset}
              loading={resetForm.formState.isSubmitting}
              disabled={resetForm.formState.isSubmitting}
            />
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}
