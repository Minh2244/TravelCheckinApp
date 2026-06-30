import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { io } from "socket.io-client";
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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../lib/error";
import { resolveBackendUrl } from "../../lib/url";
import { isLocationOpen } from "../../lib/time";
import { addDays, formatCurrency, parseInputDate, toInputDateTime, toLocalISOString } from "../../lib/booking-utils";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import type { LocationItem, LocationServiceItem } from "../../types/location";
import type { CreateBookingBatchPayload } from "../../types/booking";

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
  const [checkInDate, setCheckInDate] = useState(() => toInputDateTime(new Date()));
  const [checkOutDate, setCheckOutDate] = useState(() => toInputDateTime(addDays(new Date(), 1)));
  const [stayPreset, setStayPreset] = useState<"day" | "week" | "month" | "custom">("day");
  const [customDays, setCustomDays] = useState<string>("1");

  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [prepayChoice, setPrepayChoice] = useState<PrepayChoice>("none");

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
    ])
      .then(([locationResponse, servicesResponse]) => {
        if (!active) return;
        setLocation(locationResponse.data);
        const roomServices = (servicesResponse.data || []).filter(
          (item) => String(item.service_type || "").toLowerCase() === "room"
        );
        setRooms(roomServices);
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

  // Real-time (Socket.IO) for room state changes
  useEffect(() => {
    if (!Number.isFinite(locationId)) return;
    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socket = io(backendUrl, { transports: ["websocket"] });

    socket.on("connect", () => {
      socket.emit("join_location_public", { locationId });
    });

    socket.on("public_status_changed", (data: any) => {
      console.log("[HotelBookingScreen] received public_status_changed:", data);
      if (data?.type === "hotel_updated") {
        // Basic conflict approach for rooms: reload services if needed.
        locationApi.getServices(locationId).then((res) => {
          const roomServices = (res.data || []).filter(
            (item) => String(item.service_type || "").toLowerCase() === "room"
          );
          setRooms(roomServices);
          
          // Remove any selected rooms that are no longer available
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
    });

    return () => {
      socket.disconnect();
    };
  }, [locationId]);

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
    } catch (e) {}
  }, [checkInDate, stayDays]);

  const totalPrice = useMemo(() => {
    let total = 0;
    selectedRoomIds.forEach((id) => {
      const room = rooms.find((r) => r.service_id === id);
      if (room && Number.isFinite(Number(room.price))) {
        const basePrice = Number(room.price);
        const u = String(room.unit || "").toLowerCase().trim();
        let multiplier = stayDays; // default to days
        
        const isHourly = u === "h" || u.includes("hour") || u.includes("giờ") || u.includes("gio") || u.includes("tiếng") || u.includes("tieng");
        const isWeekly = u.includes("tuần") || u.includes("tuan") || u.includes("week");
        const isMonthly = u.includes("tháng") || u.includes("thang") || u.includes("month");

        if (isHourly) {
          multiplier = stayDays * 24;
        } else if (isMonthly) {
          multiplier = stayDays / 30;
        } else if (isWeekly) {
          multiplier = stayDays / 7;
        }
        total += basePrice * multiplier;
      }
    });
    return total;
  }, [selectedRoomIds, rooms, stayDays]);

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
      };

      const response = await bookingApi.createBookingBatch(payload);
      await bookingApi.updateRoomBookingBatchContact(response.data.bookingIds, contactName.trim(), contactPhone.trim());

      if (prepayChoice === "transfer") {
        setPaymentLoading(true);
        try {
          const pRes = await bookingApi.createOrGetPaymentForBookingBatch(response.data.bookingIds);
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
              // Reset the form
              setSelectedRoomIds([]);
              setStayPreset("day");
              setCustomDays("1");
              setNotes("");
              setPrepayChoice("none");
              // CheckIn/CheckOut are automatically updated or can be reset to current time
              setCheckInDate(toInputDateTime(new Date()));
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
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Xác nhận thông tin booking</Text>
        <Pressable
          style={styles.cartButton}
          onPress={() => router.push("/wallet/room-pass" as any)}
        >
          <Ionicons name="cart-outline" size={24} color="#0f172a" />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 116 },
        ]}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.locationName}>{location?.location_name || "Địa điểm"}</Text>
          <Text style={styles.locationAddress} numberOfLines={2}>
            {location?.address}
          </Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Thời gian đến</Text>
              <TextInput
                value={checkInDate}
                onChangeText={setCheckInDate}
                placeholder="YYYY-MM-DD HH:mm"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Hạn sử dụng</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>Trễ hơn 1 tiếng tự hủy</Text>
              </View>
            </View>
          </View>

          <View style={[styles.field, { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginTop: 8 }]}>
            <Text style={styles.label}>Thời gian lưu trú</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {[
                { id: "day", label: "1 ngày" },
                { id: "week", label: "1 tuần" },
                { id: "month", label: "1 tháng" },
                { id: "custom", label: "Tùy chọn" },
              ].map(opt => (
                <Pressable 
                  key={opt.id} 
                  onPress={() => setStayPreset(opt.id as any)}
                  style={{ 
                    paddingHorizontal: 16, 
                    paddingVertical: 8, 
                    borderRadius: 20, 
                    borderWidth: 1, 
                    borderColor: stayPreset === opt.id ? "#0f172a" : "#e2e8f0", 
                    backgroundColor: stayPreset === opt.id ? "#0f172a" : "#fff" 
                  }}
                >
                  <Text style={{ 
                    fontSize: 13, 
                    color: stayPreset === opt.id ? "#fff" : "#64748b",
                    fontWeight: "600"
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {stayPreset === "custom" && (
              <View style={{ marginTop: 12 }}>
                <TextInput 
                  value={customDays}
                  onChangeText={setCustomDays}
                  keyboardType="numeric"
                  placeholder="Nhập số ngày lưu trú"
                  style={styles.input}
                />
              </View>
            )}
            {checkOutDate ? (
              <Text style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
                Thời gian dự kiến: <Text style={{ fontWeight: "700", color: "#0f172a" }}>{checkOutDate}</Text>
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Họ tên người đặt</Text>
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder="Nhập tên người đặt"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Nhập số điện thoại"
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ghi chú (Không bắt buộc)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Yêu cầu đặc biệt..."
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
            />
          </View>
        </View>

        <View style={styles.roomsSection}>
          <Text style={styles.sectionTitle}>Chọn phòng</Text>
          <Text style={styles.sectionSubtitle}>
            Chọn nhiều phòng, nhiều danh mục rồi bấm "Đặt phòng".
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
            {categories.map((c) => (
              <Pressable
                key={c.name}
                style={[styles.categoryPill, selectedCategory === c.name && styles.categoryPillSelected]}
                onPress={() => setSelectedCategory(c.name)}
              >
                <Text style={[styles.categoryPillText, selectedCategory === c.name && styles.categoryPillTextSelected]}>
                  {c.name} ({c.count})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHeaderText}>{selectedCategory}</Text>
            <Text style={styles.categoryHeaderCount}>Đã chọn: {selectedRoomIds.length} phòng</Text>
          </View>

          <View style={styles.roomListContainer}>
            <ScrollView nestedScrollEnabled contentContainerStyle={styles.roomGrid}>
              {displayedRooms.length === 0 ? (
                <Text style={styles.noDataText}>Không có phòng nào.</Text>
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
                        isSelected && styles.roomCardSelected,
                        isUnavailable && styles.roomCardDisabled,
                      ]}
                      onPress={() => !isUnavailable && toggleRoom(room.service_id)}
                      disabled={isUnavailable}
                    >
                      <View style={styles.roomImageContainer}>
                        {roomImageUrl ? (
                          <Image source={{ uri: roomImageUrl }} style={styles.roomImage} />
                        ) : (
                          <Ionicons name="bed-outline" size={20} color="#94a3b8" />
                        )}
                        <View style={styles.checkboxContainer}>
                          <Ionicons 
                            name={isSelected ? "checkbox" : "square-outline"} 
                            size={22} 
                            color={isSelected ? "#0f766e" : "#94a3b8"} 
                          />
                        </View>
                      </View>
                      <View style={styles.roomContent}>
                        <Text style={styles.roomName}>{room.service_name}</Text>
                        <Text style={styles.roomPrice}>{formatCurrency(room.price)}/{room.unit || 'giờ'}</Text>
                        {isUnavailable && (
                          <Text style={styles.roomUnavailableText}>
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
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Thanh toán trước</Text>
          <View style={styles.radioGroup}>
            <Pressable style={styles.radioRow} onPress={() => setPrepayChoice("none")}>
              <View style={[styles.radio, prepayChoice === "none" && styles.radioActive]}>
                {prepayChoice === "none" && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Không thanh toán trước</Text>
            </Pressable>
            <Pressable style={styles.radioRow} onPress={() => setPrepayChoice("transfer")}>
              <View style={[styles.radio, prepayChoice === "transfer" && styles.radioActive]}>
                {prepayChoice === "transfer" && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Chuyển khoản (VietQR)</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Lưu ý đặt phòng</Text>
            <Text style={styles.notesText}>• 1/ Khi đặt phòng nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.</Text>
            <Text style={styles.notesText}>• 2/ Khách có thể tới nhận phòng trong khoảng ± 1 giờ so với giờ đã đặt.</Text>
            <Text style={styles.notesText}>• 3/ Quý khách có thể đặt phòng trước nhưng phải thanh toán trước qua hình thức chuyển khoản.</Text>
            <Text style={styles.notesText}>• 4/ Quý khách có thể đặt trước tối đa 3 ngày.</Text>
            <Text style={styles.notesText}>• 5/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.</Text>
            <Text style={styles.notesText}>• 6/ Quý khách có thể đặt phòng để ở tối đa 3 tháng (90 ngày).</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {prepayChoice !== "none" && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalPrice)}</Text>
          </View>
        )}
        <Pressable
          style={[styles.submitButton, (submitting || paymentLoading) && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting || paymentLoading}
        >
          {submitting || paymentLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Đặt phòng</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  locationName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  locationAddress: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 18,
  },
  formSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 16,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  readonlyInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
  },
  readonlyText: {
    fontSize: 14,
    color: "#64748b",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  roomsSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 12,
  },
  categoryScroll: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryPillSelected: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  categoryPillTextSelected: {
    color: "#ffffff",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  categoryHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  categoryHeaderCount: {
    fontSize: 13,
    color: "#64748b",
  },
  roomListContainer: {
    height: 380,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  roomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 10,
    gap: 10,
  },
  roomCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  roomCardSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ccfbf1",
  },
  roomCardDisabled: {
    opacity: 0.6,
  },
  roomImageContainer: {
    width: "100%",
    height: 110,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  roomImage: {
    width: "100%",
    height: "100%",
  },
  roomContent: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 80,
    justifyContent: "center",
  },
  roomName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  roomPrice: {
    fontSize: 14,
    color: "#0f766e",
    fontWeight: "700",
    marginTop: 6,
  },
  roomUnavailableText: {
    fontSize: 11,
    color: "#e11d48",
    fontWeight: "600",
    marginTop: 6,
  },
  checkboxContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4,
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noDataText: {
    padding: 16,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
  paymentSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  radioGroup: {
    marginTop: 12,
    gap: 12,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#0f766e",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0f766e",
  },
  radioLabel: {
    fontSize: 14,
    color: "#334155",
  },
  notesContainer: {
    backgroundColor: "#fef3c7",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#b45309",
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 20,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
    paddingHorizontal: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f766e",
  },
  submitButton: {
    height: 48,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
