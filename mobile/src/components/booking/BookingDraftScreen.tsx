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
  Switch,
  Image,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../lib/error";
import { resolveBackendUrl } from "../../lib/url";
import { normalizeImages, pad, toInputDateTime, toLocalISOString } from "../../lib/booking-utils";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { bookingApi } from "../../services/booking.api";
import { locationApi } from "../../services/location.api";
import type { CreateBookingResult, CreateBookingPayload } from "../../types/booking";
import type { LocationItem, LocationServiceItem, LocationPosTable } from "../../types/location";

export type BookingDraftMode = "ticket" | "table" | "room";

type SearchParams = {
  serviceId?: string;
  locationId?: string;
};

import { addDays, formatCurrency, parseInputDate } from "../../lib/booking-utils";

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

function calculateTotal(
  service: LocationServiceItem | null,
  quantity: number,
  mode: BookingDraftMode,
  preorderItems: Record<number, number>,
  menuItems: LocationServiceItem[]
) {
  let total = 0;
  const price = Number(service?.price ?? 0);
  if (Number.isFinite(price)) {
    total = Math.max(1, quantity) * price;
  }

  if (mode === "table") {
    let preorderTotal = 0;
    for (const [id, qty] of Object.entries(preorderItems)) {
      const item = menuItems.find((i) => Number(i.service_id) === Number(id));
      if (item && qty > 0) {
        preorderTotal += Number(item.price || 0) * qty;
      }
    }
    total += preorderTotal;
  }
  return total;
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
  const [checkInDate, setCheckInDate] = useState(() => toInputDateTime(new Date()));
  const [checkOutDate, setCheckOutDate] = useState(() => toInputDateTime(addDays(new Date(), 1)));
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");

  const [tables, setTables] = useState<LocationPosTable[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [menuItems, setMenuItems] = useState<LocationServiceItem[]>([]);
  const [isPreorder, setIsPreorder] = useState(false);
  const [preorderItems, setPreorderItems] = useState<Record<number, number>>({});

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
      mode === "table" ? locationApi.getPosTables(locationId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      mode === "table" ? locationApi.getServices(locationId, { type: "food" }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ])
      .then(([locationResponse, servicesResponse, tablesResponse, menuResponse]) => {
        if (!active) return;
        const found = (servicesResponse.data || []).find(
          (item) => Number(item.service_id) === serviceId,
        );
        setLocation(locationResponse.data);
        setService(found || null);
        if (mode === "table") {
          setTables(tablesResponse.data || []);
          setMenuItems(menuResponse.data || []);
        }
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

  // Real-time (Socket.IO) for table/room state changes
  useEffect(() => {
    if (!Number.isFinite(locationId)) return;
    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socket = io(backendUrl);

    socket.on("connect", () => {
      socket.emit("join_location_public", { locationId });
    });

    socket.on("public_status_changed", (data: { type?: string; action?: string; status?: string; table_id?: number | string; target_id?: number | string }) => {
      if (data?.type === "table" || data?.type === "pos_updated") {
        if (mode === "table") {
          locationApi.getPosTables(locationId).then((res) => {
            if (res.data) {
              setTables(res.data);
              // Conflict resolution
              if (data?.action === "table_reserved" || data?.status === "reserved") {
                const targetTableId = Number(data.table_id || data.target_id);
                setSelectedTableIds((prev) => {
                  if (prev.includes(targetTableId)) {
                    showToast("Bàn bạn đang chọn vừa có người đặt trước. Vui lòng chọn bàn khác.");
                    return prev.filter((id) => id !== targetTableId);
                  }
                  return prev;
                });
              }
            }
          }).catch(() => {});
        }
      }
      if (data?.type === "tourist_updated" || data?.type === "hotel_updated") {
        if (mode === "room") {
           // Basic conflict approach for rooms: just reload services if needed. 
           // In future, room-level specific conflict could go here.
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [locationId, mode]);

  // Reset form when screen is focused again (e.g., after payment or wallet)
  useFocusEffect(
    useCallback(() => {
      // Reset result to show form again
      if (bookingResult) {
        setBookingResult(null);
        setQuantity(1);
        setSelectedTableIds([]);
        setIsPreorder(false);
        setPreorderItems({});
        setNotes("");
      }
    }, [bookingResult])
  );

  const totalAmount = useMemo(
    () => calculateTotal(service, mode === "table" ? selectedTableIds.length : quantity, mode, preorderItems, menuItems),
    [mode, quantity, service, selectedTableIds.length, preorderItems, menuItems],
  );

  const canSubmit =
    Boolean(location && service) &&
    (mode === "table" ? selectedTableIds.length > 0 : quantity > 0) &&
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
      const payload: CreateBookingPayload = {
        location_id: Number(location.location_id),
        service_id: Number(service.service_id),
        check_in_date: toLocalISOString(checkIn),
        check_out_date: checkOut ? toLocalISOString(checkOut) : null,
        quantity: mode === "table" ? selectedTableIds.length : quantity,
        source: "mobile",
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        notes: notes.trim() || null,
        reserve_on_confirm: mode === "table" || mode === "room",
      };

      if (mode === "ticket") {
        payload.ticket_items = [{ service_id: Number(service.service_id), quantity }];
      } else if (mode === "table") {
        payload.table_ids = selectedTableIds;
        if (isPreorder) {
          const preorder = Object.entries(preorderItems)
            .filter(([_, q]) => q > 0)
            .map(([id, q]) => ({ service_id: Number(id), quantity: q }));
          if (preorder.length > 0) {
            payload.preorder_items = preorder;
          }
        }
      }

      const response = await bookingApi.createBooking(payload);

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
        const transactionCode = response.data.transaction_code || "Đang chờ mã giao dịch";
        showToast(`Đã tạo thanh toán: ${transactionCode}`);
        const returnTarget = mode === "ticket" ? "/wallet/tickets" : mode === "room" ? "/wallet/room-pass" : "/wallet/table-pass";
        router.push(`/booking/payment/${bookingResult.bookingId}?mode=${mode}&returnTo=${encodeURIComponent(returnTarget)}`);
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
          <Text style={styles.eyebrow}>ĐẶT BÀN</Text>
          <Text style={styles.title}>{location?.location_name || modeTitle(mode)}</Text>
        </View>
        <Pressable
          style={styles.cartButton}
          onPress={() => {
            const target =
              mode === "ticket"
                ? "/wallet/tickets"
                : mode === "room"
                  ? "/wallet/room-pass"
                  : mode === "table"
                    ? "/wallet/table-pass"
                    : "/wallet";
            router.push(target as any);
          }}
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
              {mode === "ticket" ? "Ngày dùng vé" : "Thời gian tới (nhận dịch vụ)"}
            </Text>
            <TextInput
              value={checkInDate}
              onChangeText={setCheckInDate}
              placeholder="DD/MM/YYYY HH:mm"
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

          {mode === "table" ? (
            <View style={styles.field}>
              <View style={styles.notesContainer}>
                <Text style={styles.notesTitle}>Lưu ý đặt bàn</Text>
                <Text style={styles.notesText}>• Khách có thể tới nhận bàn trong khoảng ± 1 giờ so với giờ đã đặt.</Text>
                <Text style={styles.notesText}>• Khi đặt bàn nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.</Text>
                <Text style={styles.notesText}>• Đặt món trước bắt buộc thanh toán trước qua chuyển khoản.</Text>
                <Text style={styles.notesText}>• Tiền đã thanh toán sẽ không được hoàn lại.</Text>
              </View>

              <View style={styles.tableSelectionHeader}>
                <Text style={styles.label}>Chọn bàn</Text>
                <Text style={styles.tableSelectedText}>Đã chọn: {selectedTableIds.length}</Text>
              </View>
              {tables.length === 0 ? (
                <Text style={styles.noDataText}>Không có sơ đồ bàn</Text>
              ) : (
                <View style={styles.tableListContainer}>
                  <ScrollView nestedScrollEnabled contentContainerStyle={styles.tableList}>
                    {tables.map((t) => {
                      const isSelected = selectedTableIds.includes(t.table_id);
                      return (
                        <Pressable
                          key={t.table_id}
                          style={[styles.tableItem, isSelected && styles.tableItemSelected]}
                          onPress={() => {
                            setSelectedTableIds((prev) => {
                              if (prev.includes(t.table_id)) {
                                return prev.filter((id) => id !== t.table_id);
                              }
                              if (isPreorder) {
                                return [t.table_id];
                              }
                              return [...prev, t.table_id];
                            });
                          }}
                        >
                          <Text style={[styles.tableName, isSelected && styles.tableNameSelected]}>{t.table_name}</Text>
                          <Text style={[styles.tableStatus, isSelected && styles.tableStatusSelected]}>
                            {t.status === "active" ? "Trống" : "Bảo trì"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.preorderToggle}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Đặt món trước (bắt buộc chuyển khoản)</Text>
                  <Text style={styles.hintText}>
                    {selectedTableIds.length > 1 
                      ? "Chỉ hỗ trợ đặt món khi chọn 1 bàn" 
                      : "Chọn món để nhà hàng chuẩn bị trước"}
                  </Text>
                </View>
                <Switch 
                  value={isPreorder} 
                  onValueChange={(val) => {
                    if (val && selectedTableIds.length > 1) {
                      showToast("Vui lòng chỉ chọn 1 bàn để đặt món trước.");
                      return;
                    }
                    setIsPreorder(val);
                  }} 
                />
              </View>

              {isPreorder && menuItems.length > 0 && (
                <View style={styles.menuList}>
                  {menuItems.map((item) => {
                    const qty = preorderItems[item.service_id] || 0;
                    const images = normalizeImages(item.images);
                    const coverUrl = images.length > 0 ? resolveBackendUrl(images[0]) : null;
                    return (
                      <View key={item.service_id} style={styles.menuItem}>
                        <View style={styles.menuItemImageContainer}>
                          {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.menuItemImage} />
                          ) : (
                            <Ionicons name="fast-food-outline" size={24} color="#94a3b8" />
                          )}
                        </View>
                        <View style={styles.menuItemInfo}>
                          <Text style={styles.menuItemName}>{item.service_name}</Text>
                          <Text style={styles.menuItemPrice}>{formatCurrency(item.price)}</Text>
                        </View>
                        <View style={styles.miniStepper}>
                          <Pressable
                            style={styles.miniStepButton}
                            onPress={() => setPreorderItems((prev) => ({ ...prev, [item.service_id]: Math.max(0, qty - 1) }))}
                          >
                            <Ionicons name="remove" size={16} color="#0f172a" />
                          </Pressable>
                          <Text style={styles.miniQuantityText}>{qty}</Text>
                          <Pressable
                            style={styles.miniStepButton}
                            onPress={() => setPreorderItems((prev) => ({ ...prev, [item.service_id]: Math.min(50, qty + 1) }))}
                          >
                            <Ionicons name="add" size={16} color="#0f172a" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>
                {mode === "room" ? "Số phòng" : "Số lượng vé"}
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
          )}

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
  notesContainer: {
    backgroundColor: "#fffbeb",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 12,
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
  tableSelectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tableSelectedText: {
    fontSize: 13,
    color: "#0f766e",
    fontWeight: "700",
  },
  noDataText: {
    fontSize: 14,
    color: "#64748b",
    fontStyle: "italic",
    marginBottom: 12,
  },
  tableListContainer: {
    height: 230,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },
  tableList: {
    padding: 8,
    gap: 8,
  },
  tableItem: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableItemSelected: {
    backgroundColor: "#ccfbf1",
    borderColor: "#14b8a6",
  },
  tableName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  tableNameSelected: {
    color: "#0f766e",
  },
  tableStatus: {
    fontSize: 13,
    color: "#64748b",
  },
  tableStatusSelected: {
    color: "#0d9488",
    fontWeight: "600",
  },
  preorderToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  menuList: {
    marginTop: 8,
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuItemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  menuItemImage: {
    width: "100%",
    height: "100%",
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f766e",
    marginTop: 2,
  },
  miniStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    height: 32,
  },
  miniStepButton: {
    width: 32,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  miniQuantityText: {
    width: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
});
 
