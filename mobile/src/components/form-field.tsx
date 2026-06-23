import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
};

export function FormField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  secureTextEntry = false,
  autoCapitalize = "sentences",
  autoCorrect = false,
  keyboardType = "default",
}: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-slate-800">{label}</Text>
      <View
        className={[
          "min-h-[52px] flex-row items-center gap-3 rounded-xl border bg-white px-4",
          error ? "border-rose-400" : "border-slate-300",
        ].join(" ")}
      >
        <TextInput
          value={value}
          onBlur={() => onBlur?.()}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureTextEntry && !revealed}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          className="flex-1 py-3.5 text-[15px] text-slate-900"
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setRevealed((current) => !current)} hitSlop={10}>
            <Text className="text-sm font-bold text-brand-600">
              {revealed ? "Ẩn" : "Hiện"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-[13px] leading-[18px] text-rose-700">{error}</Text> : null}
    </View>
  );
}
