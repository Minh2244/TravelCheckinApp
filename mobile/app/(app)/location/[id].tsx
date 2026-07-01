import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationReviews } from "../../../src/components/location/LocationReviews";
import { resolveBackendUrl } from "../../../src/lib/url";
import { isLocationOpen } from "../../../src/lib/time";
import { useAuthStore } from "../../../src/modules/auth/store";
import { showToast } from "../../../src/modules/ui/toast-store";
import { geoApi } from "../../../src/services/geo.api";
import { locationApi } from "../../../src/services/location.api";
import {
  userApi,
  type LocationVoucher,
} from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";
import { LocationChatModal } from "../../../src/components/chat/LocationChatBubble";

type DetailTab = "overview" | "reviews" | "about";

function locationTypeLabel(value?: string | null) {
  const type = String(value || "").toLowerCase();
  if (type === "restaurant") return "Nhà hàng";
  if (type === "cafe") return "Quán cà phê";
  if (type === "hotel") return "Khách sạn";
  if (type === "resort") return "Khu nghỉ dưỡng";
  if (type === "tourist") return "Điểm du lịch";
  return "Địa điểm";
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
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [value];
  }
}

function openingHoursLabel(
  value: LocationItem["opening_hours"],
  date = new Date(),
) {
  if (!value) {
    return "Chưa cập nhật";
  }

  if (typeof value === "string") {
    try {
      return openingHoursLabel(JSON.parse(value));
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    const dayTokens = [
      ["sun", "sunday", "cn", "0", "7"],
      ["mon", "monday", "t2", "2", "1"],
      ["tue", "tuesday", "t3", "3", "2"],
      ["wed", "wednesday", "t4", "4", "3"],
      ["thu", "thursday", "t5", "5", "4"],
      ["fri", "friday", "t6", "6", "5"],
      ["sat", "saturday", "t7", "7", "6"],
    ][date.getDay()];
    const today = value.find((item) =>
      dayTokens.includes(String(item.day || "").trim().toLowerCase()),
    );
    return today?.open && today?.close
      ? `${today.open} - ${today.close}`
      : "Chưa cập nhật";
  }

  const direct = value as Record<string, unknown>;
  if (typeof direct.open === "string" && typeof direct.close === "string") {
    return `${direct.open} - ${direct.close}`;
  }

  return "Chưa cập nhật";
}

function statusLabel(status: LocationItem["status"]) {
  if (status === "active") return "Đang hoạt động";
  if (status === "pending") return "Đang chờ duyệt";
  return "Tạm ngừng";
}

function voucherDiscountLabel(voucher: LocationVoucher) {
  const value = Number(voucher.discount_value || 0);
  if (voucher.discount_type === "percentage") {
    return `Giảm ${value}%`;
  }
  return `Giảm ${value.toLocaleString("vi-VN")} đ`;
}

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const user = useAuthStore((state) => state.user);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [vouchers, setVouchers] = useState<LocationVoucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [claimingVoucherId, setClaimingVoucherId] = useState<number | null>(null);

  const loadDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [locationResponse, favoriteResponse] =
        await Promise.all([
          locationApi.getLocationById(id),
          user
            ? userApi.getFavorites().catch(() => ({ success: false, data: [] }))
            : Promise.resolve({ success: false, data: [] }),
        ]);

      setLocation(locationResponse.data);
      setIsFavorite(
        (favoriteResponse.data || []).some(
          (item) => Number(item.location_id) === Number(id),
        ),
      );
    } catch {
      showToast("Không thể tải chi tiết địa điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) {
      setVouchers([]);
      return;
    }

    let active = true;
    setVouchersLoading(true);

    userApi
      .getVouchersByLocation(id)
      .then((response) => {
        if (!active) return;
        setVouchers(
          (response.data || []).filter((voucher) => {
            const maxUses = Number(voucher.max_uses_per_user || 0);
            const used = Number(voucher.user_used_count || 0);
            return maxUses <= 0 || used < maxUses;
          }),
        );
      })
      .catch(() => {
        if (active) setVouchers([]);
      })
      .finally(() => {
        if (active) setVouchersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, user]);

  useEffect(() => {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTemperature(null);
      setWeather(null);
      return;
    }

    let active = true;
    setWeatherLoading(true);

    geoApi
      .reverse(latitude, longitude)
      .then((response) => {
        if (!active) return;
        setTemperature(
          Number.isFinite(Number(response.temperature))
            ? Number(response.temperature)
            : null,
        );
        setWeather(response.weather || null);
      })
      .catch(() => {
        if (!active) return;
        setTemperature(null);
        setWeather(null);
      })
      .finally(() => {
        if (active) setWeatherLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location?.latitude, location?.longitude]);

  const gallery = useMemo(() => {
    if (!location) return [];
    const items = normalizeImages(location.images)
      .map((item) => resolveBackendUrl(item))
      .filter((item): item is string => Boolean(item));
    const cover = resolveBackendUrl(location.first_image);
    return cover && !items.includes(cover) ? [cover, ...items] : items;
  }, [location]);

  const toggleFavorite = async () => {
    if (!location || favoriteLoading) return;

    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    setFavoriteLoading(true);

    try {
      await userApi.toggleFavorite(location.location_id, nextValue);
      showToast(nextValue ? "Đã lưu địa điểm" : "Đã bỏ lưu địa điểm");
    } catch {
      setIsFavorite(!nextValue);
      showToast("Không thể cập nhật địa điểm đã lưu");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const shareLocation = async () => {
    if (!location) return;

    try {
      await Share.share({
        title: location.location_name,
        message: `${location.location_name}\n${location.address}\ntravelcheckin://location/${location.location_id}`,
      });
    } catch {
      showToast("Không thể chia sẻ địa điểm lúc này");
    }
  };

  const openDirections = () => {
    if (!location) return;
    router.push({
      pathname: "/(app)/(tabs)/explore",
      params: {
        focusLocationId: String(location.location_id),
        startRoute: "1",
        requestKey: String(Date.now()),
      },
    });
  };

  const claimVoucher = async (voucherId: number) => {
    if (claimingVoucherId) return;

    setClaimingVoucherId(voucherId);
    try {
      await userApi.claimVoucher(voucherId);
      setVouchers((current) =>
        current.map((voucher) =>
          voucher.voucher_id === voucherId
            ? { ...voucher, is_claimed: true }
            : voucher,
        ),
      );
      showToast("Đã lưu voucher vào kho của bạn");
    } catch {
      showToast("Không thể lưu voucher lúc này");
    } finally {
      setClaimingVoucherId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0f766e" size="large" />
        <Text style={styles.loadingText}>Đang tải địa điểm...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Không tìm thấy địa điểm</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadDetail()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const coverUrl = gallery[0] || null;
  const rating = Number(location.rating || 0);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 86 }}
      >
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverFallback]}>
              <Ionicons name="image-outline" size={42} color="#94a3b8" />
            </View>
          )}

          <View style={[styles.headerActions, { top: Math.max(insets.top, 14) }]}>
            <Pressable style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#0f172a" />
            </Pressable>
            <View style={styles.headerRight}>
              <Pressable
                style={styles.iconButton}
                onPress={() => {
                  const type = location?.location_type || "";
                  const target = ["restaurant", "cafe"].includes(type)
                    ? "/wallet/table-pass"
                    : ["hotel", "resort", "homestay"].includes(type)
                      ? "/wallet/room-pass"
                      : ["attraction", "eco_tourism", "tourist"].includes(type)
                        ? "/wallet/tickets"
                        : "/wallet";
                  router.push(target as any);
                }}
              >
                <Ionicons name="cart-outline" size={23} color="#0f172a" />
              </Pressable>
              <Pressable
                style={styles.iconButton}
                onPress={() => void toggleFavorite()}
                disabled={favoriteLoading}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={23}
                  color={isFavorite ? "#dc2626" : "#0f172a"}
                />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => void shareLocation()}>
                <Ionicons name="share-outline" size={23} color="#0f172a" />
              </Pressable>
            </View>
          </View>

          <View style={styles.weatherOverlay}>
            <Ionicons name="partly-sunny-outline" size={21} color="#0369a1" />
            <View>
              <Text style={styles.weatherOverlayTemperature}>
                {weatherLoading
                  ? "..."
                  : temperature != null
                    ? `${Math.round(temperature)}°C`
                    : "--"}
              </Text>
              <Text style={styles.weatherOverlayDescription} numberOfLines={1}>
                {weatherLoading ? "Đang tải" : weather || "Chưa có dữ liệu"}
              </Text>
            </View>
          </View>
          
          {!isLocationOpen(location.opening_hours) && (
            <View style={styles.closedOverlay}>
              <Ionicons name="time-outline" size={20} color="#fff" />
              <Text style={styles.closedOverlayText}>Đang đóng cửa</Text>
            </View>
          )}
        </View>

        <View style={styles.infoPanel}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {locationTypeLabel(location.location_type)}
            </Text>
          </View>
          <Text style={styles.locationTitle}>{location.location_name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#eab308" />
            <Text style={styles.ratingScore}>
              {rating > 0 ? rating.toFixed(1) : "Chưa có"}
            </Text>
            <Text style={styles.reviewCount}>
              ({location.total_reviews || 0} đánh giá)
            </Text>
          </View>

          <View style={styles.quickActions}>
            <Pressable style={styles.quickAction} onPress={openDirections}>
              <Ionicons name="navigate-outline" size={21} color="#0f766e" />
              <Text style={styles.quickActionText}>Chỉ đường</Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => void toggleFavorite()}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={21}
                color={isFavorite ? "#dc2626" : "#0f766e"}
              />
              <Text style={[styles.quickActionText, isFavorite && styles.savedText]}>
                {isFavorite ? "Đã lưu" : "Lưu"}
              </Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => void shareLocation()}>
              <Ionicons name="share-outline" size={21} color="#0f766e" />
              <Text style={styles.quickActionText}>Chia sẻ</Text>
            </Pressable>
          </View>

          <View style={styles.tabHeader}>
            {([
              ["overview", "Tổng quan"],
              ["reviews", "Đánh giá"],
              ["about", "Giới thiệu"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setActiveTab(value)}
                style={[styles.tabButton, activeTab === value && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabText, activeTab === value && styles.tabTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "overview" ? (
            <View style={styles.section}>
              <View style={styles.descriptionBlock}>
                <Text style={styles.descriptionText}>
                  {location.description || "Địa điểm chưa cập nhật phần giới thiệu."}
                </Text>
              </View>

              <DetailInfoRow
                icon="business-outline"
                label="Tên địa điểm"
                value={location.location_name}
              />
              <DetailInfoRow
                icon="location-outline"
                label="Địa chỉ"
                value={location.address}
              />
              <DetailInfoRow
                icon="checkmark-circle-outline"
                label="Trạng thái"
                value={statusLabel(location.status)}
                accent={location.status === "active"}
              />
              <DetailInfoRow
                icon="time-outline"
                label="Thời gian mở cửa - đóng cửa"
                value={openingHoursLabel(location.opening_hours)}
              />
              <DetailInfoRow
                icon="call-outline"
                label="Số điện thoại"
                value={location.phone || "Chưa cập nhật"}
              />
              <DetailInfoRow
                icon="mail-outline"
                label="Email"
                value={location.email || "Chưa cập nhật"}
              />
              <DetailInfoRow
                icon="globe-outline"
                label="Website"
                value={location.website || "Chưa cập nhật"}
              />
              {location.province ? (
                <DetailInfoRow
                  icon="map-outline"
                  label="Tỉnh / Thành phố"
                  value={location.province}
                />
              ) : null}
              {location.is_eco_friendly ? (
                <DetailInfoRow
                  icon="leaf-outline"
                  label="Môi trường"
                  value="Địa điểm thân thiện với môi trường"
                  accent
                />
              ) : null}

              <View style={styles.voucherSection}>
                <View style={styles.voucherHeading}>
                  <View>
                    <Text style={styles.voucherTitle}>Voucher & khuyến mãi</Text>
                    <Text style={styles.voucherSubtitle}>
                      Ưu đãi đang áp dụng tại địa điểm
                    </Text>
                  </View>
                  <Ionicons name="ticket-outline" size={22} color="#e11d48" />
                </View>

                {vouchersLoading ? (
                  <ActivityIndicator color="#e11d48" />
                ) : vouchers.length === 0 ? (
                  <Text style={styles.voucherEmpty}>
                    Chưa có voucher cho địa điểm này.
                  </Text>
                ) : (
                  vouchers.slice(0, 2).map((voucher) => {
                    const claimed = Boolean(voucher.is_claimed);
                    return (
                      <View key={voucher.voucher_id} style={styles.voucherItem}>
                        <View style={styles.voucherCopy}>
                          <Text style={styles.voucherDiscount}>
                            {voucherDiscountLabel(voucher)}
                          </Text>
                          <Text style={styles.voucherName} numberOfLines={2}>
                            {voucher.campaign_description ||
                              voucher.campaign_name ||
                              "Ưu đãi đặc biệt"}
                          </Text>
                        </View>
                        <Pressable
                          style={[
                            styles.voucherButton,
                            claimed && styles.voucherButtonClaimed,
                          ]}
                          disabled={claimed || claimingVoucherId === voucher.voucher_id}
                          onPress={() => void claimVoucher(voucher.voucher_id)}
                        >
                          <Text
                            style={[
                              styles.voucherButtonText,
                              claimed && styles.voucherButtonTextClaimed,
                            ]}
                          >
                            {claimed ? "Đã lưu" : "Lưu"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : null}

          {activeTab === "reviews" ? (
            <LocationReviews
              locationId={id}
              onSubmitted={() =>
                setLocation((current) =>
                  current
                    ? { ...current, total_reviews: Number(current.total_reviews || 0) + 1 }
                    : current,
                )
              }
            />
          ) : null}

          {activeTab === "about" ? (
            <View style={styles.section}>
              <Text style={styles.aboutText}>
                {location.description || "Địa điểm chưa cập nhật phần giới thiệu."}
              </Text>
              {location.website ? (
                <InfoRow icon="globe-outline" text={location.website} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={[
            styles.actionButton,
            !isLocationOpen(location.opening_hours) && styles.actionButtonDisabled
          ]}
          disabled={!isLocationOpen(location.opening_hours)}
          onPress={() => {
            const t = String(location.location_type || "").toLowerCase();
            if (t === "restaurant" || t === "cafe") {
              router.push(`/booking/table/0?locationId=${location.location_id}`);
            } else if (t === "hotel" || t === "resort") {
              router.push(`/booking/hotel/${location.location_id}`);
            } else if (t === "tourist") {
              router.push(`/booking/ticket/all?locationId=${location.location_id}`);
            } else {
              router.push(`/location/${location.location_id}/services`);
            }
          }}
        >
          <Text style={styles.actionButtonText}>
            {(() => {
              const t = String(location.location_type || "").toLowerCase();
              if (t === "restaurant" || t === "cafe") return "Đặt bàn trước";
              if (t === "hotel" || t === "resort") return "Đặt phòng";
              if (t === "tourist") return "Mua vé";
              return "Xem dịch vụ tại địa điểm";
            })()}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.chatBubbles,
          { bottom: Math.max(insets.bottom, 12) + 70 },
        ]}
      >
        <Pressable
          style={[styles.chatBubble, styles.ownerChatBubble]}
          onPress={() => setIsChatOpen(true)}
          accessibilityLabel="Chat với địa điểm"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={23} color="#ffffff" />
        </Pressable>
      </View>

        <LocationChatModal
          locationId={location.location_id}
          userRole="user"
          locationName={location.location_name}
          locationImage={normalizeImages(location.images)[0] || null}
          visible={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </View>
    );
  }

function InfoRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={19} color="#64748b" />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function DetailInfoRow({
  accent = false,
  icon,
  label,
  value,
}: {
  accent?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailInfoRow}>
      <View style={styles.detailInfoIcon}>
        <Ionicons name={icon} size={18} color={accent ? "#0f766e" : "#64748b"} />
      </View>
      <View style={styles.detailInfoContent}>
        <Text style={styles.detailInfoLabel}>{label}</Text>
        <Text style={[styles.detailInfoValue, accent && styles.detailInfoAccent]}>
          {value}
        </Text>
      </View>
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
    gap: 12,
    backgroundColor: "#eef2f3",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 15,
  },
  errorTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 20,
  },
  retryButton: {
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  coverContainer: {
    height: 285,
    width: "100%",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    backgroundColor: "#dbe4ea",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerRight: {
    flexDirection: "row",
    gap: 9,
  },
  weatherOverlay: {
    position: "absolute",
    right: 14,
    bottom: 34,
    minWidth: 112,
    maxWidth: 150,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(186,230,253,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 5,
  },
  weatherOverlayTemperature: {
    color: "#0c4a6e",
    fontSize: 16,
    fontWeight: "800",
  },
  weatherOverlayDescription: {
    maxWidth: 88,
    color: "#0369a1",
    fontSize: 11,
  },
  closedOverlay: {
    position: "absolute",
    left: 14,
    bottom: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 5,
  },
  closedOverlayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  infoPanel: {
    marginTop: -22,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  typeBadgeText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800",
  },
  locationTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
  },
  ratingScore: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 15,
  },
  reviewCount: {
    color: "#64748b",
    fontSize: 13,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  quickAction: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  quickActionText: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "700",
  },
  savedText: {
    color: "#dc2626",
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginTop: 20,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f766e",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0f766e",
  },
  section: {
    gap: 9,
  },
  descriptionBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 5,
  },
  descriptionText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  detailInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  detailInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  detailInfoContent: {
    flex: 1,
  },
  detailInfoLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailInfoValue: {
    marginTop: 3,
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 20,
  },
  detailInfoAccent: {
    color: "#0f766e",
    fontWeight: "700",
  },
  aboutText: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
  },
  voucherSection: {
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffe4e6",
    backgroundColor: "#fff7f8",
  },
  voucherHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voucherTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  voucherSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  voucherEmpty: {
    color: "#64748b",
    fontSize: 13,
  },
  voucherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  voucherCopy: {
    flex: 1,
  },
  voucherDiscount: {
    color: "#be123c",
    fontSize: 15,
    fontWeight: "800",
  },
  voucherName: {
    marginTop: 3,
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },
  voucherButton: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e11d48",
  },
  voucherButtonClaimed: {
    backgroundColor: "#e2e8f0",
  },
  voucherButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  voucherButtonTextClaimed: {
    color: "#64748b",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionButton: {
    height: 48,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  chatBubbles: {
    position: "absolute",
    right: 15,
    gap: 10,
    zIndex: 30,
  },
  chatBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  ownerChatBubble: {
    backgroundColor: "#2563eb",
  },
  aiChatBubble: {
    backgroundColor: "#0f766e",
  },
});
