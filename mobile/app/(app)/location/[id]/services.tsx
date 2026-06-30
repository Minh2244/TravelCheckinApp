import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../../src/lib/url";
import { showToast } from "../../../../src/modules/ui/toast-store";
import { locationApi } from "../../../../src/services/location.api";
import type {
  LocationItem,
  LocationServiceItem,
} from "../../../../src/types/location";

function formatCurrency(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "Liên hệ";
  }
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

function serviceTypeLabel(value?: string | null) {
  const type = String(value || "").toLowerCase();
  if (type === "room") return "Phòng lưu trú";
  if (type === "table") return "Đặt bàn";
  if (type === "ticket") return "Vé tham quan";
  if (type === "food") return "Món ăn";
  if (type === "combo") return "Combo";
  return "Dịch vụ";
}

function normalizeImages(value?: string[] | string | null) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [value];
  }
}

function getServiceImage(service: LocationServiceItem) {
  const first = normalizeImages(service.images)[0];
  return resolveBackendUrl(first);
}

export default function LocationServicesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<LocationItem | null>(null);
  const [services, setServices] = useState<LocationServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isFoodLocation =
    location?.location_type === "restaurant" || location?.location_type === "cafe";
  const visibleServices = useMemo(
    () =>
      isFoodLocation
        ? services.filter(
            (service) =>
              String(service.service_type || "").toLowerCase() !== "table",
          )
        : services,
    [isFoodLocation, services],
  );

  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([
      locationApi.getLocationById(id),
      locationApi.getServices(id),
    ])
      .then(([locationResponse, serviceResponse]) => {
        if (!active) return;
        setLocation(locationResponse.data);
        setServices(serviceResponse.data || []);
      })
      .catch(() => {
        if (active) {
          showToast("Không thể tải danh sách dịch vụ");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const groups = useMemo(() => {
    const result = new Map<string, LocationServiceItem[]>();
    visibleServices.forEach((service) => {
      const label = serviceTypeLabel(service.service_type);
      result.set(label, [...(result.get(label) || []), service]);
    });
    return Array.from(result.entries());
  }, [visibleServices]);

  function handleServicePress(service: LocationServiceItem) {
    const type = String(service.service_type || "").toLowerCase();
    const query = `locationId=${id}`;

    if (type === "ticket") {
      router.push(`/booking/ticket/${service.service_id}?${query}`);
      return;
    }

    if (type === "table") {
      router.push(`/booking/table/0?${query}`);
      return;
    }

    if (type === "room") {
      router.push(`/booking/room/${service.service_id}?${query}`);
      return;
    }

    showToast("Món ăn và combo sẽ được gắn vào luồng đặt trước ở bước tiếp theo.");
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải dịch vụ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Dịch vụ tại địa điểm</Text>
          <Text style={styles.title} numberOfLines={1}>
            {location?.location_name || "Địa điểm"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 16 },
        ]}
      >
        {isFoodLocation ? (
          <Pressable
            style={styles.tableBookingCard}
            onPress={() => router.push(`/booking/table/0?locationId=${id}`)}
          >
            <View style={styles.tableBookingIcon}>
              <Ionicons name="restaurant-outline" size={24} color="#0f766e" />
            </View>
            <View style={styles.tableBookingText}>
              <Text style={styles.tableBookingTitle}>Đặt bàn</Text>
              <Text style={styles.tableBookingDescription}>
                Chọn khu và bàn từ sơ đồ vận hành của địa điểm.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        ) : null}

        {visibleServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={34} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Chưa có dịch vụ</Text>
            <Text style={styles.emptyText}>
              Owner chưa công bố dịch vụ cho địa điểm này.
            </Text>
          </View>
        ) : (
          groups.map(([label, items]) => (
            <View key={label} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{label}</Text>
                <Text style={styles.groupCount}>{items.length}</Text>
              </View>

              {label === "Vé tham quan" ? (
                <Pressable
                  style={styles.serviceCard}
                  onPress={() => router.push(`/booking/ticket/all?locationId=${id}`)}
                >
                  <View style={[styles.serviceImage, styles.imageFallback]}>
                    <Ionicons name="ticket" size={26} color="#0f766e" />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>Mua vé tham quan</Text>
                    <Text style={styles.serviceDescription}>
                      Bao gồm {items.length} loại vé (Người lớn, trẻ em...). Chọn ngày và số lượng.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </Pressable>
              ) : (
                items.map((service) => {
                  const imageUrl = getServiceImage(service);
                  return (
                    <Pressable
                      key={service.service_id}
                      style={styles.serviceCard}
                      onPress={() => handleServicePress(service)}
                    >
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.serviceImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.serviceImage, styles.imageFallback]}>
                          <Ionicons name="image-outline" size={22} color="#94a3b8" />
                        </View>
                      )}

                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName} numberOfLines={1}>
                          {service.service_name}
                        </Text>
                        <Text style={styles.serviceDescription} numberOfLines={2}>
                          {service.description || serviceTypeLabel(service.service_type)}
                        </Text>
                        <Text style={styles.servicePrice}>
                          {formatCurrency(service.price)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </Pressable>
                  );
                })
              )}
            </View>
          ))
        )}
      </ScrollView>
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
    fontWeight: "600",
  },
  title: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    padding: 14,
    gap: 20,
  },
  tableBookingCard: {
    minHeight: 96,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tableBookingIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  tableBookingText: {
    flex: 1,
  },
  tableBookingTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  tableBookingDescription: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  group: {
    gap: 9,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  groupCount: {
    minWidth: 26,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ccfbf1",
    color: "#0f766e",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  serviceCard: {
    minHeight: 96,
    padding: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ea",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  serviceImage: {
    width: 72,
    height: 72,
    borderRadius: 7,
    backgroundColor: "#f1f5f9",
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  serviceDescription: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  servicePrice: {
    marginTop: 6,
    color: "#0f766e",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyState: {
    marginTop: 80,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    marginTop: 12,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
