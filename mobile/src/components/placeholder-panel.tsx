import { Pressable, Text, View } from "react-native";

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
    <View className="gap-3 rounded-xl border border-line bg-white p-5">
      <Text className="text-lg font-extrabold text-slate-900">{title}</Text>
      <Text className="leading-6 text-slate-600">{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          className="self-start rounded-xl bg-brand-600 px-4 py-3"
          onPress={() => void onAction()}
        >
          <Text className="font-extrabold text-white">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
