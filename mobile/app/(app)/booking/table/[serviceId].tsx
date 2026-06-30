import { AxiosError } from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../../src/lib/url";
import { isLocationOpen } from "../../../../src/lib/time";
import { getErrorMessage } from "../../../../src/lib/error";
import { normalizeImages, pad, toInputDateTime, toLocalISOString } from "../../../../src/lib/booking-utils";
import { useBookingRealtime } from "../../../../src/hooks/useBookingRealtime";
import { useAuthStore } from "../../../../src/modules/auth/store";
import { showToast } from "../../../../src/modules/ui/toast-store";
import { bookingApi } from "../../../../src/services/booking.api";
import { locationApi } from "../../../../src/services/location.api";
import { userApi, type LocationVoucher } from "../../../../src/services/user.api";
import type {
  LocationItem,
  LocationPosArea,
  LocationPosTable,
  LocationServiceItem,
} from "../../../../src/types/location";

type SearchParams = {
  locationId?: string;
};

type MenuCategory = {
  value: string;
  label: string;
  sortOrder: number;
};

function parseInputDate(value: string) {
  const parts = value.trim().split(/[\s/\-:]+/);
  if (parts.length >= 5) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const h = parseInt(parts[3], 10);
    const min = parseInt(parts[4], 10);
    const date = new Date(y, m, d, h, min);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function naturalCompare(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), "vi", {
    numeric: true,
    sensitivity: "base",
  });
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value?: number | string | null) {
  const amount = asNumber(value, 0);
  return `${Math.max(0, Math.round(amount)).toLocaleString("vi-VN")} đ`;
}

function tableStatusLabel(status?: string) {
  if (status === "occupied") return "Có khách";
  if (status === "reserved") return "Đã giữ";
  return "Trống";
}

function getServicePrice(service: LocationServiceItem) {
  return asNumber(service.price, 0);
}

function getMenuCategory(service: LocationServiceItem) {
  return String(
    service.category_name ||
      (service.service_type === "combo" ? "Combo" : "Món ăn"),
  );
}

function isPreorderService(service: LocationServiceItem) {
  const type = String(service.service_type || "").toLowerCase();
  return ["food", "combo", "other"].includes(type) && service.status !== "inactive";
}

function getVoucherId(voucher: LocationVoucher) {
  return Number(voucher.voucher_id);
}

function normalizeLocationIds(value: LocationVoucher["location_ids"]) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
    } catch {
      return value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter(Number.isFinite);
    }
  }
  return [];
}

function voucherAppliesToLocation(voucher: LocationVoucher, locationId: number) {
  const directLocationId = Number(voucher.location_id);
  if (Number.isFinite(directLocationId) && directLocationId > 0) {
    return directLocationId === locationId;
  }

  const locationIds = normalizeLocationIds(voucher.location_ids);
  if (locationIds.length > 0) {
    return locationIds.includes(locationId);
  }

  return true;
}

function voucherAppliesToFood(voucher: LocationVoucher) {
  const serviceType = String(voucher.apply_to_service_type || "all").toLowerCase();
  const locationType = String(voucher.apply_to_location_type || "all").toLowerCase();
  return (
    ["all", "food", "restaurant", "cafe", "table"].includes(serviceType) &&
    ["all", "restaurant", "cafe", "food"].includes(locationType)
  );
}

function voucherStillUsable(voucher: LocationVoucher) {
  const remaining = Number(voucher.remaining);
  if (Number.isFinite(remaining) && remaining <= 0) return false;

  const maxUses = Number(voucher.max_uses_per_user);
  const used = Number(voucher.user_used_count);
  if (Number.isFinite(maxUses) && maxUses > 0 && Number.isFinite(used)) {
    return used < maxUses;
  }

  return true;
}

function calculateVoucherDiscount(voucher: LocationVoucher | null, total: number) {
  if (!voucher || total <= 0) return 0;

  const minOrder = asNumber(voucher.min_order_value, 0);
  if (total < minOrder) return 0;

  const discountValue = asNumber(voucher.discount_value, 0);
  const type = String(voucher.discount_type || "").toLowerCase();
  let discount =
    type === "percent" || type === "percentage"
      ? (total * discountValue) / 100
      : discountValue;

  const maxDiscount = asNumber(voucher.max_discount_amount, 0);
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

  return Math.max(0, Math.min(total, Math.round(discount)));
}

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
    toInputDateTime(new Date()),
  );
  const [contactName, setContactName] = useState(user?.full_name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [preorderEnabled, setPreorderEnabled] = useState(false);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const [preorderQtyByServiceId, setPreorderQtyByServiceId] = useState<
    Record<number, number>
  >({});
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);

  // Socket.IO real-time table conflict detection
  useBookingRealtime(locationId, {
    onTableConflict: (tableId) => {
      setSelectedTableIds((prev) => {
        if (prev.includes(tableId)) {
          showToast("Bàn bạn đang chọn vừa có người đặt trước. Vui lòng chọn bàn khác.");
          return prev.filter((id) => id !== tableId);
        }
        return prev;
      });
    },
    onStatusChanged: (data) => {
      if (data?.type === "table" || data?.type === "pos_updated") {
        // Reload tables silently when status changes
        loadTables().catch(() => {});
      }
    },
  });

  const loadTables = useCallback(async () => {
    if (!Number.isFinite(locationId) || locationId <= 0) return null;
    setTablesLoading(true);
    try {
      const dateToLoad = lastLoadedCheckInRef.current ?? checkInDate;
      const response = await locationApi.getPosTables(locationId, {
        check_in_date: parseInputDate(dateToLoad)?.toISOString(),
      });
      const nextTables = Array.isArray(response.data) ? response.data : [];
      setTables(nextTables);
      return nextTables;
    } catch (error) {
      showToast(getErrorMessage(error));
      return null;
    } finally {
      setTablesLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!Number.isFinite(locationId) || locationId <= 0) {
      setLoading(false);
      showToast("Thiếu địa điểm để đặt bàn.");
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      locationApi.getLocationById(locationId),
      locationApi.getPosAreas(locationId),
      locationApi.getPosTables(locationId, {
        check_in_date: parseInputDate(lastLoadedCheckInRef.current ?? checkInDate)?.toISOString(),
      }),
      locationApi.getServices(locationId),
      userApi.getMySavedVouchers().catch(() => ({ data: [] })),
    ])
      .then(
        ([
          locationResponse,
          areaResponse,
          tableResponse,
          servicesResponse,
          voucherResponse,
        ]) => {
          if (!active) return;
          setLocation(locationResponse.data);
          setAreas(Array.isArray(areaResponse.data) ? areaResponse.data : []);
          setTables(Array.isArray(tableResponse.data) ? tableResponse.data : []);
          setServices(
            Array.isArray(servicesResponse.data) ? servicesResponse.data : [],
          );
          setSavedVouchers(
            Array.isArray(voucherResponse.data)
              ? (voucherResponse.data as LocationVoucher[])
              : [],
          );
        },
      )
      .catch((error) => {
        if (active) showToast(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const areaOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả" },
      ...areas.map((area) => ({
        value: String(area.area_id),
        label: area.area_name,
      })),
    ],
    [areas],
  );

  const filteredTables = useMemo(() => {
    const sorted = [...tables].sort((a, b) =>
      naturalCompare(a.table_name, b.table_name),
    );

    if (selectedArea === "all") return sorted;
    const areaId = Number(selectedArea);
    if (!Number.isFinite(areaId)) return sorted;
    return sorted.filter((table) => Number(table.area_id) === areaId);
  }, [selectedArea, tables]);

  const selectedTables = useMemo(() => {
    const selected = new Set(selectedTableIds);
    return tables.filter((table) => selected.has(Number(table.table_id)));
  }, [selectedTableIds, tables]);

  const menuServices = useMemo(
    () =>
      services
        .filter(isPreorderService)
        .sort((a, b) => {
          const sortA = asNumber(a.category_sort_order, 9999);
          const sortB = asNumber(b.category_sort_order, 9999);
          if (sortA !== sortB) return sortA - sortB;
          const category = naturalCompare(getMenuCategory(a), getMenuCategory(b));
          if (category !== 0) return category;
          return naturalCompare(a.service_name, b.service_name);
        }),
    [services],
  );

  const menuCategories = useMemo<MenuCategory[]>(() => {
    const map = new Map<string, MenuCategory>();
    menuServices.forEach((service) => {
      const label = getMenuCategory(service);
      if (!map.has(label)) {
        map.set(label, {
          value: label,
          label,
          sortOrder: asNumber(service.category_sort_order, 9999),
        });
      }
    });

    return [
      { value: "all", label: "Tất cả", sortOrder: -1 },
      ...Array.from(map.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return naturalCompare(a.label, b.label);
      }),
    ];
  }, [menuServices]);

  const filteredMenuServices = useMemo(() => {
    if (selectedMenuCategory === "all") return menuServices;
    return menuServices.filter(
      (service) => getMenuCategory(service) === selectedMenuCategory,
    );
  }, [menuServices, selectedMenuCategory]);

  const preorderItems = useMemo(
    () =>
      Object.entries(preorderQtyByServiceId)
        .map(([serviceId, quantity]) => ({
          service_id: Number(serviceId),
          quantity: Number(quantity),
        }))
        .filter((item) => Number.isFinite(item.service_id) && item.quantity > 0),
    [preorderQtyByServiceId],
  );

  const preorderTotal = useMemo(() => {
    const serviceById = new Map(
      menuServices.map((service) => [Number(service.service_id), service] as const),
    );
    return preorderItems.reduce((sum, item) => {
      const service = serviceById.get(item.service_id);
      return sum + (service ? getServicePrice(service) * item.quantity : 0);
    }, 0);
  }, [menuServices, preorderItems]);

  const usableVouchers = useMemo(
    () =>
      savedVouchers
        .filter((voucher) => Boolean(voucher.code))
        .filter((voucher) => voucherAppliesToLocation(voucher, locationId))
        .filter(voucherAppliesToFood)
        .filter(voucherStillUsable)
        .filter((voucher) => preorderTotal >= asNumber(voucher.min_order_value, 0)),
    [locationId, preorderTotal, savedVouchers],
  );

  const selectedVoucher = useMemo(
    () =>
      usableVouchers.find((voucher) => getVoucherId(voucher) === selectedVoucherId) ??
      null,
    [selectedVoucherId, usableVouchers],
  );

  const voucherDiscount = useMemo(
    () => calculateVoucherDiscount(selectedVoucher, preorderTotal),
    [preorderTotal, selectedVoucher],
  );

  const payableTotal = Math.max(0, preorderTotal - voucherDiscount);

  useEffect(() => {
    if (
      selectedVoucherId != null &&
      !usableVouchers.some((voucher) => getVoucherId(voucher) === selectedVoucherId)
    ) {
      setSelectedVoucherId(null);
    }
  }, [selectedVoucherId, usableVouchers]);

  const canSubmit =
    selectedTableIds.length > 0 &&
    Boolean(parseInputDate(checkInDate)) &&
    Boolean(contactName.trim()) &&
    Boolean(contactPhone.trim()) &&
    (!preorderEnabled ||
      (selectedTableIds.length === 1 && preorderItems.length > 0)) &&
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
      if (!next) {
        setPreorderQtyByServiceId({});
        setSelectedVoucherId(null);
      }
      return next;
    });
  }

  async function handleSubmit() {
    const checkIn = parseInputDate(checkInDate);

    if (!location || !checkIn) {
      showToast("Bạn kiểm tra lại thông tin đặt bàn nha.");
      return;
    }

    if (preorderEnabled && selectedTableIds.length !== 1) {
      showToast("Đặt món trước chỉ chọn đúng 1 bàn.");
      return;
    }

    if (preorderEnabled && preorderItems.length === 0) {
      showToast("Bạn chọn món trước rồi mới tiếp tục thanh toán nha.");
      return;
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
        preorder_items: preorderEnabled ? preorderItems : undefined,
        reserve_on_confirm: preorderEnabled ? true : undefined,
        voucher_code:
          preorderEnabled && selectedVoucher?.code ? selectedVoucher.code : null,
      });

      // Reset state for both cases so the form is cleared
      setSelectedTableIds([]);
      setPreorderEnabled(false);
      setPreorderQtyByServiceId({});
      setSelectedVoucherId(null);
      setNotes("");
      
      if (preorderEnabled) {
        void loadTables(); // Reload tables in background
        router.push(
          `/booking/payment/${response.data.bookingId}?mode=table&returnTo=back` as never,
        );
        return;
      }

      await loadTables();

      // Show prominent success feedback
      Alert.alert(
        "Đặt bàn thành công! 🎉",
        `Booking #${response.data.bookingId} đã được gửi.\n\nOwner sẽ duyệt yêu cầu đặt bàn của bạn. Bạn sẽ nhận thông báo khi được xác nhận.`,
        [{ text: "OK", onPress: () => {} }],
      );
    } catch (error) {
      // Reload tables and clear conflicted selections
      try {
        const latestTables = await loadTables();
        if (latestTables) {
          setSelectedTableIds((prev) =>
            prev.filter((id) => {
              const t = latestTables.find((tbl) => Number(tbl.table_id) === id);
              return t?.status === "free";
            })
          );
        }
      } catch {}

      // Show user-friendly error
      let msg = getErrorMessage(error);
      if (error instanceof AxiosError && error.response?.status === 409) {
        msg = msg || "Bàn đã có người đặt trước. Vui lòng chọn bàn khác.";
        Alert.alert("Không thể đặt bàn", msg, [{ text: "OK" }]);
      } else {
        showToast(msg || "Có lỗi xảy ra khi đặt bàn.", 5000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải sơ đồ bàn...</Text>
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
          <Text style={styles.eyebrow}>Đặt bàn</Text>
          <Text style={styles.title} numberOfLines={1}>
            {location?.location_name || "Địa điểm ăn uống"}
          </Text>
        </View>
        <Pressable style={styles.cartButton} onPress={() => router.push("/wallet/table-pass")}>
          <Ionicons name="cart-outline" size={24} color="#0f172a" />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 126 },
        ]}
      >
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Lưu ý</Text>
          <Text style={styles.noticeText}>1. Bạn có thể chọn một hoặc nhiều bàn còn trống.</Text>
          <Text style={styles.noticeText}>2. Bàn đã có khách hoặc đã được giữ sẽ không chọn được.</Text>
          <Text style={styles.noticeText}>3. Nếu đến trễ hơn 1 tiếng, hệ thống có thể tự hủy giữ chỗ.</Text>
          <Text style={styles.noticeText}>4. Nếu đặt món trước, bạn cần chuyển khoản trước khi gửi owner duyệt.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Thông tin đặt chỗ</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Thời gian tới <Text style={styles.labelHint}>(DD/MM/YYYY HH:mm)</Text></Text>
            <TextInput
              value={checkInDate}
              onChangeText={setCheckInDate}
              onBlur={() => {
                const parsed = parseInputDate(checkInDate);
                if (!parsed) return;
                const nowFloorMinute = new Date();
                nowFloorMinute.setSeconds(0, 0);
                if (parsed < nowFloorMinute) {
                  Alert.alert(
                    "Thời gian không hợp lệ",
                    "Thời gian tới phải là tương lai, vui lòng chọn lại.",
                    [{ text: "OK" }]
                  );
                  return;
                }
                // Chỉ reload nếu ngày giờ thực sự thay đổi
                if (lastLoadedCheckInRef.current !== checkInDate) {
                  lastLoadedCheckInRef.current = checkInDate;
                  setSelectedTableIds([]);
                  void loadTables();
                }
              }}
              placeholder="VD: 27/06/2026 20:00"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.twoColumns}>
            <View style={[styles.field, styles.flexField]}>
              <Text style={styles.label}>Họ tên</Text>
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder="Tên người đặt"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flexField]}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Số điện thoại"
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.sectionTitle}>Chọn bàn</Text>
              <Text style={styles.helperText}>
                Đã chọn {selectedTableIds.length} bàn
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.areaList}
          >
            {areaOptions.map((area) => {
              const active = selectedArea === area.value;
              return (
                <Pressable
                  key={area.value}
                  style={[styles.areaChip, active && styles.areaChipActive]}
                  onPress={() => setSelectedArea(area.value)}
                >
                  <Text style={[styles.areaText, active && styles.areaTextActive]}>
                    {area.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {tablesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#0f766e" />
              <Text style={styles.loadingText}>Đang kiểm tra bàn...</Text>
            </View>
          ) : filteredTables.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Chưa có bàn</Text>
              <Text style={styles.emptyText}>
                Owner chưa cấu hình bàn cho khu này.
              </Text>
            </View>
          ) : (
            <View style={styles.tableListContainer}>
              <ScrollView nestedScrollEnabled contentContainerStyle={styles.tableGrid}>
                {filteredTables.map((table) => {
                  const tableId = Number(table.table_id);
                  const selected = selectedTableIds.includes(tableId);
                  const disabled = table.status !== "free";

                  return (
                    <Pressable
                      key={table.table_id}
                      style={[
                        styles.tableItem,
                        selected && styles.tableItemSelected,
                        disabled && styles.tableItemDisabled,
                      ]}
                      onPress={() => toggleTable(table)}
                    >
                      <Text
                        style={[
                          styles.tableName,
                          disabled && styles.tableNameDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {table.table_name}
                      </Text>
                      <Text
                        style={[
                          styles.statusBadge,
                          table.status === "free" && styles.statusFree,
                          table.status === "reserved" && styles.statusReserved,
                          table.status === "occupied" && styles.statusOccupied,
                        ]}
                      >
                        {selected ? "Đã chọn" : tableStatusLabel(table.status)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Pressable style={styles.preorderToggle} onPress={togglePreorder}>
            <View style={[styles.checkbox, preorderEnabled && styles.checkboxActive]}>
              {preorderEnabled ? (
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              ) : null}
            </View>
            <View style={styles.preorderToggleText}>
              <Text style={styles.preorderTitle}>
                Đặt món trước (bắt buộc chuyển khoản)
              </Text>
              <Text style={styles.helperText}>
                Chọn món và voucher trước khi sang mã QR thanh toán.
              </Text>
            </View>
          </Pressable>
        </View>

        {preorderEnabled ? (
          <View style={styles.formCard}>
            <View style={styles.tableHeader}>
              <View>
                <Text style={styles.sectionTitle}>Món đặt trước</Text>
                <Text style={styles.helperText}>
                  Chỉ áp dụng khi chọn đúng 1 bàn
                </Text>
              </View>
              <Text style={styles.countPill}>{preorderItems.length}</Text>
            </View>

            {menuCategories.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.areaList}
              >
                {menuCategories.map((category) => {
                  const active = selectedMenuCategory === category.value;
                  return (
                    <Pressable
                      key={category.value}
                      style={[styles.areaChip, active && styles.areaChipActive]}
                      onPress={() => setSelectedMenuCategory(category.value)}
                    >
                      <Text
                        style={[styles.areaText, active && styles.areaTextActive]}
                      >
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {filteredMenuServices.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Chưa có món</Text>
                <Text style={styles.emptyText}>
                  Owner chưa cấu hình menu cho đặt trước.
                </Text>
              </View>
            ) : (
            <View style={styles.menuListContainer}>
              <ScrollView nestedScrollEnabled contentContainerStyle={styles.menuList}>
                {filteredMenuServices.map((service) => {
                  const serviceId = Number(service.service_id);
                  const quantity = preorderQtyByServiceId[serviceId] || 0;
                  const images = normalizeImages(service.images);
                  const coverUrl = images.length > 0 ? resolveBackendUrl(images[0]) : null;
                  return (
                    <View key={service.service_id} style={styles.menuItem}>
                      <View style={styles.menuItemImageContainer}>
                        {coverUrl ? (
                          <Image source={{ uri: coverUrl }} style={styles.menuItemImage} />
                        ) : (
                          <Ionicons name="fast-food-outline" size={24} color="#94a3b8" />
                        )}
                      </View>
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuName} numberOfLines={2}>
                          {service.service_name}
                        </Text>
                        <Text style={styles.menuMeta}>
                          {getMenuCategory(service)} • {formatCurrency(service.price)}
                        </Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() => updatePreorderQuantity(serviceId, -1)}
                        >
                          <Ionicons name="remove" size={17} color="#0f766e" />
                        </Pressable>
                        <Text style={styles.qtyText}>{quantity}</Text>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() => updatePreorderQuantity(serviceId, 1)}
                        >
                          <Ionicons name="add" size={17} color="#0f766e" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
            )}

            <View style={styles.divider} />
            <Text style={styles.label}>Voucher</Text>
            <View style={styles.voucherList}>
              <Pressable
                style={[
                  styles.voucherItem,
                  selectedVoucherId == null && styles.voucherItemActive,
                ]}
                onPress={() => setSelectedVoucherId(null)}
              >
                <Text style={styles.voucherTitle}>Không dùng voucher</Text>
              </Pressable>
              {usableVouchers.map((voucher) => {
                const active = selectedVoucherId === getVoucherId(voucher);
                return (
                  <Pressable
                    key={voucher.voucher_id}
                    style={[styles.voucherItem, active && styles.voucherItemActive]}
                    onPress={() => setSelectedVoucherId(getVoucherId(voucher))}
                  >
                    <Text style={styles.voucherTitle}>
                      {voucher.campaign_name || voucher.code || "Voucher"}
                    </Text>
                    <Text style={styles.voucherMeta}>
                      Giảm {String(voucher.discount_type).includes("percent")
                        ? `${voucher.discount_value}%`
                        : formatCurrency(voucher.discount_value)}
                      {voucher.code ? ` • ${voucher.code}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryBox}>
              <SummaryRow label="Tạm tính" value={formatCurrency(preorderTotal)} />
              <SummaryRow label="Voucher" value={`-${formatCurrency(voucherDiscount)}`} />
              <SummaryRow
                label="Cần chuyển khoản"
                value={formatCurrency(payableTotal)}
                strong
              />
            </View>
          </View>
        ) : null}

        <View style={styles.formCard}>
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerInfo}>
          <Text style={styles.totalLabel}>
            {preorderEnabled ? "Thanh toán trước" : "Bàn đã chọn"}
          </Text>
          <Text style={styles.totalValue} numberOfLines={2}>
            {preorderEnabled
              ? formatCurrency(payableTotal)
              : selectedTables.length > 0
                ? selectedTables.map((table) => table.table_name).join(", ")
                : "Chưa chọn"}
          </Text>
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            submitting && styles.disabledButton,
          ]}
          onPress={() => {
            if (submitting) return;
            if (selectedTableIds.length === 0) {
              showToast("Bạn chọn ít nhất 1 bàn trước nha.");
              return;
            }
            if (!parseInputDate(checkInDate)) {
              showToast("Thời gian chưa đúng định dạng DD/MM/YYYY HH:mm.");
              return;
            }
            const parsedCheckIn = parseInputDate(checkInDate);
            const nowFloorMinute = new Date();
            nowFloorMinute.setSeconds(0, 0);
            if (parsedCheckIn && parsedCheckIn < nowFloorMinute) {
              Alert.alert(
                "Thời gian không hợp lệ",
                "Thời gian tới phải là tương lai, vui lòng chọn lại!",
                [{ text: "OK" }]
              );
              return;
            }
            if (!contactName.trim()) {
              showToast("Bạn điền tên liên hệ trước nha.");
              return;
            }
            if (!contactPhone.trim()) {
              showToast("Bạn điền số điện thoại liên hệ trước nha.");
              return;
            }
            if (preorderEnabled && selectedTableIds.length !== 1) {
              showToast("Đặt món trước chỉ áp dụng cho đúng 1 bàn.");
              return;
            }
            if (preorderEnabled && preorderItems.length === 0) {
              showToast("Bạn chọn ít nhất 1 món trước khi tiếp tục thanh toán nha.");
              return;
            }
            handleSubmit();
          }}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting
              ? "Đang gửi..."
              : preorderEnabled
                ? "Tiếp tục thanh toán"
                : "Xác nhận đặt chỗ"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>
        {value}
      </Text>
    </View>
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
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 14,
    gap: 6,
  },
  noticeTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  noticeText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
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
  flexField: {
    flex: 1,
  },
  twoColumns: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  labelHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "400",
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
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    padding: 16,
    gap: 12,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helperText: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  reloadButton: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  reloadText: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  areaList: {
    gap: 8,
    paddingRight: 6,
  },
  areaChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  areaChipActive: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  areaText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  areaTextActive: {
    color: "#ffffff",
  },
  inlineLoading: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tableListContainer: {
    height: 330,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },
  tableGrid: {
    padding: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tableItem: {
    width: "47.8%",
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    backgroundColor: "#ffffff",
    padding: 12,
    justifyContent: "space-between",
  },
  tableItemSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
  },
  tableItemDisabled: {
    backgroundColor: "#f8fafc",
  },
  tableName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  tableNameDisabled: {
    color: "#94a3b8",
  },
  statusBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "900",
  },
  statusFree: {
    color: "#047857",
    backgroundColor: "#d1fae5",
  },
  statusReserved: {
    color: "#b45309",
    backgroundColor: "#fef3c7",
  },
  statusOccupied: {
    color: "#be123c",
    backgroundColor: "#ffe4e6",
  },
  emptyState: {
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },
  preorderToggle: {
    marginTop: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxActive: {
    backgroundColor: "#0f766e",
  },
  preorderToggleText: {
    flex: 1,
  },
  preorderTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  countPill: {
    minWidth: 34,
    overflow: "hidden",
    borderRadius: 17,
    backgroundColor: "#ccfbf1",
    color: "#0f766e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: "center",
    fontWeight: "900",
  },
  menuListContainer: {
    height: 350,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },
  menuList: {
    padding: 8,
    gap: 10,
  },
  menuItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  menuInfo: {
    flex: 1,
  },
  menuName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  menuMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 20,
    textAlign: "center",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  voucherList: {
    gap: 8,
  },
  voucherItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  voucherItemActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
  },
  voucherTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  voucherMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  summaryBox: {
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
  },
  summaryStrong: {
    color: "#0f766e",
    fontSize: 15,
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
    gap: 12,
  },
  footerInfo: {
    flex: 1,
  },
  totalLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  primaryButton: {
    minWidth: 158,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});
 
