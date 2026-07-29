import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../../src/lib/api";
import { travelColors, travelShadow } from "../../../src/theme/travel";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  {
    id: 1,
    q: "Làm sao để đổi thông tin cá nhân?",
    a: "Bạn có thể vào mục Hồ sơ ở thanh điều hướng dưới cùng, sau đó nhập thông tin mới và bấm Lưu thay đổi."
  },
  {
    id: 2,
    q: "Cách tạo lịch trình mới như thế nào?",
    a: "Tại trang chủ, bạn có thể chọn một địa điểm yêu thích và bấm vào biểu tượng Lịch trình, hoặc truy cập tiện ích Lịch trình để tạo thủ công."
  },
  {
    id: 3,
    q: "Ứng dụng có thu phí không?",
    a: "Travel Check-in hoàn toàn miễn phí cho người dùng. Bạn có thể thoải mái khám phá và lên lịch trình du lịch."
  }
];


export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [publicSettings, setPublicSettings] = useState<{
    support_hotline?: string;
    support_email?: string;
    support_zalo?: string;
  }>({});
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    api.get("/auth/public-settings")
      .then(res => setPublicSettings(res.data.data))
      .catch(console.error);
  }, []);

  const toggleFaq = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === id ? null : id);
  };



  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <View
        className="bg-brand-500 px-5 pt-4 pb-8 z-10 overflow-hidden relative"
        style={{
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        {/* Background Pattern */}
        <View className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white opacity-10" />
        <View className="absolute top-20 -left-12 w-32 h-32 rounded-full bg-white opacity-[0.05]" />
        <View className="absolute -bottom-8 right-16 w-24 h-24 rounded-full bg-brand-200 opacity-20" />
        <View className="absolute top-8 right-6 opacity-20 rotate-12">
          <Ionicons name="headset" size={80} color="#ffffff" />
        </View>

        <Pressable
          onPress={() => router.back()}
          className="relative z-10 mb-4 h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
          accessibilityRole="button"
          accessibilityLabel="Quay lại hồ sơ"
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-[26px] font-black text-white tracking-tight mb-1 relative z-10">Trợ giúp</Text>
        <Text className="text-[14px] font-medium text-white/80 relative z-10">Chúng tôi có thể giúp gì cho bạn hôm nay?</Text>
        
        <Pressable 
          className="mt-5 flex-row items-center rounded-2xl bg-white px-4 py-3 relative z-10 active:bg-slate-50" 
          style={travelShadow}
          onPress={() => {
            const email = publicSettings.support_email || "admin@travelcheckin.com";
            Linking.openURL(`mailto:${email}?subject=${encodeURIComponent("Góp ý & Phản hồi ứng dụng Travel Check-in")}`);
          }}
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
            <Ionicons name="bulb" size={20} color={travelColors.teal} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-bold text-ink">Góp ý & Phản hồi</Text>
            <Text className="text-[12px] font-medium text-muted mt-0.5">Giúp chúng tôi cải thiện ứng dụng</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >

        <Text className="text-[18px] font-extrabold text-ink mb-4">Câu hỏi thường gặp</Text>
        <View className="mb-8 rounded-3xl bg-white" style={travelShadow}>
          {FAQS.map((faq, index) => (
            <View key={faq.id} className={index !== FAQS.length - 1 ? "border-b border-slate-100" : ""}>
              <Pressable
                className="flex-row items-center justify-between p-5 active:bg-slate-50"
                onPress={() => toggleFaq(faq.id)}
              >
                  <Text className="flex-1 pr-4 text-[15px] font-bold text-ink leading-5">
                    {faq.q}
                  </Text>
                  <Ionicons 
                    name={expandedFaq === faq.id ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={travelColors.teal} 
                  />
                </Pressable>
                {expandedFaq === faq.id && (
                  <View className="px-5 pb-5 pt-1">
                    <Text className="text-[14px] leading-6 text-slate-600 font-medium">{faq.a}</Text>
                  </View>
                )}
              </View>
            ))
          }
        </View>

        <Text className="text-[18px] font-extrabold text-ink mb-4">Liên hệ trực tiếp</Text>
        <View className="gap-3">
          {publicSettings.support_zalo && (
            <Pressable
              className="flex-row items-center gap-4 rounded-3xl bg-white p-4 active:bg-slate-50"
              style={travelShadow}
              onPress={() => Linking.openURL(publicSettings.support_zalo!)}
            >
              <View className="h-[52px] w-[52px] items-center justify-center rounded-[20px] bg-[#e8f2ff]">
                <Text className="text-[26px] font-black text-[#0068ff]">Z</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-extrabold text-ink mb-1">Chat qua Zalo</Text>
                <Text className="text-[13px] font-medium text-muted">Hỗ trợ trực tuyến nhanh chóng</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>
          )}

          {publicSettings.support_hotline && (
            <Pressable
              className="flex-row items-center gap-4 rounded-3xl bg-white p-4 active:bg-slate-50"
              style={travelShadow}
              onPress={() => Linking.openURL(`tel:${publicSettings.support_hotline}`)}
            >
              <View className="h-[52px] w-[52px] items-center justify-center rounded-[20px] bg-[#fff7df]">
                <Ionicons name="call" size={24} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-extrabold text-ink mb-1">Gọi Hotline</Text>
                <Text className="text-[13px] font-medium text-muted">Hỗ trợ khẩn cấp 24/7</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>
          )}

          {publicSettings.support_email && (
            <Pressable
              className="flex-row items-center gap-4 rounded-3xl bg-white p-4 active:bg-slate-50"
              style={travelShadow}
              onPress={() => Linking.openURL(`mailto:${publicSettings.support_email}?subject=${encodeURIComponent("Yêu cầu hỗ trợ từ hệ thống Travel Check-in")}`)}
            >
              <View className="h-[52px] w-[52px] items-center justify-center rounded-[20px] bg-ai-50">
                <Ionicons name="mail" size={24} color={travelColors.purple} />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-extrabold text-ink mb-1">Gửi Email</Text>
                <Text className="text-[13px] font-medium text-muted">Giải đáp thắc mắc chi tiết</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>
          )}

          {!publicSettings.support_hotline && !publicSettings.support_email && !publicSettings.support_zalo && (
            <View className="items-center mt-4">
              <Text className="text-muted text-[14px]">Hiện tại chưa có thông tin liên hệ.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
