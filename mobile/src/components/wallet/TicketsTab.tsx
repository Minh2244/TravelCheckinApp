import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { formatDate } from "../../../src/lib/booking-utils";
import { getErrorMessage } from "../../../src/lib/error";
import { showToast } from "../../../src/modules/ui/toast-store";
import { QRCodeModal } from "../../../src/components/ui/QRCodeModal";
import { userApi } from "../../../src/services/user.api";
import type { TouristTicket } from "../../../src/types/booking";
import { resolveBackendUrl } from "../../../src/lib/url";

const getFirstImage = (imagesData: any) => {
  if (!imagesData) return null;
  
  if (Array.isArray(imagesData)) {
    return imagesData.length > 0 ? resolveBackendUrl(imagesData[0]) : null;
  }
  
  if (typeof imagesData === "string") {
    try {
      const parsed = JSON.parse(imagesData);
      if (Array.isArray(parsed) && parsed.length > 0) return resolveBackendUrl(parsed[0]);
    } catch {
      return resolveBackendUrl(imagesData);
    }
  }
  
  return null;
};

type GroupedTickets = {
  bookingId: number;
  locationName: string;
  useDate: string | null;
  tickets: TouristTicket[];
};

export function TicketsTab() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TouristTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await userApi.getTouristTickets();
      setTickets(res.data || []);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const sub = DeviceEventEmitter.addListener("booking_updated", fetchTickets);
    return () => sub.remove();
  }, [fetchTickets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  const groupedTickets = useMemo(() => {
    const groups: Record<string, GroupedTickets> = {};
    tickets.forEach((t) => {
      const key = t.booking_id ? `booking_${t.booking_id}` : `ticket_${t.ticket_id}`;
      if (!groups[key]) {
        groups[key] = {
          bookingId: t.booking_id || 0,
          locationName: t.location_name || "Vé tham quan",
          useDate: t.use_date,
          tickets: [],
        };
      }
      groups[key].tickets.push(t);
    });

    const allGroups = Object.values(groups);
    
    // Sort all groups: unused/ready tickets go first, then used/expired/void
    allGroups.sort((a, b) => {
      const aHasUnused = a.tickets.some(t => t.status === "unused");
      const bHasUnused = b.tickets.some(t => t.status === "unused");
      if (aHasUnused && !bHasUnused) return -1;
      if (!aHasUnused && bHasUnused) return 1;
      // Secondary sort by date (newest first)
      const dateA = a.useDate ? new Date(a.useDate).getTime() : 0;
      const dateB = b.useDate ? new Date(b.useDate).getTime() : 0;
      return dateB - dateA;
    });

    // Filter by tab
    if (activeTab === 'single') {
      // Show groups that have exactly ONE ticket
      return allGroups.filter(g => g.tickets.length === 1);
    } else {
      // Show groups that have MORE THAN ONE ticket
      return allGroups.filter(g => g.tickets.length > 1);
    }
  }, [tickets, activeTab]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkDateValid = (useDateStr: string | null) => {
    if (!useDateStr) return true;
    const useD = new Date(useDateStr);
    const today = new Date();
    const uStr = `${useD.getFullYear()}-${String(useD.getMonth() + 1).padStart(2, "0")}-${String(useD.getDate()).padStart(2, "0")}`;
    const tStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return uStr <= tStr; // If it's today or in the past, it's valid to show bright.
  };

  const getStatusText = (status: string) => {
    if (status === "unused") return "Sẵn sàng";
    if (status === "used") return "Đã dùng";
    if (status === "void" || status === "cancelled") return "Đã hủy";
    if (status === "expired") return "Hết hạn";
    return status;
  };

  const getStatusColor = (status: string) => {
    if (status === "unused") return "text-brand-600";
    if (status === "used") return "text-slate-400";
    if (status === "void" || status === "cancelled" || status === "expired") return "text-red-500";
    return "text-slate-500";
  };

  const renderGroupItem = ({ item: group }: { item: GroupedTickets }) => {
    const groupKey = group.bookingId > 0 ? `booking_${group.bookingId}` : `ticket_${group.tickets[0].ticket_id}`;
    const isExpanded = !!expandedGroups[groupKey];
    
    // Check if group is completely used/void/expired
    const allUsed = group.tickets.every((t) => t.status !== "unused");
    const isDateValid = checkDateValid(group.useDate);
    
    if (group.tickets.length === 1) {
      const ticket = group.tickets[0];
      const isUsed = ticket.status !== "unused";
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket.ticket_code)}`;
      const imageUrl = getFirstImage(ticket.service_images);

      return (
        <View className="mb-6 flex-row rounded-2xl bg-white overflow-hidden shadow-sm shadow-slate-200 border border-slate-100">
          {/* Left: Info */}
          <View className="flex-1 p-4 justify-between">
            <View className="flex-row items-center mb-4">
               {/* Image */}
               <View className="w-12 h-12 rounded-xl bg-slate-50 items-center justify-center mr-3 overflow-hidden border border-slate-100 shadow-sm">
                 {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name="ticket" size={24} color="#94a3b8" />
                  )}
               </View>
               <View className="flex-1">
                 <Text className="text-[15px] font-extrabold text-slate-800 tracking-tight" numberOfLines={2}>{ticket.service_name || "Vé Du Lịch"}</Text>
                 <Text className="text-[12px] text-emerald-700 font-bold mt-0.5" numberOfLines={1}>{group.locationName}</Text>
                 {ticket.invoice_code && (
                   <Text className="text-[10px] font-bold text-slate-400 mt-1">HĐ: {ticket.invoice_code}</Text>
                 )}
               </View>
            </View>

            {/* Date & Price */}
            <View className="flex-row items-end justify-between mt-auto">
              <View>
                <Text className="text-[10px] font-medium text-slate-400">Ngày dùng</Text>
                <Text className="text-[12px] font-bold text-slate-700 mt-0.5">{formatDate(ticket.use_date)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[12px] font-bold text-slate-700">
                  {Number.isFinite(Number(ticket.service_price)) ? new Intl.NumberFormat('vi-VN').format(Number(ticket.service_price)) + ' ₫' : "-"}
                </Text>
                <View className={`mt-1.5 px-2 py-0.5 rounded-full ${isUsed ? 'bg-slate-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                  <Text className={`text-[9px] font-black uppercase ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right: QR Code (Tear-off) */}
          <View className="w-[110px] bg-slate-50 border-l border-slate-200 border-dashed items-center justify-center p-3 relative">
            {/* Cutouts */}
            <View className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-surface border border-slate-200" />
            <View className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-surface border border-slate-200" />
            
            <Pressable
              className={`bg-white p-2 rounded-xl shadow-sm border border-slate-100 ${isUsed || !isDateValid ? "opacity-40" : ""}`}
              onPress={() => setSelectedQr(qrUrl)}
            >
              <Image source={{ uri: qrUrl }} style={{ width: 70, height: 70 }} resizeMode="contain" />
            </Pressable>
            <Text className="mt-3 text-[10px] font-mono font-bold text-slate-500 text-center">
              {ticket.ticket_code}
            </Text>
          </View>
        </View>
      );
    }
    
    // Master QR for grouped tickets
    const masterQrCode = `SB-${group.bookingId}-GROUP`;
    const masterQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(masterQrCode)}`;

    return (
      <View className="mb-6">
        <View className="flex-row rounded-2xl bg-white overflow-hidden shadow-sm shadow-slate-200 border border-slate-100">
          {/* Left: Group Info */}
          <View className="flex-1 p-4 justify-between">
            <View>
              <Text className="text-[16px] font-extrabold text-slate-800" numberOfLines={2}>{group.locationName}</Text>
              {group.bookingId > 0 && (
                <Text className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Hóa đơn: DL-{group.bookingId}</Text>
              )}
            </View>
            
            <View className="flex-row items-center justify-between mt-4">
              <View>
                <Text className="text-[11px] font-medium text-slate-400">Ngày dùng</Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="calendar" size={12} color="#0f766e" />
                  <Text className="text-[12px] font-bold text-slate-700 ml-1">{formatDate(group.useDate)}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[11px] font-medium text-slate-400">Tổng số</Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="ticket" size={12} color="#0f766e" />
                  <Text className="text-[12px] font-bold text-brand-600 ml-1">{group.tickets.length} vé</Text>
                </View>
              </View>
            </View>

            {/* Toggle */}
            <Pressable 
              className="mt-4 flex-row items-center justify-center py-2 px-3 rounded-xl bg-slate-50 border border-slate-100"
              onPress={() => toggleGroup(groupKey)}
            >
              <Text className="text-slate-600 font-bold mr-1 text-[11px]">
                {isExpanded ? "Ẩn danh sách vé con" : "Xem danh sách vé con"}
              </Text>
              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="#475569" />
            </Pressable>
          </View>

          {/* Right: Master QR (Tear-off) */}
          <View className="w-[110px] bg-slate-50 border-l border-slate-200 border-dashed items-center justify-center p-3 relative">
            {/* Cutouts */}
            <View className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-surface border border-slate-200" />
            <View className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-surface border border-slate-200" />
            
            <Pressable
              className={`bg-white p-2 rounded-xl shadow-sm border border-slate-100 ${allUsed || !isDateValid ? "opacity-40" : ""}`}
              onPress={() => setSelectedQr(masterQrUrl)}
            >
              <Image source={{ uri: masterQrUrl }} style={{ width: 70, height: 70 }} resizeMode="contain" />
            </Pressable>
            <Text className="mt-3 text-[10px] font-mono font-extrabold text-slate-500 text-center">
              {masterQrCode}
            </Text>

            {allUsed && (
              <View className="absolute inset-0 bg-slate-50/80 items-center justify-center rounded-r-2xl">
                <View className="bg-red-500 px-2 py-1 rounded-md rotate-[-15deg]">
                  <Text className="text-white font-black text-[9px] uppercase tracking-wider">Đã dùng hết</Text>
                </View>
              </View>
            )}
            {!isDateValid && !allUsed && (
              <View className="absolute inset-0 bg-slate-50/80 items-center justify-center rounded-r-2xl">
                <View className="bg-amber-500 px-2 py-1 rounded-md rotate-[-15deg]">
                  <Text className="text-white font-black text-[9px] uppercase tracking-wider">Chưa đến ngày</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Child Tickets */}
        {isExpanded && (
          <View className="mt-3 gap-2 px-1">
            {group.tickets.map((t) => {
              const isUsed = t.status !== "unused";
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(t.ticket_code)}`;
              const imageUrl = getFirstImage(t.service_images);
              
              return (
                <View key={t.ticket_id} className="flex-row rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <View className="flex-1 p-3 flex-row items-center">
                    <View className="w-10 h-10 rounded-lg bg-slate-50 items-center justify-center mr-3 overflow-hidden border border-slate-100">
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="ticket" size={20} color="#94a3b8" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] font-bold text-slate-800" numberOfLines={1}>{t.service_name}</Text>
                      
                      <View className="flex-row items-center mt-1 space-x-2">
                        <Text className="text-[10px] font-medium text-slate-500">{formatDate(t.use_date)}</Text>
                      </View>
                      {(t.invoice_code || group.bookingId > 0) && (
                        <Text className="text-[9px] font-bold text-slate-400 mt-0.5">
                          Hóa đơn: {t.invoice_code || `DL-${group.bookingId}`}
                        </Text>
                      )}

                      <View className="flex-row items-center justify-between mt-1">
                        <Text className="text-[11px] font-bold text-emerald-700">
                          {Number.isFinite(Number(t.service_price)) ? new Intl.NumberFormat('vi-VN').format(Number(t.service_price)) + ' ₫' : "-"}
                        </Text>
                        <View className={`px-1.5 py-0.5 rounded-full ${isUsed ? 'bg-slate-100' : 'bg-emerald-50'}`}>
                          <Text className={`text-[8px] font-black uppercase ${getStatusColor(t.status)}`}>{getStatusText(t.status)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="w-[85px] bg-slate-50 border-l border-slate-200 border-dashed items-center justify-center p-2 relative">
                    <View className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-surface border border-slate-200" />
                    <View className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-surface border border-slate-200" />
                    
                    <Pressable
                      className={`bg-white p-1 rounded-lg border border-slate-100 ${isUsed || !isDateValid ? "opacity-40" : ""}`}
                      onPress={() => setSelectedQr(qrUrl)}
                    >
                      <Image source={{ uri: qrUrl }} style={{ width: 45, height: 45 }} resizeMode="contain" />
                    </Pressable>
                    <Text className="mt-1.5 text-[8px] font-mono font-bold text-slate-500 truncate w-full text-center">
                      {t.ticket_code}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface">

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-line">
        <Pressable 
          className={`flex-1 py-3 items-center justify-center border-b-2 ${activeTab === 'single' ? 'border-brand-600' : 'border-transparent'}`}
          onPress={() => setActiveTab('single')}
        >
          <Text className={`text-[15px] font-bold ${activeTab === 'single' ? 'text-brand-600' : 'text-slate-500'}`}>Vé lẻ</Text>
        </Pressable>
        <Pressable 
          className={`flex-1 py-3 items-center justify-center border-b-2 ${activeTab === 'group' ? 'border-brand-600' : 'border-transparent'}`}
          onPress={() => setActiveTab('group')}
        >
          <Text className={`text-[15px] font-bold ${activeTab === 'group' ? 'text-brand-600' : 'text-slate-500'}`}>Vé nhóm</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={groupedTickets}
          keyExtractor={(item) => String(item.bookingId || Math.random())}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          renderItem={renderGroupItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <Ionicons name="ticket-outline" size={64} color="#cbd5e1" />
              <Text className="mt-4 text-center text-[16px] text-slate-500">
                Không có vé du lịch nào.
              </Text>
            </View>
          }
        />
      )}
      <QRCodeModal visible={!!selectedQr} qrUrl={selectedQr} onClose={() => setSelectedQr(null)} />
    </View>
  );
}
