import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirmStore } from "./confirm-store";

export function ConfirmHost() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const current = useConfirmStore((state) => state.current);
  const close = useConfirmStore((state) => state.close);

  if (!current) return null;

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 z-[60] items-end px-3">
      <View
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        style={{
          width: Math.min(360, width - 24),
          marginTop: Math.max(insets.top + 12, 18),
          elevation: 18,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
        }}
      >
        <Text className="text-[16px] font-extrabold text-slate-900">{current.title}</Text>
        {current.message ? (
          <Text className="mt-1.5 text-[13px] leading-5 text-slate-500">{current.message}</Text>
        ) : null}
        <View className="mt-4 flex-row justify-end gap-2">
          <Pressable
            onPress={() => close(false)}
            className="h-10 justify-center rounded-xl border border-slate-200 bg-white px-4"
          >
            <Text className="text-[13px] font-bold text-slate-600">
              {current.cancelText || "Hủy"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => close(true)}
            className={[
              "h-10 justify-center rounded-xl px-4",
              current.destructive ? "bg-rose-600" : "bg-teal-600",
            ].join(" ")}
          >
            <Text className="text-[13px] font-extrabold text-white">
              {current.confirmText || "Xác nhận"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
