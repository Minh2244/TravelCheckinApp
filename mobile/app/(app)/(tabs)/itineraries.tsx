import { Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function ItinerariesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right", "bottom"]}>
      <View
        className="flex-1 px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
      >
        <View className="gap-2 pb-5">
          <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
            Lịch trình
          </Text>
          <Text className="text-[15px] leading-[23px] text-slate-600">
            Điểm vào đã có để phase sau ghép editor và lịch trình thật.
          </Text>
        </View>

        <View className="gap-3 rounded-2xl border border-line bg-white p-5">
          <Text className="text-lg font-extrabold text-slate-900">Cụm lịch trình</Text>
          <Text className="leading-6 text-slate-600">
            Từ Home bạn đã điều hướng được tới đây. Giai đoạn sau mình sẽ gắn danh sách
            lịch trình, tạo mới và chi tiết từng ngày.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
