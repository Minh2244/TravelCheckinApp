import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, Image, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Mascot Area */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="planet" size={48} color="#0d9488" />
          </View>
          <Text style={styles.title}>Chào mừng trở lại!</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để khám phá hàng ngàn điểm đến hấp dẫn.
          </Text>
        </View>

        {/* Bảng Form (Panel) */}
        <View style={styles.formPanel}>
          {notice ? (
            <Pressable style={styles.noticeBox} onPress={clearNotice}>
              <Ionicons name="information-circle" size={20} color="#1d4ed8" />
              <View style={styles.flex1}>
                <Text style={styles.noticeText}>{notice}</Text>
                <Text style={styles.noticeHint}>Chạm để ẩn thông báo này</Text>
              </View>
            </Pressable>
          ) : null}

          {submitError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#be123c" />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          {warning ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#9a3412" />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
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

          <View style={styles.forgotPasswordRow}>
            <Pressable onPress={() => router.push("/forgot-password")}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </Pressable>
          </View>

          <View style={styles.actionGroup}>
            <ActionButton
              label="Đăng nhập"
              loadingLabel="Đang xử lý..."
              onPress={onSubmit}
              disabled={isSubmitting || googleBusy}
              loading={isSubmitting}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable 
              style={[styles.googleButton, (isSubmitting || googleBusy) && styles.googleButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={isSubmitting || googleBusy}
            >
              <Ionicons name="logo-google" size={20} color="#ea4335" />
              <Text style={styles.googleButtonText}>
                {googleBusy ? "Đang mở Google..." : "Đăng nhập bằng Google"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Chuyển hướng Đăng ký */}
        <View style={styles.signUpRow}>
          <Text style={styles.signUpText}>Chưa có tài khoản?</Text>
          <Pressable onPress={() => router.push("/sign-up")}>
            <Text style={styles.signUpLink}>Đăng ký ngay</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#0d9488",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  formPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  formGroup: {
    gap: 20,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
    marginTop: 12,
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: "#0d9488",
    fontWeight: "700",
    fontSize: 14,
  },
  actionGroup: {
    gap: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    color: "#94a3b8",
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    height: 54,
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  signUpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  signUpText: {
    color: "#64748b",
    fontSize: 15,
  },
  signUpLink: {
    color: "#0d9488",
    fontWeight: "800",
    fontSize: 15,
  },
  flex1: {
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#be123c",
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#9a3412",
    lineHeight: 20,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  noticeText: {
    color: "#1d4ed8",
    lineHeight: 20,
    fontWeight: "600",
  },
  noticeHint: {
    color: "#3b82f6",
    fontSize: 12,
    marginTop: 2,
  },
});
