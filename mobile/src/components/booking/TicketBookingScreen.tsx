import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { normalizeImages, formatCurrency } from "../../lib/booking-utils";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import { userApi, type LocationVoucher } from "../../services/user.api";
import type { CreateBookingResult } from "../../types/booking";
import type { LocationItem, LocationServiceItem } from "../../types/location";
import { VoucherStubCard } from "./VoucherStubCard";
import {
  asNumber,
  calculateVoucherDiscount,
  getVoucherId,
  voucherStillUsable,
} from "../../lib/voucher-utils";

function parseDateOnlyInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function TicketBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationId?: string }>();
  const insets = useSafeAreaInsets();

  const locationId = Number(params.locationId);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [tickets, setTickets] = useState<LocationServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ bookingId: number; finalAmount: number } | null>(null);

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [useDate, setUseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
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
      // Keep current vouchers if refresh fails; booking success should not be hidden.
    }
  }, [locationId]);

  const refreshVoucherHoldState = useCallback(async () => {
    setSelectedVoucherId(null);
    await refreshVouchers();
  }, [refreshVouchers]);

  const [showNoticeAccordion, setShowNoticeAccordion] = useState(true);

  const minDate = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 3);

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
      locationApi.getServices(locationId, { type: "ticket" }),
      userApi.getUsableVouchersByLocation(locationId),
    ])
      .then(([locationResponse, servicesResponse, vouchersResponse]) => {
        if (!active) return;
        setLocation(locationResponse.data);
        setTickets(servicesResponse.data || []);
        setSavedVouchers(vouchersResponse.data || []);
      })
      .catch((error) => {
        if (active) {
          showToast(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locationId]);

  // Real-time for ticket quantity updates
  useBookingRealtime(locationId, {
    onStatusChanged: (data: any) => {
      if (data?.type === "tourist_updated") {
        locationApi.getServices(locationId, { type: "ticket" }).then((res) => {
          setTickets(res.data || []);
        }).catch(() => {});
      }
    }
  });

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

  const wentToPaymentRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (wentToPaymentRef.current) {
        setBookingResult(null);
        setQuantities({});
        setNotes("");
        wentToPaymentRef.current = false;
      }
    }, [])
  );

  const totalAmount = useMemo(() => {
    let sum = 0;
    for (const t of tickets) {
      const q = quantities[Number(t.service_id)] || 0;
      sum += Number(t.price || 0) * q;
    }
    return sum;
  }, [tickets, quantities]);

  const ticketVouchers = useMemo(
    () =>
      savedVouchers.filter((voucher) => {
        if (!voucherStillUsable(voucher)) return false;
        const serviceScope = String(voucher.apply_to_service_type || "all").toLowerCase();
        return serviceScope === "all" || serviceScope === "ticket";
      }),
    [savedVouchers],
  );

  const discountAmount = useMemo(() => {
    if (!selectedVoucherId || totalAmount <= 0) return 0;
    const v = ticketVouchers.find((vx) => getVoucherId(vx) === selectedVoucherId);
    return calculateVoucherDiscount(v || null, totalAmount);
  }, [selectedVoucherId, totalAmount, ticketVouchers]);

  const finalAmount = Math.max(0, totalAmount - discountAmount);

  const totalQuantity = useMemo(() => {
    return Object.values(quantities).reduce((acc, val) => acc + val, 0);
  }, [quantities]);

  const canSubmit = totalQuantity > 0;

  const hasInvalidQuantity = useMemo(() => {
    if (totalQuantity > 50) return true;
    for (const t of tickets) {
      const q = quantities[Number(t.service_id)] || 0;
      const available = Number(t.quantity);
      if (Number.isFinite(available) && q > available) {
        return true;
      }
    }
    return false;
  }, [tickets, quantities, totalQuantity]);

  const handleSubmit = async () => {
    if (!Number.isFinite(locationId) || totalQuantity <= 0) {
      showToast("Vui lòng chọn ít nhất 1 vé.");
      return;
    }

    if (totalQuantity > 50) {
      showToast("Chỉ được mua tối đa 50 vé mỗi lần.");
      return;
    }

    const items = Object.entries(quantities)
      .filter(([_, q]) => q > 0)
      .map(([serviceIdStr, quantity]) => ({
        service_id: Number(serviceIdStr),
        quantity,
      }));

    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        location_id: locationId,
        check_in_date: `${useDate} 08:00`,
        check_out_date: null,
        quantity: totalQuantity,
        source: "mobile" as const,
        notes: notes.trim() || null,
        ticket_items: items,
        voucher_code: selectedVoucherId
          ? ticketVouchers.find((v) => getVoucherId(v) === selectedVoucherId)?.code || null
          : null,
      };

      const response = await bookingApi.createBooking(payload);

      if (selectedVoucherId != null) {
        await refreshVoucherHoldState();
      }

      const createdFinalAmount = Math.max(0, Number(response.data.finalAmount ?? finalAmount));
      setBookingResult({
        bookingId: response.data.bookingId,
        finalAmount: createdFinalAmount,
      });

      if (createdFinalAmount <= 0) {
        setQuantities({});
        setNotes("");
        showToast("Đã mua vé thành công.");
        // Stay on page
      } else {
        wentToPaymentRef.current = true;
        router.push(
          `/booking/payment/${response.data.bookingId}?mode=ticket&returnTo=${encodeURIComponent(`/booking/ticket/all?locationId=${locationId}`)}` as never
        );
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!bookingResult) return;
    setPaymentLoading(true);
    try {
      wentToPaymentRef.current = true;
      router.push(
        `/booking/payment/${bookingResult.bookingId}?mode=ticket&returnTo=${encodeURIComponent(`/booking/ticket/all?locationId=${locationId}`)}` as never
      );
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1b4332" />
        <Text style={styles.loadingText}>Đang tải vé dịch vụ...</Text>
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
            Xác nhận thông tin booking
          </Text>
        </View>
        <Pressable 
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eed8b8" }} 
          onPress={() => router.push(`/wallet/tickets?locationId=${locationId}` as any)}
        >
          <Ionicons name="ticket-outline" size={22} color="#c07d33" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
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
                    {location?.location_name || "Bờ Kè Sông Hậu"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#8c6b53", lineHeight: 16 }} numberOfLines={3}>
                    {location?.address || "Bờ kè sông Hậu, Trần Văn Khéo, Phường Cái Khế, Thành phố Cần Thơ"}
                  </Text>
                </View>
              </View>
            </View>

            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={{ width: 140, height: "100%" }} resizeMode="cover" />
            ) : null}
          </View>

          {/* Date & Expiry Row Card (Matching dulich.png) */}
          <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 14, backgroundColor: "#ffffff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#f1e5d3" }}>
            <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => setShowDatePicker(true)}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="calendar-outline" size={18} color="#c07d33" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#8c6b53" }}>Ngày sử dụng</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#382119", marginTop: 2 }}>{useDate}</Text>
              </View>
            </Pressable>

            <View style={{ width: 1, backgroundColor: "#f1e5d3" }} />

            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="time-outline" size={18} color="#c07d33" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#8c6b53" }}>Hạn sử dụng</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#382119", marginTop: 2 }}>Trong ngày</Text>
              </View>
            </View>
          </View>

          {/* Section: Lưu ý Card (Moved Up below Date row matching dulich.png) */}
          <View style={styles.noticeCard}>
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: showNoticeAccordion ? 10 : 0 }}
              onPress={() => setShowNoticeAccordion(!showNoticeAccordion)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#c07d33", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="notifications" size={16} color="#ffffff" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#382119" }}>Lưu ý</Text>
              </View>
              <Ionicons name={showNoticeAccordion ? "chevron-up" : "chevron-down"} size={18} color="#8c6b53" />
            </Pressable>

            {showNoticeAccordion && (
              <View style={{ gap: 8 }}>
                {[
                  { id: 1, text: "Vé quý khách mua chỉ có hạn dùng trong ngày đặt mua và hết hạn khi tới giờ đóng cửa." },
                  { id: 2, text: "Khi đặt vé vui lòng thanh toán trước bằng hình thức chuyển khoản." },
                  { id: 3, text: "Quý khách có thể đặt trước tối đa 3 ngày." },
                  { id: 4, text: "Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ!" },
                ].map((item) => (
                  <View key={item.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#c07d33", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#ffffff" }}>{item.id}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#6b5344", flex: 1, lineHeight: 17 }}>{item.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section: Vé du lịch Header (Matching dulich.png with Gold Line & Sparkle) */}
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="ticket-outline" size={20} color="#c07d33" />
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#382119" }}>Vé du lịch</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#eed8b8", marginLeft: 6 }} />
              <Text style={{ color: "#c07d33", fontSize: 14 }}>✦</Text>
            </View>
          </View>

          {/* Ticket Items List */}
          <View style={{ marginHorizontal: 16, gap: 12, marginBottom: 14 }}>
            {tickets.map((ticket) => {
              const qty = quantities[Number(ticket.service_id)] || 0;
              const available = Number(ticket.quantity);
              const hasStockLimit = Number.isFinite(available);
              const maxTicketQuantity = hasStockLimit ? Math.min(50, Math.max(0, available)) : 50;
              const images = normalizeImages(ticket.images);
              const coverUrl = images.length > 0 ? resolveBackendUrl(images[0]) : null;

              return (
                <View key={ticket.service_id} style={styles.ticketCardRow}>
                  <View style={styles.ticketImageContainer}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="ticket-outline" size={24} color="#c07d33" />
                    )}
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#382119" }}>{ticket.service_name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#1b4332", marginTop: 4 }}>
                      {formatCurrency(ticket.price)}{" "}
                      <Text style={{ fontSize: 12, fontWeight: "500", color: "#8c6b53" }}>
                        • {hasStockLimit ? `Còn ${Math.max(0, available)} vé` : "Không giới hạn"}
                      </Text>
                    </Text>
                  </View>

                  {/* Stepper (- 0 +) */}
                  <View style={styles.stepperContainer}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => setQuantities((prev) => ({ ...prev, [ticket.service_id]: Math.max(0, qty - 1) }))}
                    >
                      <Ionicons name="remove" size={16} color="#382119" />
                    </Pressable>
                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="numeric"
                      value={String(qty)}
                      onChangeText={(text) => {
                        if (text === "") {
                          setQuantities((prev) => ({ ...prev, [ticket.service_id]: 0 }));
                          return;
                        }
                        const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
                        if (isNaN(num)) return;
                        if (num >= 0 && num <= maxTicketQuantity) {
                          setQuantities((prev) => ({ ...prev, [ticket.service_id]: num }));
                        }
                      }}
                    />
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => {
                        if (qty < maxTicketQuantity && totalQuantity < 50) {
                          setQuantities((prev) => ({ ...prev, [ticket.service_id]: qty + 1 }));
                        } else {
                          showToast("Đã đạt giới hạn số lượng vé.");
                        }
                      }}
                    >
                      <Ionicons name="add" size={16} color="#382119" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Vouchers Grouped List */}
          {ticketVouchers.length > 0 && (
            <View style={[styles.sectionCard, { paddingVertical: 12, marginTop: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#382119", marginBottom: 8, paddingHorizontal: 12 }}>Ưu đãi & Voucher địa điểm</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 12, paddingBottom: 4 }}>
                {ticketVouchers.map((voucher) => {
                  const vId = getVoucherId(voucher);
                  const isSelected = selectedVoucherId === vId;
                  const minOrder = asNumber(voucher.min_order_value, 0);
                  const maxDiscount = asNumber(voucher.max_discount_amount, 0);
                  const isEligible = totalAmount >= minOrder;

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

          {/* Total & Notes Section Card */}
          <View style={[styles.sectionCard, { marginTop: 12 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#382119" }}>Tổng tiền vé:</Text>
              <Text style={{ fontSize: 17, fontWeight: "900", color: "#1b4332" }}>{formatCurrency(totalAmount)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#ef4444" }}>Voucher giảm:</Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#ef4444" }}>-{formatCurrency(discountAmount)}</Text>
              </View>
            )}
            <Text style={{ fontSize: 11, color: "#8c6b53", marginBottom: 12 }}>
              Sau khi mua vé sẽ hiển thị QR chuyển khoản.
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Ionicons name="create-outline" size={16} color="#c07d33" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#382119" }}>Ghi chú</Text>
            </View>

            <View style={styles.noteInputContainer}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Yêu cầu thêm nếu có..."
                placeholderTextColor="#a8907e"
                style={styles.noteInput}
              />
              <Ionicons name="pencil-outline" size={16} color="#8c6b53" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Footer Bar (Matching dulich.png) */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "#8c6b53" }}>Tạm tính</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#1b4332", marginTop: 2 }}>
            {formatCurrency(finalAmount)}
          </Text>
        </View>

        <View style={{ width: 1, height: 32, backgroundColor: "#f1e5d3", marginHorizontal: 12 }} />

        <Pressable
          style={[
            styles.submitButton,
            (!canSubmit || hasInvalidQuantity || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || hasInvalidQuantity || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="card-outline" size={18} color="#ffffff" />
              <Text style={styles.submitButtonText}>Xác nhận đặt</Text>
            </View>
          )}
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={parseDateOnlyInput(useDate) || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (!selectedDate) return;
            const y = selectedDate.getFullYear();
            const mo = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const d = String(selectedDate.getDate()).padStart(2, "0");
            setUseDate(`${y}-${mo}-${d}`);
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
    marginBottom: 14,
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eed8b8",
  },
  ticketCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1e5d3",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
  },
  ticketImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#f8ebd7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8ebd7",
    borderRadius: 18,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#eed8b8",
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInput: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#382119",
    padding: 0,
  },
  noteInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  noteInput: {
    flex: 1,
    fontSize: 13,
    color: "#382119",
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
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1e5d3",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
  },
  submitButton: {
    backgroundColor: "#1b4332",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2d7a5d",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(27, 67, 50, 0.45)",
    borderColor: "transparent",
    elevation: 0,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
