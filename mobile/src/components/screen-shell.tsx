import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  View,
  ViewStyle,
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
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scrollable ? (
          <ScrollView
            className="flex-1"
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 18) + 18,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 w-full max-w-[560px] self-center gap-[18px]" style={contentStyle}>
              {onBack ? (
                <Pressable onPress={onBack} className="self-start py-2 pr-4">
                  <Text className="text-[15px] font-bold text-brand-600">Quay lại</Text>
                </Pressable>
              ) : null}

              {!hideHeader ? (
                <View className="gap-2 pt-2">
                  <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text className="text-[15px] leading-[23px] text-slate-600">{subtitle}</Text>
                  ) : null}
                </View>
              ) : null}

              {framed ? (
                <View className="gap-4 rounded-xl border border-line bg-white p-[18px]">
                  {children}
                </View>
              ) : (
                children
              )}
            </View>
          </ScrollView>
        ) : (
          <View
            className="flex-1 px-5 pt-3"
            style={[
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
              contentStyle,
            ]}
          >
            <View className="flex-1 w-full max-w-[560px] self-center gap-[18px]">
              {onBack ? (
                <Pressable onPress={onBack} className="self-start py-2 pr-4">
                  <Text className="text-[15px] font-bold text-brand-600">Quay lại</Text>
                </Pressable>
              ) : null}

              {!hideHeader ? (
                <View className="gap-2 pt-2">
                  <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text className="text-[15px] leading-[23px] text-slate-600">{subtitle}</Text>
                  ) : null}
                </View>
              ) : null}

              <View className="flex-1">
                {framed ? (
                  <View className="gap-4 rounded-xl border border-line bg-white p-[18px]">
                    {children}
                  </View>
                ) : (
                  children
                )}
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
