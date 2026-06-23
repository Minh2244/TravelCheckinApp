import { Pressable, Text } from "react-native";

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
      className={[
        "min-h-14 w-full items-center justify-center rounded-2xl border px-5 py-4",
        variant === "primary"
          ? "border-brand-600 bg-brand-600"
          : "border-slate-300 bg-slate-50",
        isDisabled ? "opacity-60" : "",
      ].join(" ")}
      style={({ pressed }) => (pressed && !isDisabled ? { opacity: 0.92 } : null)}
    >
      <Text
        className={[
          "text-center text-base font-bold",
          variant === "primary" ? "text-white" : "text-slate-900",
        ].join(" ")}
      >
        {currentLabel}
      </Text>
    </Pressable>
  );
}
