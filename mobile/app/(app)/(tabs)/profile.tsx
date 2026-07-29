import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AvatarCropper from "../../../src/components/ui/AvatarCropper";
import { resolveBackendUrl } from "../../../src/lib/url";
import { useAuthStore } from "../../../src/modules/auth/store";
import { AppAlert as Alert } from "../../../src/modules/ui/app-alert";
import { userApi } from "../../../src/services/user.api";
import { travelColors, travelShadow } from "../../../src/theme/travel";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fetchProfile = async () => {
    try {
      const resp = await userApi.getProfile();
      if (resp?.success) {
        setProfile(resp.data);
        setFullName(resp.data?.full_name || user?.full_name || "");
        setPhone(resp.data?.phone || "");
        setAddress(resp.data?.address || "");
      }
    } catch (error) {
      console.error("Lỗi lấy thông tin cá nhân:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.user_id) {
      void fetchProfile();
    }
  }, [user?.user_id]);

  const handleSaveProfile = async () => {
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ và tên.");
      return;
    }

    try {
      setSaving(true);
      const resp = await userApi.updateProfile({
        full_name: normalizedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        skip_avatar: true,
      });
      if (!resp?.success) {
        Alert.alert("Lỗi", resp?.message || "Không thể lưu thông tin cá nhân.");
        return;
      }
      await fetchProfile();
      Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân.");
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể lưu thông tin cá nhân.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Quyền truy cập",
        "Bạn cần cấp quyền truy cập thư viện để đổi ảnh đại diện.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImageUri(result.assets[0].uri);
      setCropperVisible(true);
    }
  };

  const handleCropConfirm = async (croppedUri: string) => {
    setCropperVisible(false);
    setSaving(true);

    try {
      const uploadResp = await userApi.uploadAvatar(croppedUri);
      if (!uploadResp?.success) {
        Alert.alert("Lỗi", uploadResp?.message || "Tải ảnh đại diện thất bại.");
        return;
      }

      await userApi.updateProfile({
        full_name: fullName.trim() || profile?.full_name || user?.full_name || "Lữ khách",
        phone: phone.trim() || null,
        address: address.trim() || null,
        skip_avatar: true,
      });
      setSelectedImageUri(null);
      setAvatarVersion(Date.now());
      await fetchProfile();
      Alert.alert("Thành công", "Đã cập nhật ảnh đại diện mới.");
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện.");
    } finally {
      setSaving(false);
    }
  };

  const stats = profile?.stats;
  const rawAvatarUrl = resolveBackendUrl(profile?.avatar_url) || null;
  const avatarUrl = rawAvatarUrl
    ? `${rawAvatarUrl}${rawAvatarUrl.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : null;
  const favoriteLocation = stats?.favorite_location;
  const initials = (fullName || profile?.full_name || user?.full_name || "U").trim().charAt(0).toUpperCase();
  const checkins = Number(stats?.checkin_count || 0);
  const progress = Math.min(100, (checkins / 50) * 100);

  const metrics = useMemo(
    () => [
      {
        label: "Đơn đặt",
        value: String(stats?.total_orders || 0),
        icon: "bag-check-outline" as const,
        tint: travelColors.ink,
      },
      {
        label: "Check-in",
        value: String(checkins),
        icon: "location-outline" as const,
        tint: travelColors.teal,
      },
      {
        label: "Chi tiêu",
        value: formatCurrency(Number(stats?.total_spending || 0)),
        icon: "wallet-outline" as const,
        tint: travelColors.teal,
      },
    ],
    [checkins, stats?.total_orders, stats?.total_spending],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={travelColors.purple} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 16) + 78,
          gap: 14,
        }}
      >
        <View className="overflow-hidden rounded-2xl border border-line bg-white" style={travelShadow}>
          <View className="relative overflow-hidden bg-brand-600 px-4 pb-12 pt-4">
            <View className="absolute inset-0 bg-black/25" />
            <View className="flex-row items-center justify-between">
              <Text className="text-[18px] font-extrabold text-white">Hồ sơ du lịch</Text>
            </View>
            <View className="mt-3 self-start rounded-full bg-white/20 px-3 py-1">
              <Text className="text-[12px] font-extrabold text-white">
                {stats?.member_tier || "Traveler"}
              </Text>
            </View>
          </View>

          <View className="-mt-9 px-4 pb-4">
            <View className="flex-row items-end gap-3">
              <View className="relative">
                <Pressable
                  disabled={!avatarUrl || saving}
                  onPress={() => setAvatarPreviewVisible(true)}
                >
                  {saving ? (
                    <View className="h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-white bg-slate-100">
                      <ActivityIndicator size="small" color={travelColors.purple} />
                    </View>
                  ) : avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      className="h-[78px] w-[78px] rounded-full border-4 border-white bg-slate-100"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-white bg-ai-50">
                      <Text className="text-2xl font-black text-ai-600">{initials}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={handlePickAvatar}
                  className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ai-500"
                >
                  <Ionicons name="camera" size={14} color="#ffffff" />
                </Pressable>
              </View>

              <View className="flex-1 pb-1">
                <Text className="text-[22px] font-extrabold leading-7 text-ink" numberOfLines={1}>
                  {fullName || profile?.full_name || user?.full_name || "Lữ khách"}
                </Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-muted" numberOfLines={1}>
                  {profile?.email || user?.email}
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-xl border border-line bg-surfaceSoft p-3">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[12px] font-extrabold uppercase text-ink">
                  Tiến trình hạng
                </Text>
                <Text className="text-[12px] font-extrabold text-ai-600">
                  {checkins}/50 check-ins
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-slate-200">
                <View
                  className="h-full rounded-full bg-ai-500"
                  style={{ width: `${progress}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row gap-2">
          {metrics.map((item) => (
            <View
              key={item.label}
              className="flex-1 rounded-xl border border-line bg-white px-2.5 py-2.5"
              style={travelShadow}
            >
              <View className="mb-1.5 h-7 w-7 items-center justify-center rounded-full bg-brand-50">
                <Ionicons name={item.icon} size={14} color={item.tint} />
              </View>
              <Text className="text-[10px] font-extrabold uppercase text-muted" numberOfLines={1}>
                {item.label}
              </Text>
              <Text className="mt-0.5 text-[14px] font-black text-ink" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View className="rounded-2xl border border-line bg-white p-4" style={travelShadow}>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[17px] font-extrabold text-ink">Thông tin liên hệ</Text>
            <Ionicons name="create-outline" size={19} color={travelColors.teal} />
          </View>

          <View className="gap-3">
            <View className="gap-1.5">
              <Text className="text-[12px] font-extrabold uppercase text-muted">Họ và tên</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                maxLength={100}
                placeholder="Nhập họ và tên"
                placeholderTextColor="#98a2b3"
                className="min-h-[46px] rounded-xl border border-line bg-surfaceSoft px-3 text-[14px] font-semibold text-ink"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[12px] font-extrabold uppercase text-muted">Email</Text>
              <View className="min-h-[46px] flex-row items-center rounded-xl border border-line bg-surfaceSoft px-3">
                <Text className="flex-1 text-[14px] font-semibold text-muted" numberOfLines={1}>
                  {profile?.email || user?.email || "Chưa cập nhật"}
                </Text>
                <Ionicons name="lock-closed-outline" size={15} color="#98a2b3" />
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-[12px] font-extrabold uppercase text-muted">Số điện thoại</Text>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#98a2b3"
                className="min-h-[46px] rounded-xl border border-line bg-surfaceSoft px-3 text-[14px] font-semibold text-ink"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[12px] font-extrabold uppercase text-muted">Địa chỉ thường trú</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                maxLength={255}
                placeholder="Nhập địa chỉ của bạn"
                placeholderTextColor="#98a2b3"
                className="min-h-[46px] rounded-xl border border-line bg-surfaceSoft px-3 text-[14px] font-semibold text-ink"
              />
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between gap-3 border-t border-line pt-3">
            <View className="flex-1 flex-row gap-4">
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-muted">Đồng hành từ</Text>
                <Text className="mt-0.5 text-[12px] font-extrabold text-ink">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "Chưa có"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-muted">Cập nhật</Text>
                <Text className="mt-0.5 text-[12px] font-extrabold text-ink">
                  {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString("vi-VN") : "Chưa có"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleSaveProfile}
              disabled={saving}
              className="min-h-[42px] min-w-[116px] flex-row items-center justify-center gap-2 rounded-full bg-brand-600 px-4"
            >
              {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
              <Text className="text-[13px] font-extrabold text-white">
                {saving ? "Đang lưu" : "Lưu thay đổi"}
              </Text>
            </Pressable>
          </View>
        </View>

        {favoriteLocation ? (
          <View className="rounded-2xl border border-line bg-white p-3.5" style={travelShadow}>
            <Text className="mb-3 text-[12px] font-extrabold uppercase text-muted">
              Địa điểm yêu thích nhất
            </Text>
            <View className="flex-row items-center gap-3">
              {favoriteLocation.first_image ? (
                <Image
                  source={{ uri: resolveBackendUrl(favoriteLocation.first_image) || "" }}
                  className="h-14 w-14 rounded-xl bg-slate-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
                  <Ionicons name="trophy-outline" size={24} color={travelColors.teal} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-ink" numberOfLines={1}>
                  {favoriteLocation.location_name}
                </Text>
                <Text className="mt-1 text-[12px] font-semibold text-muted" numberOfLines={1}>
                  Đã ghé: {favoriteLocation.visit_count || 0} lần · Chi tiêu:{" "}
                  {formatCurrency(Number(favoriteLocation.total_spent || 0))}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/support")}
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4 active:bg-slate-50"
          style={travelShadow}
        >
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
            <Ionicons name="headset-outline" size={25} color={travelColors.teal} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-ink">Trung tâm hỗ trợ</Text>
            <Text className="mt-1 text-[12px] font-semibold text-muted">
              Câu hỏi thường gặp, hotline và email
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </Pressable>

        <Pressable
          className="min-h-[48px] items-center justify-center rounded-xl bg-red-600 mb-10"
          onPress={async () => {
            await signOut();
            router.replace("/sign-in");
          }}
        >
          <Text className="text-[15px] font-extrabold text-white">Đăng xuất</Text>
        </Pressable>


      </ScrollView>

      <AvatarCropper
        visible={cropperVisible}
        imageUri={selectedImageUri}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropperVisible(false)}
      />
      <Modal visible={avatarPreviewVisible} transparent animationType="fade">
        <Pressable
          className="flex-1 items-center justify-center bg-black/90 px-6"
          onPress={() => setAvatarPreviewVisible(false)}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="h-[320px] w-[320px] rounded-3xl bg-black"
              resizeMode="contain"
            />
          ) : null}
          <Text className="mt-5 text-[13px] font-bold text-white/70">Chạm để đóng</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
