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
        setVouchers(resp.data || []);
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
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
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
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isActive ? "text-white" : "text-slate-600"
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
            gap: 12,
          }}
        >
          {filteredVouchers.length === 0 ? (
            <View className="bg-white border border-line rounded-2xl p-6 items-center">
              <Ionicons name="gift-outline" size={40} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
                {vouchers.length === 0
                  ? "Bạn chưa có voucher nào"
                  : "Không tìm thấy voucher phù hợp"}
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                {vouchers.length === 0
                  ? "Hãy vào trang chi tiết địa điểm để thu thập các voucher giảm giá cực hấp dẫn."
                  : "Hãy thử đổi bộ lọc khác."}
              </Text>
            </View>
          ) : (
            filteredVouchers.map((v) => {
              const maxUses = Number(v.max_uses_per_user);
              const used = Number(v.user_used_count || 0);
              const remainingUses = maxUses > 0 ? Math.max(0, maxUses - used) : null;
              
              const isPercent = v.discount_type === "percent" || v.discount_type === "percentage";
              const discountText = isPercent
                ? `GIẢM ${Number(v.discount_value)}%`
                : `GIẢM ${Number(v.discount_value).toLocaleString("vi-VN")}đ`;

              const locNames = Array.isArray(v.location_names)
                ? v.location_names.filter(Boolean)
                : typeof v.location_names === "string"
                ? JSON.parse(v.location_names).filter(Boolean)
                : [];
              const locationText =
                locNames.length > 0
                  ? locNames.join(", ")
                  : v.location_name || "Toàn hệ thống";

              return (
                <View
                  key={v.voucher_id}
                  className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 via-amber-50/10 to-white p-4 shadow-sm"
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="text-base font-black text-rose-700">
                      🎫 {discountText}
                    </Text>
                    {remainingUses !== null && (
                      <View className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-rose-600">
                          Còn lại: {remainingUses} lượt
                        </Text>
                      </View>
                    )}
                  </View>

                  {isPercent && v.max_discount_amount && (
                    <Text className="text-[11px] font-bold text-rose-600 mt-1">
                      Giảm tối đa: {formatCurrency(Number(v.max_discount_amount))}
                    </Text>
                  )}

                  <Text className="text-[14px] font-extrabold text-slate-800 mt-2">
                    {v.campaign_name || "Mã giảm giá"}
                  </Text>

                  <Text className="text-xs text-slate-500 mt-1 leading-[18px]">
                    {v.campaign_description || "Không có mô tả chi tiết."}
                  </Text>

                  {Number(v.min_order_value) > 0 && (
                    <Text className="text-xs font-semibold text-slate-600 mt-1">
                      Đơn tối thiểu: {formatCurrency(Number(v.min_order_value))}
                    </Text>
                  )}

                  <View className="h-[1px] bg-slate-100 w-full my-3" />

                  <View className="flex-row justify-between items-center text-[10px] text-slate-400">
                    <Text className="text-[10px] text-slate-400">
                      HSD: {new Date(v.end_date).toLocaleDateString("vi-VN")}
                    </Text>
                    <Text className="text-[10px] text-slate-400 font-semibold" numberOfLines={1}>
                      Áp dụng: {locationText}
                    </Text>
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
