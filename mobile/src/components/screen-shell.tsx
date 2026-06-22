import { ReactNode } from "react";
import {
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  framed?: boolean;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  hideHeader?: boolean;
};

export function ScreenShell({
  title,
  subtitle,
  children,
  onBack,
  framed = true,
  scrollable = true,
  contentStyle,
  hideHeader = false,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.container, contentStyle]}>
              {onBack ? (
                <Pressable onPress={onBack} style={styles.backButton}>
                  <Text style={styles.backLabel}>Quay lại</Text>
                </Pressable>
              ) : null}

              {!hideHeader ? (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
              ) : null}

              {framed ? <View style={styles.panel}>{children}</View> : children}
            </View>
          </ScrollView>
        ) : (
          <View
            style={[
              styles.flex,
              styles.nonScrollableContent,
              {
                paddingBottom: 24,
              },
              contentStyle,
            ]}
          >
            <View style={styles.container}>
              {onBack ? (
                <Pressable onPress={onBack} style={styles.backButton}>
                  <Text style={styles.backLabel}>Quay lại</Text>
                </Pressable>
              ) : null}

              {!hideHeader ? (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
              ) : null}

              <View style={styles.flex}>{framed ? <View style={styles.panel}>{children}</View> : children}</View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#eef2f3",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    gap: 18,
    flex: 1,
  },
  nonScrollableContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: 16,
  },
  backLabel: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 15,
  },
  header: {
    gap: 8,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 34,
  },
  subtitle: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 23,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ea",
    borderRadius: 12,
    padding: 18,
    gap: 16,
  },
});
