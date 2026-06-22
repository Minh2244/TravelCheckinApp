import { Pressable, StyleSheet, Text, View } from "react-native";

type PlaceholderPanelProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

export function PlaceholderPanel({
  title,
  description,
  actionLabel,
  onAction,
}: PlaceholderPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={() => void onAction()}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 12,
  },
  title: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 18,
  },
  description: {
    color: "#475569",
    lineHeight: 22,
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#0f766e",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
