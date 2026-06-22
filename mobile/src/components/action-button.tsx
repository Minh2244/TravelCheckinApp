import { Pressable, StyleSheet, Text } from "react-native";

type ActionButtonProps = {
  label: string;
  loadingLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
};

export function ActionButton({
  label,
  loadingLabel,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  const currentLabel = loading ? loadingLabel ?? "Đang xử lý..." : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.text, variant === "primary" ? styles.primaryText : styles.secondaryText]}>
        {currentLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    minHeight: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
    shadowColor: "#0f766e",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  secondary: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  primaryText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: "#0f172a",
  },
});
