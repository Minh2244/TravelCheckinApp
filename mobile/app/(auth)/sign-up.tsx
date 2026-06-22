import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../src/components/action-button";
import { FormField } from "../../src/components/form-field";
import { ScreenShell } from "../../src/components/screen-shell";
import { getErrorMessage } from "../../src/lib/error";
import { authApi } from "../../src/modules/auth/auth.api";

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
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    <ScreenShell
      title="Tạo tài khoản"
      subtitle="Tạo tài khoản mới để tiếp tục hành trình trên mobile."
      onBack={() => router.back()}
    >
      <View style={styles.formGroup}>
        {submitError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

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

        <ActionButton
          label="Đăng ký"
          loadingLabel="Đang gửi đăng ký..."
          onPress={onSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Đã có tài khoản?</Text>
          <Pressable onPress={() => router.replace("/sign-in")}>
            <Text style={styles.switchLink}>Đăng nhập ngay</Text>
          </Pressable>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  formGroup: {
    gap: 18,
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
  },
  switchText: {
    color: "#475569",
    fontSize: 14,
  },
  switchLink: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 14,
  },
});
