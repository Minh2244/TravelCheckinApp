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
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../lib/error";
import { resolveBackendUrl } from "../../lib/url";
import { isLocationOpen } from "../../lib/time";
import { normalizeImages, toInputDateTime, toLocalISOString, addDays, formatCurrency, parseInputDate } from "../../lib/booking-utils";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import type { CreateBookingResult, CreateBookingPayload } from "../../types/booking";
import type { LocationItem, LocationServiceItem } from "../../types/location";

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
  const user = useAuthStore((state) => state.user);

  const locationId = Number(params.locationId);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [tickets, setTickets] = useState<LocationServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingResult | null>(null);

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [useDate, setUseDate] = useState(() => {
    // Current date format YYYY-MM-DD
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");

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
    ])
      .then(([locationResponse, servicesResponse]) => {
        if (!active) return;
        setLocation(locationResponse.data);
        setTickets(servicesResponse.data || []);
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

  const wentToPaymentRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Clear form only when returning from payment screen
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

  const totalQuantity = useMemo(() => {
    return Object.values(quantities).reduce((acc, val) => acc + val, 0);
  }, [quantities]);

  const canSubmit = Boolean(location) && totalQuantity > 0 && Boolean(useDate.trim());
  const hasInvalidQuantity = useMemo(
    () =>
      tickets.some((ticket) => {
        const available = Number(ticket.quantity);
        if (!Number.isFinite(available)) return false;
        return (quantities[Number(ticket.service_id)] || 0) > Math.max(0, available);
      }),
    [quantities, tickets],
  );

  async function handleSubmit() {
    if (!location || !canSubmit) {
      showToast("Bạn kiểm tra lại thông tin vé nha.");
      return;
    }

    if (totalQuantity > 50) {
      showToast("Chỉ được mua tối đa 50 vé tổng cộng mỗi lần.");
      return;
    }

    if (hasInvalidQuantity) {
      showToast("So luong ve chon vuot qua so ve con lai.");
      return;
    }

    const checkIn = parseDateOnlyInput(useDate);
    if (!checkIn) {
      showToast("Ngày sử dụng chưa đúng định dạng (YYYY-MM-DD).");
      return;
    }

    setSubmitting(true);
    try {
      const ticketItems = Object.entries(quantities)
        .filter(([_, q]) => q > 0)
        .map(([id, q]) => ({ service_id: Number(id), quantity: q }));

      const payload: CreateBookingPayload = {
        location_id: Number(location.location_id),
        service_id: Number(tickets[0].service_id), // just use the first one for backwards compatibility
        check_in_date: toLocalISOString(checkIn),
        check_out_date: null,
        quantity: totalQuantity,
        source: "mobile",
        contact_name: user?.full_name || null,
        contact_phone: user?.phone || null,
        notes: notes.trim() || null,
        reserve_on_confirm: false,
        ticket_items: ticketItems,
      };

      const response = await bookingApi.createBooking(payload);
      setBookingResult(response.data);
      
      // Auto-redirect to QR payment
      setTimeout(() => {
        wentToPaymentRef.current = true;
        router.push(`/booking/payment/${response.data.bookingId}?mode=ticket&returnTo=back`);
      }, 500);

    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const formatted = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      setUseDate(formatted);
    }
  };

  async function handleCreatePayment() {
    if (!bookingResult?.bookingId) return;

    setPaymentLoading(true);
    try {
      const response = await bookingApi.createOrGetPaymentForBooking(bookingResult.bookingId);
      const transactionCode = response.data.transaction_code || "Đang chờ mã giao dịch";
      showToast(`Đã tạo thanh toán: ${transactionCode}`);
      wentToPaymentRef.current = true;
      router.push(`/booking/payment/${bookingResult.bookingId}?mode=ticket&returnTo=back`);
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải dữ liệu vé...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Xác nhận thông tin booking</Text>
        </View>
        <Pressable
          style={styles.cartButton}
          onPress={() => router.push("/wallet/tickets")}
        >
          <Ionicons name="ticket-outline" size={24} color="#0f172a" />
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
          <Text style={styles.address} numberOfLines={2}>
            {location?.address || "Chưa có địa chỉ"}
          </Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Ngày sử dụng</Text>
              <Pressable onPress={() => setShowDatePicker(true)}>
                <TextInput
                  value={useDate}
                  editable={false}
                  placeholder="YYYY-MM-DD"
                  style={[styles.input, { color: "#0f172a" }]}
                  pointerEvents="none"
                />
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={parseDateOnlyInput(useDate) || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  onChange={onChangeDate}
                />
              )}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Hạn sử dụng</Text>
              <TextInput
                value="Trong ngày"
                editable={false}
                style={[styles.input, { backgroundColor: "#f1f5f9", color: "#64748b" }]}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Vé du lịch</Text>
          
          {tickets.map((ticket) => {
            const qty = quantities[Number(ticket.service_id)] || 0;
            const available = Number(ticket.quantity);
            const hasStockLimit = Number.isFinite(available);
            const maxTicketQuantity = hasStockLimit
              ? Math.min(50, Math.max(0, available))
              : 50;
            const images = normalizeImages(ticket.images);
            const coverUrl = images.length > 0 ? resolveBackendUrl(images[0]) : null;
            return (
              <View key={ticket.service_id} style={styles.ticketItem}>
                <View style={styles.ticketImageContainer}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.ticketImage} />
                  ) : (
                    <Ionicons name="ticket" size={24} color="#94a3b8" />
                  )}
                </View>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketName}>{ticket.service_name}</Text>
                  <Text style={styles.ticketPrice}>
                    {formatCurrency(ticket.price)}{" "}
                    <Text style={styles.ticketStock}>
                      • {hasStockLimit ? `Còn ${Math.max(0, available)} vé` : "Không giới hạn"}
                    </Text>
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => setQuantities((prev) => ({ ...prev, [ticket.service_id]: Math.max(0, qty - 1) }))}
                  >
                    <Ionicons name="remove" size={16} color="#0f172a" />
                  </Pressable>
                  <TextInput
                    style={styles.quantityInput}
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
                      } else if (num > maxTicketQuantity) {
                        setQuantities((prev) => ({
                          ...prev,
                          [ticket.service_id]: maxTicketQuantity,
                        }));
                        showToast(
                          hasStockLimit
                            ? `Chi con ${maxTicketQuantity} ve cho loai nay.`
                            : "Chi duoc chon toi da 50 ve moi loai.",
                        );
                      }
                    }}
                    onBlur={() => {
                      if (totalQuantity > 50) {
                        showToast("Chỉ được mua tối đa 50 vé tổng cộng mỗi lần");
                      }
                    }}
                  />
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => {
                      if (qty < maxTicketQuantity && totalQuantity < 50) {
                        setQuantities((prev) => ({ ...prev, [ticket.service_id]: qty + 1 }));
                      } else if (hasStockLimit && qty >= maxTicketQuantity) {
                        showToast(`Chi con ${maxTicketQuantity} ve cho loai nay.`);
                      } else if (totalQuantity >= 50) {
                        showToast("Chỉ được mua tối đa 50 vé tổng cộng mỗi lần");
                      }
                    }}
                  >
                    <Ionicons name="add" size={16} color="#0f172a" />
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.totalBlock}>
            <Text style={styles.totalBlockLabel}>Tổng tiền vé:</Text>
            <Text style={styles.totalBlockValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <Text style={styles.totalBlockHint}>Sau khi mua vé sẽ hiển thị QR chuyển khoản.</Text>

          <View style={[styles.field, { marginTop: 10 }]}>
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Yêu cầu thêm nếu có"
              style={[styles.input, styles.noteInput]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Lưu ý</Text>
          <Text style={styles.notesText}>1/ Vé quý khách mua chỉ có hạn dùng trong ngày đặt mua và hết hạn khi tới giờ đóng cửa.</Text>
          <Text style={styles.notesText}>2/ Khi đặt vé vui lòng thanh toán trước bằng hình thức chuyển khoản.</Text>
          <Text style={styles.notesText}>3/ Quý khách có thể đặt trước tối đa 3 ngày.</Text>
          <Text style={styles.notesText}>4/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.</Text>
        </View>

        {bookingResult ? (
          <View style={styles.resultCard}>
            <Ionicons name="checkmark-circle" size={28} color="#0f766e" />
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>Đã tạo booking #{bookingResult.bookingId}</Text>
              <Text style={styles.resultMeta}>
                Tổng tiền: {formatCurrency(bookingResult.finalAmount)}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>Tạm tính</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
        </View>
        {bookingResult ? (
          <Pressable
            style={[styles.primaryButton, paymentLoading && styles.disabledButton]}
            onPress={handleCreatePayment}
            disabled={paymentLoading}
          >
            <Text style={styles.primaryButtonText}>
              {paymentLoading ? "Đang tạo..." : "Thanh toán"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.primaryButton,
              (!canSubmit || hasInvalidQuantity || submitting) && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || hasInvalidQuantity || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Xác nhận đặt</Text>
            )}
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#eef2f3",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  header: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  content: {
    padding: 14,
    gap: 14,
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    padding: 16,
  },
  locationName: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 21,
    fontWeight: "900",
  },
  address: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },
  formSection: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    padding: 16,
    gap: 13,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  field: {
    gap: 7,
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    color: "#0f172a",
    fontSize: 15,
  },
  noteInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  ticketItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  ticketImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ticketImage: {
    width: "100%",
    height: "100%",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  ticketPrice: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  ticketStock: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "500",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 4,
    gap: 8,
  },
  stepButton: {
    width: 28,
    height: 28,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  quantityText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  quantityInput: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "center",
    padding: 0,
    margin: 0,
  },
  totalBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  totalBlockLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  totalBlockValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  totalBlockHint: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  notesContainer: {
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  notesTitle: {
    color: "#b45309",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  notesText: {
    color: "#92400e",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  resultCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  resultMeta: {
    marginTop: 4,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  totalLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  totalValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
