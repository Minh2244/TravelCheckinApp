import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
  keyboardType?:
    | "default"
    | "email-address"
    | "number-pad"
    | "phone-pad";
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
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
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
          style={styles.input}
        />
        {secureTextEntry ? (
          <Text style={styles.toggle} onPress={() => setRevealed((current) => !current)}>
            {revealed ? "Ẩn" : "Hiện"}
          </Text>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  inputWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  inputWrapError: {
    borderColor: "#fb7185",
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    paddingVertical: 14,
  },
  toggle: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: "#be123c",
    fontSize: 13,
    lineHeight: 18,
  },
});
