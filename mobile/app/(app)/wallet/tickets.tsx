import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TicketsTab } from "../../../src/components/wallet/TicketsTab";

export default function MyTicketsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationId?: string }>();

  const handleBack = () => {
    const locationId = Number(params.locationId);
    if (Number.isFinite(locationId)) {
      router.replace(`/booking/ticket/all?locationId=${locationId}` as never);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-3 text-[20px] font-extrabold text-slate-900 flex-1">
          Vé du lịch của tôi
        </Text>
      </View>
      <TicketsTab />
    </SafeAreaView>
  );
}
