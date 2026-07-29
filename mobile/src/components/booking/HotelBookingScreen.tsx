import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../lib/error";
import { resolveBackendUrl } from "../../lib/url";
import { useBookingRealtime } from "../../hooks/useBookingRealtime";
import { isLocationOpen } from "../../lib/time";
import { addDays, formatCurrency, parseInputDate, toInputDateTime, toLocalISOString } from "../../lib/booking-utils";
import { useAuthStore } from "../../modules/auth/store";
import { AppAlert as Alert } from "../../modules/ui/app-alert";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import { userApi, type LocationVoucher } from "../../services/user.api";
import type { LocationItem, LocationServiceItem } from "../../types/location";
import type { CreateBookingBatchPayload } from "../../types/booking";
import { VoucherStubCard } from "./VoucherStubCard";
import {
  asNumber,
  calculateVoucherDiscount,
  getVoucherId,
  voucherStillUsable,
} from "../../lib/voucher-utils";

type SearchParams = {
  locationId?: string;
};

type PrepayChoice = "none" | "transfer";

export function HotelBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SearchParams>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const locationId = Number(params.locationId);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [rooms, setRooms] = useState<LocationServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Form State
  const [checkInDate, setCheckInDate] = useState(() => toInputDateTime(new Date(Date.now() + 3600000)));
  const [checkOutDate, setCheckOutDate] = useState(() => toInputDateTime(addDays(new Date(Date.now() + 3600000), 1)));
  const [stayPreset, setStayPreset] = useState<"day" | "week" | "month" | "custom">("day");
  const [customDays, setCustomDays] = useState<string>("1");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [prepayChoice, setPrepayChoice] = useState<PrepayChoice>("none");
  const [savedVouchers, setSavedVouchers] = useState<LocationVoucher[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);

  const refreshVouchers = useCallback(async () => {
    if (!Number.isFinite(locationId)) {
      setSavedVouchers([]);
      return;
    }
    try {
      const response = await userApi.getUsableVouchersByLocation(locationId);
      setSavedVouchers(response.data || []);
    } catch {
      // Keep current vouchers if the refresh fails; booking success should remain visible.
    }
  }, [locationId]);

  const refreshVoucherHoldState = useCallback(async () => {
    setSelectedVoucherId(null);
    await refreshVouchers();
  }, [refreshVouchers]);

  const [showNoticeAccordion, setShowNoticeAccordion] = useState(true);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStayDropdown, setShowStayDropdown] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(locationId)) {
      setLoading(false);
      showToast("Thiếu dữ liệu địa điểm.");
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      locationApi.getLocationById(locationId),
      locationApi.getServices(locationId),
      userApi.getUsableVouchersByLocation(locationId),
    ])
      .then(([locationResponse, servicesResponse, vouchersResponse]) => {
        if (!active) return;
        setLocation(locationResponse.data);
        const roomServices = (servicesResponse.data || []).filter(
          (item) => String(item.service_type || "").toLowerCase() === "room"
        );
        setRooms(roomServices);
        setSavedVouchers(vouchersResponse.data || []);
      })
      .catch((error) => {
        if (active) showToast(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locationId]);

  useEffect(() => {
    if (!location) return;

    const checkOpen = () => {
      if (location.temp_close_type) {
        showToast("Địa điểm đang tạm thời đóng cửa!");
        router.replace("/(app)/(tabs)/home");
        return false;
      }
      if (!isLocationOpen(location.opening_hours)) {
        showToast("Địa điểm đã đóng cửa, không thể đặt dịch vụ lúc này.");
        router.replace("/(app)/(tabs)/home");
        return false;
      }
      return true;
    };

    if (!checkOpen()) return;

    const interval = setInterval(checkOpen, 60000);
    return () => clearInterval(interval);
  }, [location, router]);

  // Real-time for room state changes
  useBookingRealtime(locationId, {
    onStatusChanged: (data: any) => {
      if (data?.type === "hotel_updated") {
        locationApi.getServices(locationId).then((res) => {
          const roomServices = (res.data || []).filter(
            (item) => String(item.service_type || "").toLowerCase() === "room"
          );
          setRooms(roomServices);

          const availableRoomIds = new Set(
            roomServices
              .filter(
                (r) =>
                  r.room_status !== "occupied" &&
                  r.room_status !== "reserved" &&
                  r.room_status !== "maintenance" &&
                  r.room_status !== "cleaning"
              )
              .map((r) => r.service_id)
          );
          setSelectedRoomIds((prev) => prev.filter((id) => availableRoomIds.has(id)));
        });
      }
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả phòng");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    map.set("Tất cả phòng", rooms.length);
    rooms.forEach((room) => {
      const cat = String(room.category_name || "Khác").trim() || "Khác";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [rooms]);

  const displayedRooms = useMemo(() => {
    let filtered = rooms;
    if (selectedCategory !== "Tất cả phòng") {
      filtered = rooms.filter((r) => {
        const cat = String(r.category_name || "Khác").trim() || "Khác";
        return cat === selectedCategory;
      });
    }
    return [...filtered].sort((a, b) => a.service_name.localeCompare(b.service_name, 'vi', { numeric: true }));
  }, [rooms, selectedCategory]);

  const stayDays = useMemo(() => {
    if (stayPreset === "week") return 7;
    if (stayPreset === "month") return 30;
    if (stayPreset === "custom") {
      const d = Math.floor(Number(customDays));
      return Number.isFinite(d) && d > 0 ? d : 1;
    }
    return 1;
  }, [customDays, stayPreset]);

  useEffect(() => {
    if (!checkInDate) return;
    try {
      const startDate = parseInputDate(checkInDate);
      if (startDate) {
        const endDate = addDays(startDate, stayDays);
        setCheckOutDate(toInputDateTime(endDate));
      }
    } catch (e) { }
  }, [checkInDate, stayDays]);

  const totalPrice = useMemo(() => {
    let total = 0;
    selectedRoomIds.forEach((id) => {
      const room = rooms.find((r) => r.service_id === id);
      if (room && Number.isFinite(Number(room.price))) {
        const basePrice = Number(room.price);
        const u = String(room.unit || "").toLowerCase().trim();
        let multiplier = stayDays;
        const isHourly = u === "h" || u.includes("hour") || u.includes("giờ") || u.includes("gio") || u.includes("tiếng") || u.includes("tieng");
        const isWeekly = u.includes("tuần") || u.includes("tuan") || u.includes("week");
        const isMonthly = u.includes("tháng") || u.includes("thang") || u.includes("month");
        if (isHourly) { multiplier = stayDays * 24; }
        else if (isMonthly) { multiplier = stayDays / 30; }
        else if (isWeekly) { multiplier = stayDays / 7; }
        total += basePrice * multiplier;
      }
    });
    return total;
  }, [selectedRoomIds, rooms, stayDays]);

  const roomVouchers = useMemo(
    () =>
      savedVouchers.filter((voucher) => {
        if (!voucherStillUsable(voucher)) return false;
        const serviceScope = String(voucher.apply_to_service_type || "all").toLowerCase();
        return serviceScope === "all" || serviceScope === "room";
      }),
    [savedVouchers],
  );

  const discountAmount = useMemo(() => {
    if (!selectedVoucherId || totalPrice <= 0) return 0;
    const v = roomVouchers.find((vx) => getVoucherId(vx) === selectedVoucherId);
    return calculateVoucherDiscount(v || null, totalPrice);
  }, [selectedVoucherId, totalPrice, roomVouchers]);

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const handleSubmit = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      showToast("Vui lòng điền đủ họ tên và số điện thoại.");
      return;
    }
    if (selectedRoomIds.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 phòng.");
      return;
    }
    const checkIn = parseInputDate(checkInDate);
    const checkOut = parseInputDate(checkOutDate);
    if (!checkIn || !checkOut) {
      showToast("Ngày giờ chưa đúng định dạng.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateBookingBatchPayload = {
        location_id: locationId,
        check_in_date: toLocalISOString(checkIn),
        check_out_date: toLocalISOString(checkOut),
        notes: notes.trim() || null,
        service_ids: selectedRoomIds,
        reserve_on_confirm: prepayChoice === "transfer" ? true : undefined,
        voucher_code: selectedVoucherId
          ? roomVouchers.find((v) => getVoucherId(v) === selectedVoucherId)?.code || null
          : null,
      };
      const response = await bookingApi.createBookingBatch(payload);
      if (selectedVoucherId != null) {
        await refreshVoucherHoldState();
      }
      await bookingApi.updateRoomBookingBatchContact(response.data.bookingIds, contactName.trim(), contactPhone.trim());
      if (prepayChoice === "transfer") {
        if (finalPrice <= 0) {
          Alert.alert("Thành công", "Đặt phòng thành công! Voucher đã giữ lượt, chờ chủ phòng xác nhận nhé.", [
            {
              text: "OK",
              onPress: () => {
                setSelectedRoomIds([]);
                setStayPreset("day");
                setCustomDays("1");
                setNotes("");
                setPrepayChoice("none");
                setCheckInDate(toInputDateTime(new Date(Date.now() + 3600000)));
              },
            },
          ]);
          return;
        }
        setPaymentLoading(true);
        try {
          await bookingApi.createOrGetPaymentForBookingBatch(response.data.bookingIds);
          const ids = response.data.bookingIds.join(",");
          router.replace(`/booking/payment/batch?mode=room-batch&bookingIds=${ids}&returnTo=${encodeURIComponent(`/booking/hotel/${locationId}`)}`);
        } catch (error) {
          showToast(getErrorMessage(error));
        } finally {
          setPaymentLoading(false);
        }
      } else {
        Alert.alert("Thành công", "Đặt phòng thành công! Chờ chủ phòng xác nhận nhé.", [
          {
            text: "OK",
            onPress: () => {
              setSelectedRoomIds([]);
              setStayPreset("day");
              setCustomDays("1");
              setNotes("");
              setPrepayChoice("none");
              setCheckInDate(toInputDateTime(new Date(Date.now() + 3600000)));
            },
          },
        ]);
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRoom = (roomId: number) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1b4332" />
        <Text style={styles.loadingText}>Đang tải sơ đồ phòng...</Text>
      </View>
    );
  }

  const coverUrl = resolveBackendUrl((location as any)?.first_image || (location as any)?.images?.[0] || (location as any)?.avatar_url);

  return (
    <View style={styles.container}>
      {/* Top Header Navigation Bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: Math.max(insets.top, 12), paddingBottom: 12, backgroundColor: "#fbf6ee", borderBottomWidth: 1, borderBottomColor: "#f1e5d3" }}>
        <Pressable style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#f1e5d3" }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#382119" />
        </Pressable>
        <View style={{ alignItems: "center", flex: 1, marginHorizontal: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#382119" }} numberOfLines={1}>
            Xác nhận đặt phòng
          </Text>
        </View>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eed8b8" }}
          onPress={() => router.push(`/wallet/room-pass?locationId=${locationId}` as any)}
        >
          <Ionicons name="ticket-outline" size={22} color="#c07d33" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Location Banner Card with Right Cover Image (Matching dulich.png) */}
          <View style={{ flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", marginHorizontal: 16, marginTop: 12, marginBottom: 14, borderWidth: 1, borderColor: "#f1e5d3", minHeight: 110, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05 }}>
            <View style={{ flex: 1, padding: 14, justifyContent: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#e8f5ed", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="location" size={20} color="#1b4332" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#382119", marginBottom: 4 }} numberOfLines={1}>
                    {location?.location_name || "Nhà Trọ Phú Mỹ"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#8c6b53", lineHeight: 16 }} numberOfLines={3}>
                    {location?.address || "Trần Chiên, Phường Cái Răng, Thành phố Cần Thơ"}
                  </Text>
                </View>
              </View>
            </View>

            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={{ width: 140, height: "100%" }} resizeMode="cover" />
            ) : null}
          </View>


          {/* Section: Lưu ý đặt phòng (2 cột xếp mượt mà, không rớt chữ) */}
          <View style={styles.noticeCard}>
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: showNoticeAccordion ? 10 : 0 }}
              onPress={() => setShowNoticeAccordion(!showNoticeAccordion)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="notifications-outline" size={16} color="#c07d33" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#382119" }}>Lưu ý đặt phòng</Text>
              </View>
              <Ionicons name={showNoticeAccordion ? "chevron-up" : "chevron-down"} size={18} color="#8c6b53" />
            </Pressable>

            {showNoticeAccordion && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <View style={{ flex: 1, gap: 10 }}>
                  {[
                    { id: 1, text: "Đến trễ hơn 1 tiếng, hệ thống tự hủy." },
                    { id: 2, text: "Đến trong khoảng ± 1 giờ so với giờ đã đặt." },
                    { id: 3, text: "Đặt phòng trước phải thanh toán trước qua chuyển khoản." },
                  ].map((item) => (
                    <View key={item.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#c07d33" }}>{item.id}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: "#6b5344", flex: 1, lineHeight: 16 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flex: 1, gap: 10 }}>
                  {[
                    { id: 4, text: "Có thể đặt trước tối đa 3 ngày." },
                    { id: 5, text: "Tiền đã thanh toán sẽ không được hoàn lại." },
                    { id: 6, text: "Có thể đặt phòng để ở tối đa 3 tháng (90 ngày)." },
                  ].map((item) => (
                    <View key={item.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#c07d33" }}>{item.id}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: "#6b5344", flex: 1, lineHeight: 16 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Section 1: Thông tin đặt phòng */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="home-outline" size={16} color="#c07d33" />
              </View>
              <Text style={styles.sectionTitle}>Thông tin đặt phòng</Text>
            </View>

            <View style={{ gap: 12 }}>
              {/* Row 1: Name and Phone */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Họ tên người đặt</Text>
                  <View style={styles.inputFieldContainer}>
                    <Ionicons name="person-outline" size={18} color="#8c6b53" />
                    <TextInput
                      value={contactName}
                      onChangeText={setContactName}
                      placeholder="Nhựt Minh"
                      style={styles.inputFieldWithIcon}
                      placeholderTextColor="#a8907e"
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Số điện thoại</Text>
                  <View style={styles.inputFieldContainer}>
                    <Ionicons name="call-outline" size={18} color="#8c6b53" />
                    <TextInput
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="0869318421"
                      keyboardType="phone-pad"
                      style={styles.inputFieldWithIcon}
                      placeholderTextColor="#a8907e"
                    />
                  </View>
                </View>
              </View>

              {/* Row 2: Date and Time */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ngày đến</Text>
                  <Pressable onPress={() => setShowDatePicker(true)} style={styles.inputPicker}>
                    <Ionicons name="calendar-outline" size={18} color="#c07d33" />
                    <Text style={{ color: "#382119", fontWeight: "600", fontSize: 14, flex: 1 }} numberOfLines={1}>
                      {checkInDate ? checkInDate.split(' ')[0] : "Hôm nay"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8c6b53" />
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Giờ đến</Text>
                  <Pressable onPress={() => setShowTimePicker(true)} style={styles.inputPicker}>
                    <Ionicons name="time-outline" size={18} color="#c07d33" />
                    <Text style={{ color: "#382119", fontWeight: "600", fontSize: 14, flex: 1 }} numberOfLines={1}>
                      {checkInDate ? checkInDate.split(' ')[1] : "12:00"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8c6b53" />
                  </Pressable>
                </View>
              </View>

              {/* Row 3: Stay duration */}
              <View style={{ width: "100%", position: "relative", zIndex: 9 }}>
                <Text style={styles.inputLabel}>Thời gian lưu trú</Text>
                <Pressable
                  style={[styles.inputPicker, { marginTop: 4, justifyContent: "space-between" }]}
                  onPress={() => setShowStayDropdown(!showStayDropdown)}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#382119" }}>
                    {stayPreset === "day" ? "1 ngày" : stayPreset === "week" ? "1 tuần" : stayPreset === "month" ? "1 tháng" : "Tùy chọn"}
                  </Text>
                  <Ionicons name={showStayDropdown ? "chevron-up" : "chevron-down"} size={16} color="#8c6b53" />
                </Pressable>

                {showStayDropdown && (
                  <View
                    style={{
                      position: "absolute",
                      top: 76,
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      borderRadius: 12,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: "#f1e5d3",
                      elevation: 5,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      zIndex: 20,
                    }}
                  >
                    {[
                      { id: "day", label: "1 ngày" },
                      { id: "week", label: "1 tuần" },
                      { id: "month", label: "1 tháng" },
                      { id: "custom", label: "Tùy chọn" },
                    ].map((opt) => {
                      const active = stayPreset === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: active ? "#f4fbf7" : "transparent",
                          }}
                          onPress={() => {
                            setStayPreset(opt.id as any);
                            setShowStayDropdown(false);
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: active ? "700" : "500", color: active ? "#1b4332" : "#382119" }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {stayPreset === "custom" && (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      value={customDays}
                      onChangeText={setCustomDays}
                      keyboardType="numeric"
                      placeholder="Nhập số ngày lưu trú"
                      style={styles.inputField}
                    />
                  </View>
                )}

                {checkOutDate ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, backgroundColor: "#fbf6ee", borderRadius: 8, borderWidth: 1, borderColor: "#eed8b8" }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="bed-outline" size={16} color="#c07d33" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: "#8c6b53", marginBottom: 2 }}>Thời gian dự kiến trả phòng</Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1b4332" }}>{checkOutDate}</Text>
                    </View>
                  </View>
                ) : null}
              </View>



              {/* Row 4: Notes */}
              <View style={{ width: "100%" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.inputLabel}>Ghi chú (Không bắt buộc)</Text>
                  <Text style={{ fontSize: 11, color: "#8c6b53" }}>{notes.length}/200</Text>
                </View>
                <TextInput
                  value={notes}
                  onChangeText={(txt) => setNotes(txt.slice(0, 200))}
                  placeholder="Yêu cầu đặc biệt..."
                  placeholderTextColor="#a8907e"
                  multiline
                  style={styles.textArea}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Section 2: Chọn phòng */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="bed-outline" size={16} color="#c07d33" />
              </View>
              <Text style={styles.sectionTitle}>Chọn phòng</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#8c6b53", marginBottom: 12 }}>
              Chọn nhiều phòng, nhiều danh mục rồi bấm "Đặt phòng".
            </Text>

            {/* Category Dropdown & Selected Count */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, position: "relative", zIndex: 10 }}>
              <View style={{ position: "relative", zIndex: 10 }}>
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#f8ebd7",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#1b4332" }}>
                    Danh mục: {selectedCategory}
                  </Text>
                  <Ionicons name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={14} color="#1b4332" />
                </Pressable>

                {showCategoryDropdown && (
                  <View
                    style={{
                      position: "absolute",
                      top: 36,
                      left: 0,
                      backgroundColor: "#ffffff",
                      borderRadius: 12,
                      padding: 8,
                      width: 180,
                      borderWidth: 1,
                      borderColor: "#f1e5d3",
                      elevation: 5,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      zIndex: 20,
                    }}
                  >
                    {categories.map((c) => {
                      const active = selectedCategory === c.name;
                      return (
                        <Pressable
                          key={c.name}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: active ? "#f4fbf7" : "transparent",
                          }}
                          onPress={() => {
                            setSelectedCategory(c.name);
                            setShowCategoryDropdown(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: active ? "700" : "500", color: active ? "#1b4332" : "#382119" }}>
                            {c.name} ({c.count})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 12, color: "#1b4332", fontWeight: "600" }}>
                Đã chọn: {selectedRoomIds.length} phòng
              </Text>
            </View>

            {/* Contained Room Grid */}
            <ScrollView nestedScrollEnabled style={{ maxHeight: 320 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
              {displayedRooms.length === 0 ? (
                <Text style={{ fontSize: 13, color: "#8c6b53", padding: 16 }}>Không có phòng nào trong danh mục này.</Text>
              ) : (
                displayedRooms.map((room) => {
                  const isSelected = selectedRoomIds.includes(room.service_id);
                  const isUnavailable = room.room_status === "occupied" || room.room_status === "reserved" || room.room_status === "maintenance" || room.room_status === "cleaning";
                  const roomImage = room.images ? (Array.isArray(room.images) ? room.images[0] : (typeof room.images === "string" ? (() => { try { const parsed = JSON.parse(room.images); return Array.isArray(parsed) ? parsed[0] : null; } catch { return null; } })() : null)) : null;
                  const roomImageUrl = roomImage ? resolveBackendUrl(roomImage) : null;

                  return (
                    <Pressable
                      key={room.service_id}
                      style={[
                        styles.roomCard,
                        { width: "47%", padding: 10 },
                        isSelected && styles.roomCardSelected,
                        isUnavailable && styles.roomCardDisabled,
                      ]}
                      onPress={() => !isUnavailable && toggleRoom(room.service_id)}
                      disabled={isUnavailable}
                    >
                      <View style={{ position: "relative", width: "100%", height: 95, borderRadius: 8, overflow: "hidden", backgroundColor: "#f1f5f9", marginBottom: 8 }}>
                        {roomImageUrl ? (
                          <Image source={{ uri: roomImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        ) : (
                          <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="bed-outline" size={28} color="#8c6b53" />
                          </View>
                        )}
                        <View style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: isSelected ? "#1b4332" : "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: isSelected ? "#1b4332" : "#cbd5e1" }}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                      </View>
                      <View style={{ paddingHorizontal: 2, paddingBottom: 2 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#382119" }} numberOfLines={1}>{room.service_name}</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#1b4332", marginTop: 3 }}>
                          {formatCurrency(room.price)}/{room.unit || "Tiếng"}
                        </Text>
                        {isUnavailable && (
                          <Text style={{ fontSize: 11, color: "#ef4444", marginTop: 3, fontWeight: "600" }}>
                            {room.room_status === "occupied" ? "Đang có khách" : room.room_status === "reserved" ? "Đã đặt" : room.room_status === "cleaning" ? "Đang dọn" : "Đang bảo trì"}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>


          {/* Section 3: Thanh toán trước */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="card-outline" size={16} color="#c07d33" />
              </View>
              <Text style={styles.sectionTitle}>Thanh toán trước</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={[styles.radioCard, { flex: 1, paddingVertical: 10, paddingHorizontal: 8 }, prepayChoice === "none" && styles.radioCardActive]}
                onPress={() => setPrepayChoice("none")}
              >
                <Ionicons
                  name={prepayChoice === "none" ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={prepayChoice === "none" ? "#1b4332" : "#8c6b53"}
                />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#382119", marginLeft: 6, flex: 1 }}>
                  Không thanh toán
                </Text>
              </Pressable>

              <Pressable
                style={[styles.radioCard, { flex: 1, paddingVertical: 10, paddingHorizontal: 8 }, prepayChoice === "transfer" && styles.radioCardActive]}
                onPress={() => setPrepayChoice("transfer")}
              >
                <Ionicons
                  name={prepayChoice === "transfer" ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={prepayChoice === "transfer" ? "#1b4332" : "#8c6b53"}
                />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#382119", marginLeft: 6, flex: 1 }}>
                  Chuyển khoản (VietQR)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Vouchers Grouped List - Only show when transfer is selected */}
          {prepayChoice === "transfer" && roomVouchers.length > 0 && (
            <View style={[styles.sectionCard, { paddingVertical: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#382119", marginBottom: 8, paddingHorizontal: 12 }}>Ưu đãi & Voucher địa điểm</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 12, paddingBottom: 4 }}>
                {roomVouchers.map((voucher) => {
                  const vId = getVoucherId(voucher);
                  const isSelected = selectedVoucherId === vId;
                  const minOrder = asNumber(voucher.min_order_value, 0);
                  const maxDiscount = asNumber(voucher.max_discount_amount, 0);
                  const isEligible = totalPrice >= minOrder;

                  return (
                    <VoucherStubCard
                      key={vId}
                      voucher={voucher}
                      minOrder={minOrder}
                      maxDiscount={maxDiscount}
                      isSelected={isSelected}
                      isEligible={isEligible}
                      width={320}
                      onSelect={() => {
                        if (!isEligible) {
                          showToast(`Đơn tối thiểu để dùng voucher này là ${formatCurrency(minOrder)}`);
                          return;
                        }
                        setSelectedVoucherId(isSelected ? null : vId);
                      }}
                    />
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="business-outline" size={22} color="#c07d33" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#382119" }} numberOfLines={1}>
              {selectedRoomIds.length > 0
                ? `Đã chọn: ${rooms.filter(r => selectedRoomIds.includes(r.service_id)).map(r => r.service_name).join(", ")}`
                : "Chưa chọn phòng"}
            </Text>
            <Text style={{ fontSize: 12, color: "#8c6b53" }}>
              {stayDays} ngày {finalPrice > 0 ? `• ${formatCurrency(finalPrice)}` : ""}
            </Text>
            {discountAmount > 0 && (
              <Text style={{ fontSize: 12, color: "#ef4444", fontWeight: "600" }}>
                Giảm: -{formatCurrency(discountAmount)}
              </Text>
            )}
          </View>
        </View>

        <Pressable
          style={[
            styles.submitButton,
            (submitting || selectedRoomIds.length === 0) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || selectedRoomIds.length === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.submitButtonText}>Xác nhận đặt phòng</Text>
              <Ionicons name="chevron-forward" size={16} color="#ffffff" />
            </View>
          )}
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={parseInputDate(checkInDate) ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "spinner" : "calendar"}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (!selectedDate) return;
            const d = String(selectedDate.getDate()).padStart(2, "0");
            const mo = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const y = selectedDate.getFullYear();
            const timePart = checkInDate.split(" ")[1] ?? "00:00";
            setCheckInDate(`${d}/${mo}/${y} ${timePart}`);
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={parseInputDate(checkInDate) ?? new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "clock"}
          onChange={(_, selectedDate) => {
            setShowTimePicker(false);
            if (!selectedDate) return;
            const h = String(selectedDate.getHours()).padStart(2, "0");
            const m = String(selectedDate.getMinutes()).padStart(2, "0");
            const datePart = checkInDate.split(" ")[0] ?? toInputDateTime(new Date()).split(" ")[0];
            setCheckInDate(`${datePart} ${h}:${m}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fbf6ee" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fbf6ee" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#382119" },
  scrollContent: { paddingBottom: 120 },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1e5d3",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
  },
  noticeCard: {
    backgroundColor: "#fffdfa",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eed8b8",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#382119",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  formCol: {
    width: "47%",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#382119",
    marginBottom: 6,
  },
  inputPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputFieldWithIcon: {
    flex: 1,
    fontSize: 14,
    color: "#382119",
  },
  inputField: {
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: "#382119",
  },
  textArea: {
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    padding: 12,
    height: 80,
    fontSize: 14,
    color: "#382119",
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eed8b8",
    backgroundColor: "#ffffff",
  },
  presetChipActive: {
    backgroundColor: "#1b4332",
    borderColor: "#1b4332",
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8c6b53",
  },
  presetChipTextActive: {
    color: "#ffffff",
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f8ebd7",
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: "#1b4332",
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8c6b53",
  },
  categoryPillTextActive: {
    color: "#ffffff",
  },
  roomCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#f1e5d3",
  },
  roomCardSelected: {
    borderColor: "#1b4332",
    backgroundColor: "#f4fbf7",
    borderWidth: 2,
  },
  roomCardDisabled: {
    opacity: 0.5,
    backgroundColor: "#fbf6ee",
  },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1e5d3",
    backgroundColor: "#ffffff",
  },
  radioCardActive: {
    borderColor: "#1b4332",
    backgroundColor: "#f4fbf7",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1e5d3",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
  },
  submitButton: {
    backgroundColor: "#1b4332",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(27, 67, 50, 0.45)",
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});
