import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { formatDate, formatTime } from "../../../src/lib/booking-utils";
import { getErrorMessage } from "../../../src/lib/error";
import { showToast } from "../../../src/modules/ui/toast-store";
import { QRCodeModal } from "../../../src/components/ui/QRCodeModal";
import { bookingApi } from "../../../src/services/booking.api";
import type { TableReservationItem } from "../../../src/types/booking";

const STATUS_MAP: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: "Chờ duyệt", color: "text-amber-600", bg: "bg-amber-100 border-amber-200" },
  confirmed: { text: "Đã duyệt", color: "text-brand-600", bg: "bg-brand-100 border-brand-200" },
  completed: { text: "Hoàn tất", color: "text-slate-600", bg: "bg-slate-200 border-slate-300" },
  cancelled: { text: "Đã hủy", color: "text-red-600", bg: "bg-red-100 border-red-200" },
};

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { text: status, color: "text-slate-600", bg: "bg-slate-200 border-slate-300" };
}

export function TablePassTab() {
  const router = useRouter();
  const [passes, setPasses] = useState<TableReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState<number | null>(null);
  const [tab, setTab] = useState<"active" | "cancelled">("active");
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const res = await bookingApi.getMyTablePass();
      setPasses(res.data || []);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPasses();
    const sub = DeviceEventEmitter.addListener("booking_updated", fetchPasses);
    return () => sub.remove();
  }, [fetchPasses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPasses();
  }, [fetchPasses]);

  const filteredPasses = useMemo(() => {
    return passes.filter((p) => {
      const isCancelled = p.bookingStatus === "cancelled";
      return tab === "cancelled" ? isCancelled : !isCancelled;
    });
  }, [passes, tab]);

  const handleCancel = (bookingId: number) => {
    Alert.alert(
      "Xác nhận hủy",
      "Bạn có chắc chắn muốn hủy đơn đặt bàn này không?",
      [
        { text: "Bỏ qua", style: "cancel" },
        {
          text: "Hủy đơn",
          style: "destructive",
          onPress: async () => {
            setCanceling(bookingId);
            try {
              await bookingApi.cancelMyBooking(bookingId);
              showToast("Đã hủy đơn thành công.");
              fetchPasses();
            } catch (error) {
              showToast(getErrorMessage(error));
            } finally {
              setCanceling(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TableReservationItem }) => {
    const statusInfo = getStatusInfo(item.bookingStatus);
    const qrUrl = item.secureCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          item.secureCode
        )}`
      : null;

    const isPaid = item.paymentStatus === "completed" || item.posOrderId != null;
    const isInactive = ["completed", "cancelled", "expired"].includes(item.bookingStatus);

    return (
      <View className="mb-4 flex-row overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-200">
        {/* Left Side: Ticket Info */}
        <View className="flex-1 border-r-2 border-dashed border-slate-100 p-4">
          {/* Status Header */}
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-bold text-brand-700">
              Hóa đơn: <Text className="text-slate-800">{item.invoiceCode || `NH-${item.bookingId}`}</Text>
            </Text>
            <View className={`rounded px-2 py-0.5 border ${statusInfo.bg}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusInfo.color}`}>
                {statusInfo.text}
              </Text>
            </View>
          </View>

          <Text className="mb-3 text-base font-extrabold text-slate-900">
            {item.locationName || "Nhà hàng"}
          </Text>

          <View className="mb-2 flex-row flex-wrap">
            <View className="mb-2 w-[55%] pr-2">
              <Text className="mb-1 text-xs text-slate-500">Thời gian:</Text>
              <Text className="text-xs font-bold text-slate-800">
                {formatDate(item.checkInDate)}
              </Text>
            </View>
            <View className="mb-2 w-[45%]">
              <Text className="mb-1 text-xs text-slate-500">Bàn ăn:</Text>
              <Text className="text-xs font-bold text-brand-600">
                {item.tableNames && item.tableNames.length > 0 ? item.tableNames.join(", ") : "-"}
              </Text>
            </View>
          </View>

          <View className="mb-2 flex-row flex-wrap">
            <View className="mb-2 w-[55%] pr-2">
              <Text className="mb-1 text-xs text-slate-500">Đặt cọc:</Text>
              <Text className="text-xs font-bold text-slate-800">
                {item.totalAmount ? `${item.totalAmount.toLocaleString("vi-VN")} đ` : "Miễn phí"}
              </Text>
            </View>
            <View className="mb-2 w-[45%]">
              <Text className="mb-1 text-xs text-slate-500">Khách hàng:</Text>
              <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                {item.contactName}
              </Text>
              {item.contactPhone && (
                <Text className="text-xs text-slate-500">{item.contactPhone}</Text>
              )}
            </View>
          </View>

          {item.canCancel && (
            <Pressable
              onPress={() => handleCancel(item.bookingId)}
              disabled={canceling === item.bookingId}
              className={`mt-2 self-start rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 ${
                canceling === item.bookingId ? "opacity-50" : ""
              }`}
            >
              <Text className="text-[11px] font-bold text-red-600">
                {canceling === item.bookingId ? "Đang xử lý..." : "Hủy đặt bàn"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Right Side: QR Code */}
        <View className="relative w-[110px] items-center justify-center bg-brand-50/30 p-2">
          {/* Ticket notch cutouts */}
          <View className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-surface" />
          <View className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-surface" />

          {isPaid && (
            <View className="mb-3 rounded bg-brand-100 px-1 py-0.5 border border-brand-200">
              <Text className="text-[8px] font-bold uppercase text-brand-700">Đã Thanh Toán</Text>
            </View>
          )}

          {qrUrl ? (
            <>
              <Pressable 
                className={`mb-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm ${isInactive ? 'opacity-20' : ''}`}
                onPress={() => { if (!isInactive) setSelectedQr(qrUrl); }}
              >
                <Image source={{ uri: qrUrl }} style={{ width: 70, height: 70 }} resizeMode="contain" />
              </Pressable>
              <Text className={`text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest ${isInactive ? 'opacity-50' : ''}`}>
                Mã vé: {item.secureCode}
              </Text>
            </>
          ) : (
            <View className="h-16 items-center justify-center">
              <Ionicons name="qr-code-outline" size={32} color="#cbd5e1" />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface">

      <View className="flex-row bg-white px-4 pt-2 border-b border-line">
        <Pressable
          className={`flex-1 items-center pb-3 border-b-2 ${
            tab === "active" ? "border-brand-600" : "border-transparent"
          }`}
          onPress={() => setTab("active")}
        >
          <Text
            className={`font-bold ${
              tab === "active" ? "text-brand-600" : "text-slate-500"
            }`}
          >
            Đang hiệu lực
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 items-center pb-3 border-b-2 ${
            tab === "cancelled" ? "border-brand-600" : "border-transparent"
          }`}
          onPress={() => setTab("cancelled")}
        >
          <Text
            className={`font-bold ${
              tab === "cancelled" ? "text-brand-600" : "text-slate-500"
            }`}
          >
            Đã bị hủy
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={filteredPasses}
          keyExtractor={(item) => String(item.bookingId)}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <Ionicons name="restaurant-outline" size={64} color="#cbd5e1" />
              <Text className="mt-4 text-center text-[16px] text-slate-500">
                {tab === "active" ? "Bạn chưa có vé bàn nào đang hiệu lực." : "Bạn không có vé nào bị hủy."}
              </Text>
            </View>
          }
        />
      )}
      <QRCodeModal visible={!!selectedQr} qrUrl={selectedQr} onClose={() => setSelectedQr(null)} />
    </View>
  );
}
