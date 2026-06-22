import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../src/components/action-button";
import { FormField } from "../../src/components/form-field";
import { ScreenShell } from "../../src/components/screen-shell";
import { getErrorMessage } from "../../src/lib/error";
import { authApi } from "../../src/modules/auth/auth.api";

const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .length(6, "Mã xác thực cần đủ 6 chữ số.")
    .regex(/^[0-9]{6}$/, "Mã xác thực chỉ gồm 6 chữ số."),
});

type OtpValues = z.infer<typeof otpSchema>;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = useMemo(() => {
    if (Array.isArray(params.email)) {
      return params.email[0] ?? "";
    }

    return params.email ?? "";
  }, [params.email]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpValues>({
    defaultValues: {
      otp: "",
    },
    resolver: zodResolver(otpSchema),
  });

  useEffect(() => {
    if (!email) {
      router.replace("/sign-up");
      return;
    }

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
  }, [email, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      await authApi.verifyOTP({
        email,
        otp: values.otp,
      });

      router.replace("/sign-in");
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <ScreenShell
      title="Xác thực email"
      subtitle="Nhập mã 6 số mà hệ thống vừa gửi tới email của bạn."
      onBack={() => router.back()}
    >
      <View style={styles.formGroup}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Email nhận mã</Text>
          <Text style={styles.infoValue}>{email || "Chưa có email hợp lệ"}</Text>
        </View>

        {submitError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Controller
          control={control}
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
              error={errors.otp?.message}
              placeholder="Nhập 6 chữ số"
            />
          )}
        />

        <ActionButton
          label="Xác nhận mã"
          loadingLabel="Đang kiểm tra mã..."
          onPress={onSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !email}
        />

        <View style={styles.helperBox}>
          {countdown > 0 ? (
            <Text style={styles.helperText}>
              Bạn có thể quay lại màn đăng ký để gửi yêu cầu mới sau {countdown} giây.
            </Text>
          ) : (
            <Text style={styles.helperText}>
              Backend hiện chưa có route gửi lại mã riêng. Nếu cần mã mới, hãy quay lại màn đăng ký.
            </Text>
          )}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  formGroup: {
    gap: 18,
  },
  infoBox: {
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  infoLabel: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "700",
  },
  infoValue: {
    color: "#164e63",
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    color: "#be123c",
    lineHeight: 20,
  },
  helperBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
  },
  helperText: {
    color: "#475569",
    lineHeight: 20,
  },
});
