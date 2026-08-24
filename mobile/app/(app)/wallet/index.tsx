import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RoomPassTab } from "../../../src/components/wallet/RoomPassTab";
import { TablePassTab } from "../../../src/components/wallet/TablePassTab";
import { TicketsTab } from "../../../src/components/wallet/TicketsTab";

export default function WalletIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<"tour" | "food" | "hotel">("tour");
  const [downloadRequestKey, setDownloadRequestKey] = useState(0);

  useEffect(() => {
    if (params.tab === "tour" || params.tab === "food" || params.tab === "hotel") {
      setActiveTab(params.tab as "tour" | "food" | "hotel");
    }
  }, [params.tab]);

  const updateTab = (tab: "tour" | "food" | "hotel") => {
    setActiveTab(tab);
    router.setParams({ tab });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-3 flex-1 text-[20px] font-extrabold text-slate-900">
          Vé của tôi
        </Text>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => setDownloadRequestKey((value) => value + 1)}
        >
          <Ionicons name="download-outline" size={22} color="#0f172a" />
        </Pressable>
      </View>

      <View className="flex-row border-b border-line bg-white px-2">
        <Pressable
          className={`flex-1 items-center justify-center border-b-2 py-3 ${
            activeTab === "tour" ? "border-brand-600" : "border-transparent"
          }`}
          onPress={() => updateTab("tour")}
        >
          <Text
            className={`text-[15px] font-bold ${
              activeTab === "tour" ? "text-brand-600" : "text-slate-500"
            }`}
          >
            Du lịch
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 items-center justify-center border-b-2 py-3 ${
            activeTab === "food" ? "border-brand-600" : "border-transparent"
          }`}
          onPress={() => updateTab("food")}
        >
          <Text
            className={`text-[15px] font-bold ${
              activeTab === "food" ? "text-brand-600" : "text-slate-500"
            }`}
          >
            Ăn uống
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 items-center justify-center border-b-2 py-3 ${
            activeTab === "hotel" ? "border-brand-600" : "border-transparent"
          }`}
          onPress={() => updateTab("hotel")}
        >
          <Text
            className={`text-[15px] font-bold ${
              activeTab === "hotel" ? "text-brand-600" : "text-slate-500"
            }`}
          >
            Khách sạn
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 bg-surface">
        {activeTab === "tour" && <TicketsTab downloadRequestKey={downloadRequestKey} />}
        {activeTab === "food" && <TablePassTab downloadRequestKey={downloadRequestKey} />}
        {activeTab === "hotel" && <RoomPassTab downloadRequestKey={downloadRequestKey} />}
      </View>
    </SafeAreaView>
  );
}
