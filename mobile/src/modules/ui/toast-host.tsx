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
      className="absolute left-0 right-0 top-0 bottom-0 z-50 items-center justify-center px-6"
    >
      <Pressable
        onPress={hide}
        className="w-full max-w-[340px] rounded-2xl bg-teal-800 px-6 py-5 shadow-2xl border border-teal-600"
      >
        <Text className="text-center text-[16px] font-bold leading-6 text-white">{message}</Text>
      </Pressable>
    </View>
  );
}
