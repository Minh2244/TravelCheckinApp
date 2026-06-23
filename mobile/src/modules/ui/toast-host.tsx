import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastStore } from "./toast-store";

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const visible = useToastStore((state) => state.visible);
  const message = useToastStore((state) => state.message);
  const hide = useToastStore((state) => state.hide);

  if (!visible || !message) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 items-center px-5"
      style={{ top: insets.top + 10 }}
    >
      <Pressable
        onPress={hide}
        className="w-full max-w-[520px] rounded-2xl bg-slate-900/92 px-4 py-3"
      >
        <Text className="text-[14px] font-semibold leading-5 text-white">{message}</Text>
      </Pressable>
    </View>
  );
}
