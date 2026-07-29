import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastStore } from "./toast-store";

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visible = useToastStore((state) => state.visible);
  const message = useToastStore((state) => state.message);
  const hide = useToastStore((state) => state.hide);

  if (!visible || !message) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0 z-50 items-end px-3"
      style={{ paddingTop: Math.max(insets.top + 10, 16) }}
    >
      <Pressable
        onPress={hide}
        className="rounded-2xl border border-teal-100 bg-white px-4 py-3 shadow-2xl"
        style={{
          width: Math.min(340, width - 24),
          elevation: 12,
          shadowColor: "#0f766e",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
        }}
      >
        <Text className="text-left text-[14px] font-bold leading-5 text-slate-900">{message}</Text>
      </Pressable>
    </View>
  );
}
