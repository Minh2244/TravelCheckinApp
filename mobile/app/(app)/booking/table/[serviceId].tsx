import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AxiosError } from "axios";
import { io } from "socket.io-client";

import { getErrorMessage } from "../../../../src/lib/error";
import { resolveBackendUrl } from "../../../../src/lib/url";
import { isLocationOpen } from "../../../../src/lib/time";
import { formatCurrency, parseInputDate, toInputDateTime, toLocalISOString } from "../../../../src/lib/booking-utils";
import { VoucherStubCard } from "../../../../src/components/booking/VoucherStubCard";
import { useAuthStore } from "../../../../src/modules/auth/store";
import { AppAlert as Alert } from "../../../../src/modules/ui/app-alert";
import { showToast } from "../../../../src/modules/ui/toast-store";
import { bookingApi } from "../../../../src/services/booking.api";
import { locationApi } from "../../../../src/services/location.api";
import type {
  LocationItem,
  LocationPosArea,
  LocationPosTable,
  LocationServiceItem,
} from "../../../../src/types/location";
import { userApi, type LocationVoucher } from "../../../../src/services/user.api";

type SearchParams = {
  locationId?: string;
};

import {
  asNumber,
  getVoucherId,
  voucherStillUsable,
  calculateVoucherDiscount,
} from "../../../../src/lib/voucher-utils";

export default function TableBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SearchParams>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const lastLoadedCheckInRef = useRef<string | null>(null);

  const locationId = Number(params.locationId);
  const [location, setLocation] = useState<LocationItem | null>(null);
  const [areas, setAreas] = useState<LocationPosArea[]>([]);
  const [tables, setTables] = useState<LocationPosTable[]>([]);
  const [services, setServices] = useState<LocationServiceItem[]>([]);
  const [savedVouchers, setSavedVouchers] = useState<LocationVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [checkInDate, setCheckInDate] = useState(() =>
    toInputDateTime(new Date(Date.now() + 3600000)),
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [preorderEnabled, setPreorderEnabled] = useState(false);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const [preorderQtyByServiceId, setPreorderQtyByServiceId] = useState<
    Record<number, number>
  >({});
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [showNoticeAccordion, setShowNoticeAccordion] = useState(true);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);

  const loadTables = useCallback(async () => {
    if (!Number.isFinite(locationId)) return null;
    const checkIn = parseInputDate(checkInDate);
    if (!checkIn) return null;

    setTablesLoading(true);
    try {
      const iso = toLocalISOString(checkIn);
      const res = await locationApi.getPosTables(locationId, { check_in_date: iso });
      setTables(res.data || []);
      return res.data || [];
    } catch (err) {
      showToast(getErrorMessage(err));
      return null;
    } finally {
      setTablesLoading(false);
    }
  }, [locationId, checkInDate]);

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
      locationApi.getPosAreas(locationId),
      locationApi.getServices(locationId),
      userApi.getUsableVouchersByLocation(locationId),
    ])
      .then(([locRes, areasRes, srvRes, vouchersRes]) => {
        if (!active) return;
        setLocation(locRes.data);
        setAreas(areasRes.data || []);
        const foodOrDrink = (srvRes.data || []).filter((item: LocationServiceItem) => {
          const t = String(item.service_type || "").toLowerCase();
          return t === "food" || t === "drink";
        });
        setServices(foodOrDrink);
        setSavedVouchers(vouchersRes.data || []);
      })
      .catch((err) => {
        if (active) showToast(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locationId]);

  useEffect(() => {
    if (checkInDate && lastLoadedCheckInRef.current !== checkInDate) {
      lastLoadedCheckInRef.current = checkInDate;
      void loadTables();
    }
  }, [checkInDate, loadTables]);

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

  // Real-time (Socket.IO) for table state changes
  useEffect(() => {
    if (!Number.isFinite(locationId)) return;
    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socket = io(backendUrl, { transports: ["websocket"] });

    socket.on("connect", () => {
      socket.emit("join_location_public", { locationId });
    });

    socket.on("public_status_changed", (data: any) => {
      if (
        data?.type === "table_updated" ||
        data?.type === "booking_updated" ||
        data?.type === "table" ||
        data?.type === "pos_updated"
      ) {
        void loadTables();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [locationId, loadTables]);

  const areaOptions = useMemo(() => {
    return [
      { label: "Tất cả", value: "all" },
      ...areas.map((a) => ({ label: a.area_name, value: String(a.area_id) })),
    ];
  }, [areas]);

  const filteredTables = useMemo(() => {
    let result = selectedArea === "all" ? [...tables] : tables.filter((t) => String(t.area_id) === selectedArea);
    return result.sort((a, b) => a.table_name.localeCompare(b.table_name, undefined, { numeric: true }));
  }, [tables, selectedArea]);

  const menuCategories = useMemo(() => {
    const map = new Map<string, number>();
    map.set("Tất cả món", services.length);
    services.forEach((s) => {
      const cat = String(s.category_name || "Món khác").trim() || "Món khác";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [services]);

  const filteredServices = useMemo(() => {
    if (selectedMenuCategory === "Tất cả món" || selectedMenuCategory === "all") return services;
    return services.filter((s) => {
      const cat = String(s.category_name || "Món khác").trim() || "Món khác";
      return cat === selectedMenuCategory;
    });
  }, [services, selectedMenuCategory]);

  const preorderItemsArray = useMemo(() => {
    return Object.entries(preorderQtyByServiceId)
      .filter(([_, qty]) => qty > 0)
      .map(([idStr, quantity]) => ({
        service_id: Number(idStr),
        quantity,
      }));
  }, [preorderQtyByServiceId]);

  const preorderTotal = useMemo(() => {
    let sum = 0;
    for (const item of preorderItemsArray) {
      const found = services.find((s) => Number(s.service_id) === item.service_id);
      if (found) {
        sum += asNumber(found.price, 0) * item.quantity;
      }
    }
    return sum;
  }, [preorderItemsArray, services]);

  const usableVouchers = useMemo(() => {
    return savedVouchers.filter((v) => {
      if (!voucherStillUsable(v)) return false;
      
      // Filter by location type
      if (v.apply_to_location_type && v.apply_to_location_type !== "all" && location?.location_type) {
        if (v.apply_to_location_type !== location.location_type) return false;
      }
      
      // Filter by service type (table maps to food)
      if (v.apply_to_service_type && v.apply_to_service_type !== "all") {
        if (v.apply_to_service_type !== "food") return false;
      }
      
      return true;
    });
  }, [savedVouchers, location]);

  const groupedVouchers = useMemo(() => {
    const map = new Map<string, { voucher: LocationVoucher; actualQuantity: number }>();
    usableVouchers.forEach((v) => {
      const discountVal = asNumber(v.discount_value, 0);
      const discountType = String(v.discount_type || "").toLowerCase();
      const minOrder = asNumber(v.min_order_value, 0);
      const campaignName = v.campaign_name || "Voucher Giảm Giá";
      const locName = v.location_name || (v.location_id ? location?.location_name : "Toàn hệ thống");

      const key = `${discountVal}_${discountType}_${minOrder}_${campaignName}_${locName}`;
      if (map.has(key)) {
        map.get(key)!.actualQuantity += 1;
      } else {
        map.set(key, { voucher: v, actualQuantity: 1 });
      }
    });
    return Array.from(map.values());
  }, [usableVouchers, location]);

  const selectedVoucher = useMemo(() => {
    if (selectedVoucherId == null) return null;
    return (
      usableVouchers.find((v) => getVoucherId(v) === selectedVoucherId) ?? null
    );
  }, [selectedVoucherId, usableVouchers]);

  const voucherDiscount = useMemo(
    () => calculateVoucherDiscount(selectedVoucher, preorderTotal),
    [preorderTotal, selectedVoucher],
  );

  const payableTotal = Math.max(0, preorderTotal - voucherDiscount);

  const canSubmit =
    selectedTableIds.length > 0 &&
    Boolean(parseInputDate(checkInDate)) &&
    Boolean(contactName.trim()) &&
    Boolean(contactPhone.trim()) &&
    (!preorderEnabled ||
      (selectedTableIds.length === 1 && preorderItemsArray.length > 0)) &&
    !submitting;

  function toggleTable(table: LocationPosTable) {
    const tableId = Number(table.table_id);
    if (!Number.isFinite(tableId)) return;
    if (table.status !== "free") {
      showToast("Bàn này hiện không còn trống.");
      return;
    }

    setSelectedTableIds((current) => {
      if (current.includes(tableId)) return current.filter((id) => id !== tableId);
      if (preorderEnabled && current.length >= 1) {
        showToast("Đặt món trước chỉ áp dụng cho 1 bàn mỗi lần.");
        return [tableId];
      }
      return [...current, tableId];
    });
  }

  function updatePreorderQuantity(serviceId: number, delta: number) {
    setPreorderQtyByServiceId((current) => {
      const nextQuantity = Math.max(0, (current[serviceId] || 0) + delta);
      const next = { ...current };
      if (nextQuantity <= 0) delete next[serviceId];
      else next[serviceId] = nextQuantity;
      return next;
    });
  }

  function togglePreorder() {
    setPreorderEnabled((current) => {
      const next = !current;
      if (next && selectedTableIds.length > 1) {
        setSelectedTableIds((ids) => ids.slice(0, 1));
        showToast("Đặt món trước chỉ giữ lại 1 bàn để đúng quy định thanh toán.");
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!location) return;

    if (selectedTableIds.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 bàn.");
      return;
    }
    const checkIn = parseInputDate(checkInDate);
    if (!checkIn) {
      showToast("Thời gian tới không hợp lệ.");
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      showToast("Vui lòng điền đủ họ tên và số điện thoại.");
      return;
    }

    if (preorderEnabled) {
      if (selectedTableIds.length > 1) {
        showToast("Khi đặt món trước, chỉ được chọn 1 bàn.");
        return;
      }
      if (preorderItemsArray.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 món khi bật đặt món trước.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const latestTables = await loadTables();
      if (latestTables) {
        const byId = new Map(
          latestTables.map((table) => [Number(table.table_id), table] as const),
        );
        const conflicts = selectedTableIds
          .map((id) => byId.get(id))
          .filter(
            (table): table is LocationPosTable =>
              table != null && table.status !== "free",
          );

        if (conflicts.length > 0) {
          setSelectedTableIds((current) =>
            current.filter((id) => byId.get(id)?.status === "free"),
          );
          showToast("Một số bàn vừa đổi trạng thái, bạn chọn lại giúp mình.");
          return;
        }
      }

      const response = await bookingApi.createBooking({
        location_id: Number(location.location_id),
        check_in_date: toLocalISOString(checkIn),
        check_out_date: null,
        quantity: selectedTableIds.length,
        source: "mobile",
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        notes: notes.trim() || null,
        table_ids: selectedTableIds,
        preorder_items: preorderEnabled ? preorderItemsArray : undefined,
        reserve_on_confirm: preorderEnabled ? true : undefined,
        voucher_code:
          preorderEnabled && selectedVoucher?.code ? selectedVoucher.code : null,
      });

      setSelectedTableIds([]);
      setPreorderEnabled(false);
      setPreorderQtyByServiceId({});
      setSelectedVoucherId(null);
      setNotes("");

      if (preorderEnabled) {
        void loadTables();
        const createdFinalAmount = Math.max(0, Number(response.data.finalAmount ?? payableTotal));
        if (createdFinalAmount <= 0) {
          showToast("Đặt bàn thành công. Đơn 0đ không cần chuyển khoản.");
          return;
        }
        router.push(
          `/booking/payment/${response.data.bookingId}?mode=table&returnTo=${encodeURIComponent(`/booking/table/0?locationId=${locationId}`)}` as never,
        );
        return;
      }

      await loadTables();

      Alert.alert(
        "Đặt bàn thành công! 🎉",
        `Booking #${response.data.bookingId} đã được gửi.\n\nChủ địa điểm (Owner) sẽ duyệt yêu cầu đặt bàn của bạn. Bạn sẽ nhận thông báo khi được xác nhận.`,
        [
          {
            text: "Đóng",
            style: "cancel",
          },
        ],
      );
    } catch (error) {
      if (preorderEnabled) {
        try {
          const latest = await loadTables();
          if (latest) {
            const byId = new Map(
              latest.map((t) => [Number(t.table_id), t] as const),
            );
            setSelectedTableIds((current) =>
              current.filter((id) => {
                const t = byId.get(id);
                return t?.status === "free";
              })
            );
          }
        } catch { }
      }

      let msg = getErrorMessage(error);
      if (error instanceof AxiosError && error.response?.status === 409) {
        msg = msg || "Bàn đã có người đặt trước. Vui lòng chọn bàn khác.";
        Alert.alert("Không thể đặt bàn", msg, [{ text: "OK" }]);
      } else {
        showToast(msg || "Có lỗi xảy ra khi đặt bàn.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1b4332" />
        <Text style={styles.loadingText}>Đang tải sơ đồ bàn...</Text>
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
            Xác nhận đặt bàn
          </Text>
        </View>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eed8b8" }}
          onPress={() => router.push(`/wallet/table-pass?locationId=${locationId}` as any)}
        >
          <Ionicons name="cart-outline" size={22} color="#c07d33" />
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
                    {(location as any)?.location_name || "Cafe Trung Nguyên"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#8c6b53", lineHeight: 16 }} numberOfLines={3}>
                    {(location as any)?.address || "Trung Nguyên E-Coffee, Trần Chiên, Phường Cái Răng, Thành phố Cần Thơ"}
                  </Text>
                </View>
              </View>
            </View>

            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={{ width: 140, height: "100%" }} resizeMode="cover" />
            ) : null}
          </View>

          {/* Section: Lưu ý khi đặt bàn (Accordion Matching Image 3) */}
          <View style={styles.noticeCard}>
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: showNoticeAccordion ? 10 : 0 }}
              onPress={() => setShowNoticeAccordion(!showNoticeAccordion)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="cafe-outline" size={16} color="#c07d33" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#382119" }}>Lưu ý khi đặt bàn</Text>
              </View>
              <Ionicons name={showNoticeAccordion ? "chevron-up" : "chevron-down"} size={18} color="#8c6b53" />
            </Pressable>

            {showNoticeAccordion && (
              <View style={{ gap: 8 }}>
                {[
                  "Bạn có thể chọn một hoặc nhiều bàn còn trống.",
                  "Bàn đã có khách hoặc đã được giữ sẽ không chọn được.",
                  "Nếu đến trễ hơn 1 tiếng, hệ thống có thể tự hủy giữ chỗ.",
                  "Nếu đặt món trước, bạn cần chuyển khoản trước khi gửi owner duyệt.",
                ].map((rule, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <Ionicons name="checkmark" size={12} color="#c07d33" />
                    </View>
                    <Text style={{ fontSize: 12, color: "#6b5344", flex: 1, lineHeight: 17 }}>{rule}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section: Thông tin đặt chỗ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person-outline" size={16} color="#c07d33" />
              </View>
              <Text style={styles.sectionTitle}>Thông tin đặt chỗ</Text>
            </View>

            <View style={{ gap: 12 }}>
              {/* Row 1: Name and Phone */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Họ tên</Text>
                  <View style={styles.inputFieldContainer}>
                    <Ionicons name="person-outline" size={18} color="#8c6b53" />
                    <TextInput
                      value={contactName}
                      onChangeText={setContactName}
                      placeholder="Nhựt Minh"
                      placeholderTextColor="#a8907e"
                      style={styles.inputFieldWithIcon}
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
                      placeholder="0869318428"
                      placeholderTextColor="#a8907e"
                      keyboardType="phone-pad"
                      style={styles.inputFieldWithIcon}
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
                      {checkInDate.split(' ')[0] ?? ''}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8c6b53" />
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Giờ đến</Text>
                  <Pressable onPress={() => setShowTimePicker(true)} style={styles.inputPicker}>
                    <Ionicons name="time-outline" size={18} color="#c07d33" />
                    <Text style={{ color: "#382119", fontWeight: "600", fontSize: 14, flex: 1 }} numberOfLines={1}>
                      {checkInDate.split(' ')[1] ?? '00:00'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8c6b53" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Section: Chọn bàn */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#f8ebd7", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="restaurant-outline" size={16} color="#c07d33" />
                </View>
                <Text style={styles.sectionTitle}>Chọn bàn</Text>
              </View>

              {/* Area Filter Dropdown */}
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
                  onPress={() => setShowAreaDropdown(!showAreaDropdown)}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#1b4332" }}>
                    Khu vực: {areaOptions.find(a => a.value === selectedArea)?.label || "Tất cả"}
                  </Text>
                  <Ionicons name={showAreaDropdown ? "chevron-up" : "chevron-down"} size={14} color="#1b4332" />
                </Pressable>

                {showAreaDropdown && (
                  <View
                    style={{
                      position: "absolute",
                      top: 36,
                      right: 0,
                      backgroundColor: "#ffffff",
                      borderRadius: 12,
                      padding: 8,
                      width: 140,
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
                    {areaOptions.map((area) => {
                      const active = selectedArea === area.value;
                      return (
                        <Pressable
                          key={area.value}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: active ? "#f4fbf7" : "transparent",
                          }}
                          onPress={() => {
                            setSelectedArea(area.value);
                            setShowAreaDropdown(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: active ? "700" : "500", color: active ? "#1b4332" : "#382119" }}>
                            {area.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {tablesLoading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator color="#1b4332" />
                <Text style={{ marginTop: 8, fontSize: 13, color: "#8c6b53" }}>Đang kiểm tra bàn...</Text>
              </View>
            ) : filteredTables.length === 0 ? (
              <Text style={{ fontSize: 13, color: "#8c6b53", padding: 16 }}>Chưa có bàn nào được cấu hình cho khu vực này.</Text>
            ) : (
              <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 4 }}>
                {filteredTables.map((table) => {
                  const tableId = Number(table.table_id);
                  const selected = selectedTableIds.includes(tableId);
                  const disabled = table.status !== "free";

                  return (
                    <Pressable
                      key={table.table_id}
                      style={[
                        styles.tableCardItem,
                        selected && styles.tableCardSelected,
                        disabled && styles.tableCardDisabled,
                      ]}
                      onPress={() => toggleTable(table)}
                      disabled={disabled}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <Ionicons name="restaurant" size={20} color={selected ? "#1b4332" : disabled ? "#94a3b8" : "#c07d33"} />
                        {selected ? (
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#1b4332", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="checkmark" size={12} color="#ffffff" />
                          </View>
                        ) : disabled && table.status === "occupied" ? (
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#64748b", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="close" size={12} color="#ffffff" />
                          </View>
                        ) : disabled && table.status === "reserved" ? (
                          <Ionicons name="time" size={16} color="#d97706" />
                        ) : null}
                      </View>

                      <Text style={{ fontSize: 13, fontWeight: "800", color: disabled ? "#94a3b8" : "#382119" }}>
                        {table.table_name}
                      </Text>
                      <View style={[
                        styles.tableStatusBadge,
                        table.status === "free" ? styles.badgeFree : table.status === "reserved" ? styles.badgeReserved : styles.badgeOccupied
                      ]}>
                        <Text style={styles.badgeText}>
                          {table.status === "free" ? "Trống" : table.status === "reserved" ? "Đang giữ" : "Đã có khách"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Section: Đặt món trước (Toggle Matching Image 3) */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#e8f5ed", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="restaurant-outline" size={20} color="#1b4332" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#382119" }}>
                    Đặt món trước (bắt buộc chuyển khoản)
                  </Text>
                  <Text style={{ fontSize: 11, color: "#8c6b53", marginTop: 2 }}>
                    Chọn món và voucher trước khi sang mã QR thanh toán.
                  </Text>
                </View>
              </View>

              <Switch
                value={preorderEnabled}
                onValueChange={togglePreorder}
                trackColor={{ false: "#cbd5e1", true: "#1b4332" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Menu List when Pre-order is ON */}
            {preorderEnabled && (
              <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: "#f1e5d3", paddingTop: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                  {menuCategories.map((c) => {
                    const active = selectedMenuCategory === c.name;
                    return (
                      <Pressable
                        key={c.name}
                        onPress={() => setSelectedMenuCategory(c.name)}
                        style={[styles.categoryPill, active && styles.categoryPillActive]}
                      >
                        <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                          {c.name} ({c.count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <ScrollView nestedScrollEnabled style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10 }}>
                  {filteredServices.map((service) => {
                    const qty = preorderQtyByServiceId[service.service_id] || 0;
                    const imgUrl = service.images ? (Array.isArray(service.images) ? service.images[0] : (typeof service.images === "string" ? (() => { try { const parsed = JSON.parse(service.images); return Array.isArray(parsed) ? parsed[0] : null; } catch { return null; } })() : null)) : null;
                    const fullImgUrl = imgUrl ? resolveBackendUrl(imgUrl) : null;

                    return (
                      <View key={service.service_id} style={styles.menuCardRow}>
                        <View style={styles.menuImageContainer}>
                          {fullImgUrl ? (
                            <Image source={{ uri: fullImgUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          ) : (
                            <Ionicons name="fast-food-outline" size={24} color="#8c6b53" />
                          )}
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#382119" }}>{service.service_name}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1b4332", marginTop: 2 }}>
                            {formatCurrency(service.price)}
                          </Text>
                        </View>
                        <View style={styles.stepperContainer}>
                          <Pressable
                            style={styles.stepBtn}
                            onPress={() => updatePreorderQuantity(service.service_id, -1)}
                          >
                            <Ionicons name="remove" size={16} color="#382119" />
                          </Pressable>
                          <Text style={styles.stepperValue}>{qty}</Text>
                          <Pressable
                            style={styles.stepBtn}
                            onPress={() => updatePreorderQuantity(service.service_id, 1)}
                          >
                            <Ionicons name="add" size={16} color="#382119" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Vouchers Grouped List */}
                {groupedVouchers.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#382119", marginBottom: 8 }}>Ưu đãi & Voucher địa điểm</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                      {groupedVouchers.map(({ voucher, actualQuantity }) => {
                        const vId = getVoucherId(voucher);
                        const isSelected = selectedVoucherId === vId;
                        const minOrder = asNumber(voucher.min_order_value, 0);
                        const maxDiscount = asNumber(voucher.max_discount_amount, 0);
                        const isEligible = preorderTotal >= minOrder;

                        return (
                          <VoucherStubCard
                            key={vId}
                            voucher={voucher}
                            actualQuantity={actualQuantity}
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
              </View>
            )}
          </View>

          {/* Section: Ghi chú */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="create-outline" size={16} color="#c07d33" />
                <Text style={styles.sectionTitle}>Ghi chú</Text>
              </View>
              <Text style={{ fontSize: 11, color: "#8c6b53" }}>{notes.length}/200</Text>
            </View>

            <TextInput
              value={notes}
              onChangeText={(txt) => setNotes(txt.slice(0, 200))}
              placeholder="Yêu cầu thêm nếu có..."
              placeholderTextColor="#a8907e"
              multiline
              style={styles.textArea}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Footer Bar (Matching Image 3) */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerLeftBox}>
          <Text style={{ fontSize: 11, color: "#a8907e" }} numberOfLines={1}>
            {selectedTableIds.length > 0
              ? tables.filter((t) => selectedTableIds.includes(Number(t.table_id))).map((t) => t.table_name).join(", ")
              : "Chưa chọn bàn"}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#ffffff", marginTop: 2 }}>
            {preorderEnabled
              ? formatCurrency(payableTotal)
              : "---"}
          </Text>
        </View>

        <Pressable
          style={[
            styles.submitButton,
            (!canSubmit || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.submitButtonText}>Xác nhận đặt chỗ</Text>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={14} color="#1b4332" />
              </View>
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
  textArea: {
    backgroundColor: "#fbf6ee",
    borderWidth: 1,
    borderColor: "#eed8b8",
    borderRadius: 10,
    padding: 12,
    height: 70,
    fontSize: 14,
    color: "#382119",
    marginTop: 4,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f8ebd7",
  },
  categoryPillActive: {
    backgroundColor: "#1b4332",
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8c6b53",
  },
  categoryPillTextActive: {
    color: "#ffffff",
  },
  tableCardItem: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#f1e5d3",
  },
  tableCardSelected: {
    borderColor: "#1b4332",
    backgroundColor: "#f4fbf7",
    borderWidth: 2,
  },
  tableCardDisabled: {
    opacity: 0.6,
    backgroundColor: "#fbf6ee",
  },
  tableStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  badgeFree: {
    backgroundColor: "#d1fae5",
  },
  badgeReserved: {
    backgroundColor: "#fef3c7",
  },
  badgeOccupied: {
    backgroundColor: "#ffe4e6",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1b4332",
  },
  menuCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#f1e5d3",
  },
  menuImageContainer: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#f8ebd7",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#382119",
  },
  voucherCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1e5d3",
    marginBottom: 8,
  },
  voucherCardSelected: {
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5",
    borderWidth: 2,
  },
  quantityBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  quantityBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2c1c14",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#382119",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
  },
  footerLeftBox: {
    flex: 1,
    paddingRight: 12,
  },
  submitButton: {
    backgroundColor: "#1b4332",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(27, 67, 50, 0.45)",
    elevation: 0,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});
