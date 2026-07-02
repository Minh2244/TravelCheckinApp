import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { userApi } from "../../../src/services/user.api";

type VoucherItem = {
  voucher_id: number;
  code: string | null;
  campaign_name: string | null;
  campaign_description: string | null;
  discount_type: "percent" | "percentage" | "amount" | string | null;
  discount_value: number | string | null;
  min_order_value: number | string | null;
  max_discount_amount: number | string | null;
  start_date: string;
  end_date: string;
  apply_to_service_type: string | null;
  apply_to_location_type: string | null;
  location_name: string | null;
  location_names: string[] | string | null;
  max_uses_per_user: number;
  user_used_count: number;
};

export default function VouchersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ticket" | "food" | "room">("all");

  const fetchVouchers = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await userApi.getMySavedVouchers();
      if (resp?.success) {
        setVouchers((resp.data as any) || []);
      } else {
        setError(resp.message || "Không thể tải voucher");
      }
    } catch (e) {
      console.error(e);
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatShortAmount = (val: number) => {
    if (val >= 1000000) return `${val / 1000000}trđ`;
    if (val >= 1000) return `${val / 1000}kđ`;
    return `${val}đ`;
  };

  useEffect(() => {
    void fetchVouchers();
  }, []);

  const now = new Date();
  const filteredVouchers = vouchers
    .filter((v) => new Date(v.end_date) >= now)
    .filter((v) => {
      if (filter === "all") return true;
      return v.apply_to_service_type === "all" || v.apply_to_service_type === filter;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-3 text-[20px] font-extrabold text-slate-900 flex-1">
          Ví Voucher của tôi
        </Text>
        <Ionicons name="gift" size={22} color="#a855f7" />
      </View>

      {/* Filter Tabs */}
      <View className="flex-row gap-2 px-4 py-3 bg-white border-b border-line">
        {([
          { key: "all", label: "Tất cả" },
          { key: "ticket", label: "Du lịch" },
          { key: "food", label: "Ăn uống" },
          { key: "room", label: "Khách sạn" },
        ] as const).map((item) => {
          const isActive = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              className={`rounded-full px-4 py-1.5 border ${
                isActive
                  ? "bg-purple-600 border-purple-600"
                  : "bg-white border-slate-200"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  isActive ? "text-white" : "text-slate-500"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-500 font-bold text-center">{error}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchVouchers(true)} />
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 14,
          }}
        >
          {filteredVouchers.length === 0 ? (
            <View className="bg-white border border-slate-100 rounded-2xl p-8 items-center mt-8 shadow-sm">
              <View className="w-16 h-16 rounded-full bg-purple-50 items-center justify-center mb-4">
                <Ionicons name="gift-outline" size={32} color="#a855f7" />
              </View>
              <Text className="text-base font-bold text-slate-700 text-center">
                {vouchers.length === 0 ? "Chưa có voucher nào" : "Không tìm thấy voucher phù hợp"}
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1.5 leading-[18px] max-w-[220px]">
                {vouchers.length === 0
                  ? "Vào trang chi tiết địa điểm để thu thập voucher giảm giá hấp dẫn."
                  : "Hãy thử đổi bộ lọc khác."}
              </Text>
            </View>
          ) : (
            filteredVouchers.map((v) => {
              const maxUses = Number(v.max_uses_per_user);
              const used = Number(v.user_used_count || 0);
              const remainingUses = maxUses > 0 ? Math.max(0, maxUses - used) : null;

              const isPercent = v.discount_type === "percent" || v.discount_type === "percentage";

              const discountLabel = isPercent
                ? `-${Number(v.discount_value)}%`
                : `-${(Number(v.discount_value) / 1000).toFixed(0)}k`;

              const locNames = Array.isArray(v.location_names)
                ? v.location_names.filter(Boolean)
                : typeof v.location_names === "string"
                ? (() => {
                    try {
                      return (JSON.parse(v.location_names) as string[]).filter(Boolean);
                    } catch {
                      return [];
                    }
                  })()
                : [];
              const locationText =
                locNames.length > 0
                  ? locNames.join(", ")
                  : v.location_name || "Toàn hệ thống";

              return (
                <View
                  key={v.voucher_id}
                  className="bg-white rounded-2xl flex-row overflow-hidden border border-slate-100 mb-4 shadow-sm"
                  style={{ elevation: 2, height: 140 }}
                >
                  {/* Left Violet Stub */}
                  <View className="relative w-20 bg-indigo-600 justify-center items-center p-2 select-none">
                    {/* Decorative Sparkle */}
                    <View className="absolute top-2 right-2 opacity-50">
                      <Ionicons name="sparkles" size={10} color="#c084fc" />
                    </View>

                    <Text className="text-white font-black text-xl tracking-tight text-center">
                      {discountLabel}
                    </Text>
                    <Text className="text-indigo-200 text-[8px] font-bold tracking-widest mt-0.5 uppercase">
                      GIẢM GIÁ
                    </Text>

                    {/* Silhouette buildings */}
                    <View className="absolute bottom-0 w-full h-6 flex-row items-end opacity-20 px-1 justify-between">
                      <View className="w-[12%] h-[60%] bg-white rounded-t-sm" />
                      <View className="w-[15%] h-[80%] bg-white rounded-t-sm" />
                      <View className="w-[10%] h-[40%] bg-white rounded-t-sm" />
                      <View className="w-[18%] h-[90%] bg-white rounded-t-sm" />
                      <View className="w-[14%] h-[70%] bg-white rounded-t-sm" />
                      <View className="w-[12%] h-[50%] bg-white rounded-t-sm" />
                    </View>
                  </View>

                  {/* Perforated Separator 1 */}
                  <View className="relative w-3 shrink-0 flex-col items-center justify-between py-1 bg-white">
                    <View className="absolute -top-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                    <View className="h-full border-l border-dashed border-slate-200" />
                    <View className="absolute -bottom-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                  </View>

                  {/* Middle Info Block */}
                  <View className="flex-1 p-3 pl-1.5 bg-white justify-between min-w-0">
                    <View>
                      <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                        <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[8px] font-black text-indigo-700 uppercase tracking-wider">
                            MÃ GIẢM GIÁ
                          </Text>
                        </View>
                        {remainingUses !== null && (
                          <View className="bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-full flex-row items-center gap-0.5">
                            <Ionicons name="time-outline" size={8} color="#e11d48" />
                            <Text className="text-[8px] font-bold text-rose-600">
                              Còn {remainingUses}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text className="text-[13px] font-extrabold text-slate-800 leading-snug" numberOfLines={1}>
                        {v.campaign_name || "Voucher đặc biệt"} 🎉
                      </Text>
                      {v.campaign_description ? (
                        <Text className="text-[10px] text-slate-400 mt-0.5 leading-[13px]" numberOfLines={1}>
                          {v.campaign_description}
                        </Text>
                      ) : null}
                    </View>

                    <View className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex-row items-center gap-1 my-0.5">
                      <Ionicons name="card-outline" size={10} color="#6366f1" />
                      <Text className="text-[9px] font-semibold text-slate-600">
                        Đơn tối thiểu: {Number(v.min_order_value) > 0 ? formatShortAmount(Number(v.min_order_value)) : "0đ"}
                      </Text>
                    </View>
                  </View>

                  {/* Perforated Separator 2 */}
                  <View className="relative w-3 shrink-0 flex-col items-center justify-between py-1 bg-white">
                    <View className="absolute -top-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                    <View className="h-full border-l border-dashed border-slate-200" />
                    <View className="absolute -bottom-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                  </View>

                  {/* Right Metadata Block */}
                  <View className="w-28 p-3 bg-slate-50/50 justify-between">
                    <View className="gap-1">
                      <View className="flex-row items-start gap-1">
                        <Ionicons name="calendar-outline" size={9} color="#6366f1" className="mt-0.5" />
                        <View>
                          <Text className="text-[8px] font-bold text-slate-400 leading-none">NSD</Text>
                          <Text className="text-[9px] font-semibold text-slate-600 mt-0.5">{new Date(v.start_date).toLocaleDateString("vi-VN")}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-start gap-1">
                        <Ionicons name="calendar-outline" size={9} color="#6366f1" className="mt-0.5" />
                        <View>
                          <Text className="text-[8px] font-bold text-slate-400 leading-none">HSD</Text>
                          <Text className="text-[9px] font-semibold text-slate-600 mt-0.5">{new Date(v.end_date).toLocaleDateString("vi-VN")}</Text>
                        </View>
                      </View>
                    </View>

                    <View className="border-t border-slate-100 pt-1.5 flex-row items-start gap-1 relative min-w-0">
                      <Ionicons name="location-outline" size={9} color="#f43f5e" className="mt-0.5" />
                      <View className="flex-1 min-w-0">
                        <Text className="text-[8px] font-bold text-slate-400 leading-none">Áp dụng tại</Text>
                        <Text className="text-[9px] text-slate-500 mt-0.5 leading-snug" numberOfLines={2}>
                          {locationText}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
