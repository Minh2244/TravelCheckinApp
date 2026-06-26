import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../lib/error";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import type { CreateBookingResult } from "../../types/booking";
import type { LocationItem, LocationServiceItem } from "../../types/location";

export type BookingDraftMode = "ticket" | "table" | "room";

type SearchParams = {
  serviceId?: string;
  locationId?: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toInputDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseInputDate(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return "Liên hệ";
  }
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

function modeTitle(mode: BookingDraftMode) {
  if (mode === "ticket") return "Đặt vé";
  if (mode === "table") return "Đặt bàn";
  return "Đặt phòng";
}

function modeDescription(mode: BookingDraftMode) {
  if (mode === "ticket") return "Chọn ngày dùng vé và số lượng vé cần mua.";
  if (mode === "table") return "Gửi yêu cầu giữ bàn, owner duyệt trước khi hoàn tất.";
  return "Gửi yêu cầu giữ phòng, owner duyệt trước khi hoàn tất.";
}

function calculateTotal(service: LocationServiceItem | null, quantity: number, mode: BookingDraftMode) {
  const price = Number(service?.price ?? 0);
  if (!Number.isFinite(price)) {
    return 0;
  }
  return Math.max(1, quantity) * price * (mode === "room" ? 1 : 1);
}

export function BookingDraftScreen({ mode }: { mode: BookingDraftMode }) {
  const router = useRouter();
  const params = useLocalSearchParams<SearchParams>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const serviceId = Number(params.serviceId);
  const locationId = Number(params.locationId);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [service, setService] = useState<LocationServiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingResult | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [checkInDate, setCheckInDate] = useState(() => toInputDateTime(addDays(new Date(), 1)));
  const [checkOutDate, setCheckOutDate] = useState(() => toInputDateTime(addDays(new Date(), 2)));
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!Number.isFinite(locationId) || !Number.isFinite(serviceId)) {
      setLoading(false);
      showToast("Thiếu dữ liệu dịch vụ cần đặt.");
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
        const found = (servicesResponse.data || []).find(
          (item) => Number(item.service_id) === serviceId,
        );
        setLocation(locationResponse.data);
        setService(found || null);
        if (!found) {
          showToast("Không tìm thấy dịch vụ này tại địa điểm.");
        }
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
  }, [locationId, serviceId]);

  const totalAmount = useMemo(
    () => calculateTotal(service, quantity, mode),
    [mode, quantity, service],
  );

  const canSubmit =
    Boolean(location && service) &&
    quantity > 0 &&
    Boolean(parseInputDate(checkInDate)) &&
    (mode !== "room" || Boolean(parseInputDate(checkOutDate))) &&
    (!["table", "room"].includes(mode) || Boolean(contactName.trim() && contactPhone.trim()));

  async function handleSubmit() {
    if (!location || !service || !canSubmit) {
      showToast("Bạn kiểm tra lại thông tin đặt dịch vụ nha.");
      return;
    }

    const checkIn = parseInputDate(checkInDate);
    const checkOut = mode === "room" ? parseInputDate(checkOutDate) : null;

    if (!checkIn || (mode === "room" && !checkOut)) {
      showToast("Ngày giờ chưa đúng định dạng.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await bookingApi.createBooking({
        location_id: Number(location.location_id),
        service_id: Number(service.service_id),
        check_in_date: checkIn.toISOString(),
        check_out_date: checkOut ? checkOut.toISOString() : null,
        quantity,
        source: "mobile",
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        notes: notes.trim() || null,
        reserve_on_confirm: mode === "table" || mode === "room",
        ticket_items:
          mode === "ticket"
            ? [{ service_id: Number(service.service_id), quantity }]
            : undefined,
      });

      setBookingResult(response.data);
      showToast(response.message || "Tạo booking thành công.");
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePayment() {
    if (!bookingResult?.bookingId) return;

    setPaymentLoading(true);
    try {
      const response = await bookingApi.createOrGetPaymentForBooking(bookingResult.bookingId);
      const transactionCode = response.data.transaction_code || "đang chờ mã giao dịch";
      showToast(`Đã tạo thanh toán: ${transactionCode}`);
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
        <Text style={styles.loadingText}>Đang tải dữ liệu đặt dịch vụ...</Text>
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
          <Text style={styles.eyebrow}>Giai đoạn 4</Text>
          <Text style={styles.title}>{modeTitle(mode)}</Text>
        </View>
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
          <View style={styles.serviceRow}>
            <View style={styles.serviceIcon}>
              <Ionicons
                name={mode === "ticket" ? "ticket-outline" : mode === "table" ? "restaurant-outline" : "bed-outline"}
                size={22}
                color="#0f766e"
              />
            </View>
            <View style={styles.serviceText}>
              <Text style={styles.serviceName}>{service?.service_name || "Dịch vụ"}</Text>
              <Text style={styles.serviceMeta}>
                {formatCurrency(service?.price)} / lượt
              </Text>
            </View>
          </View>
          <Text style={styles.modeHint}>{modeDescription(mode)}</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Thông tin đặt</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              {mode === "ticket" ? "Ngày dùng vé" : "Ngày giờ đến"}
            </Text>
            <TextInput
              value={checkInDate}
              onChangeText={setCheckInDate}
              placeholder="YYYY-MM-DD HH:mm"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>

          {mode === "room" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Ngày giờ trả phòng</Text>
              <TextInput
                value={checkOutDate}
                onChangeText={setCheckOutDate}
                placeholder="YYYY-MM-DD HH:mm"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>
              {mode === "room" ? "Số phòng" : mode === "table" ? "Số bàn / suất" : "Số lượng vé"}
            </Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepButton}
                onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Ionicons name="remove" size={20} color="#0f172a" />
              </Pressable>
              <Text style={styles.quantityText}>{quantity}</Text>
              <Pressable
                style={styles.stepButton}
                onPress={() => setQuantity((value) => Math.min(50, value + 1))}
              >
                <Ionicons name="add" size={20} color="#0f172a" />
              </Pressable>
            </View>
          </View>

          {mode === "table" || mode === "room" ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Tên liên hệ</Text>
                <TextInput
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="Nhập tên người đặt"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Số điện thoại</Text>
                <TextInput
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="Nhập số điện thoại"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
            </>
          ) : null}

          <View style={styles.field}>
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
        <View>
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
              {paymentLoading ? "Đang tạo..." : "Tạo thanh toán"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.primaryButton,
              (!canSubmit || submitting) && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? "Đang gửi..." : "Xác nhận đặt"}
            </Text>
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
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 22,
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
  serviceRow: {
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceText: {
    flex: 1,
  },
  serviceName: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  serviceMeta: {
    marginTop: 3,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
  modeHint: {
    marginTop: 14,
    color: "#475569",
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
    fontSize: 18,
    fontWeight: "900",
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
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 13,
    color: "#0f172a",
    fontSize: 16,
  },
  noteInput: {
    minHeight: 92,
    paddingTop: 12,
  },
  stepper: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 7,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
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
    marginTop: 3,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  totalLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  primaryButton: {
    minWidth: 170,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
