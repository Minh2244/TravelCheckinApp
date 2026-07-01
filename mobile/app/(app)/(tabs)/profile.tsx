import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useAuthStore } from "../../../src/modules/auth/store";
import { userApi } from "../../../src/services/user.api";
import { resolveBackendUrl } from "../../../src/lib/url";
import AvatarCropper from "../../../src/components/ui/AvatarCropper";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Avatar states
  const [cropperVisible, setCropperVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const resp = await userApi.getProfile();
      if (resp?.success) {
        setProfile(resp.data);
      }
    } catch (e) {
      console.error("Lỗi lấy thông tin cá nhân:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền truy cập", "Bạn cần cấp quyền truy cập thư viện để đổi ảnh đại diện.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      if (uploadResp?.success) {
        const newAvatarUrl = uploadResp.data.avatar_url;
        // Cập nhật thông tin profile trong state và authStore
        await userApi.updateProfile({
          full_name: profile?.full_name || user?.full_name || "Lữ khách",
          avatar_url: newAvatarUrl,
        });
        await fetchProfile();
        Alert.alert("Thành công", "Đã cập nhật ảnh đại diện mới.");
      } else {
        Alert.alert("Lỗi", uploadResp?.message || "Tải ảnh đại diện thất bại.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện.");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  const stats = profile?.stats;
  const avatarUrl = resolveBackendUrl(profile?.avatar_url) || null;
  const favoriteLocation = stats?.favorite_location;
  const initials = (profile?.full_name || user?.full_name || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 70,
        }}
      >
        {/* Banner Gradient Card */}
        <View className="m-4 rounded-3xl border border-line bg-white overflow-hidden shadow-sm">
          {/* Cover Art */}
          <View className="h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 relative">
            <View className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-white/10 blur-2xl opacity-70" />
            <View className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-pink-400/20 blur-2xl opacity-70" />
          </View>

          {/* Avatar Container */}
          <View className="items-center -mt-14 pb-5 px-5">
            <View className="relative inline-block">
              {saving ? (
                <View className="h-24 w-24 rounded-full bg-slate-100 items-center justify-center border-4 border-white shadow">
                  <ActivityIndicator size="small" color="#a855f7" />
                </View>
              ) : avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="h-24 w-24 rounded-full border-4 border-white bg-slate-100 shadow"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-24 w-24 rounded-full bg-indigo-50 items-center justify-center border-4 border-white shadow">
                  <Text className="text-3xl font-black text-indigo-600">{initials}</Text>
                </View>
              )}
              <Pressable
                onPress={handlePickAvatar}
                className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full shadow border-2 border-white"
              >
                <Ionicons name="camera" size={14} color="white" />
              </Pressable>
            </View>

            <Text className="text-xl font-extrabold text-slate-800 mt-3">
              {profile?.full_name || user?.full_name || "Lữ khách"}
            </Text>
            <Text className="text-xs text-slate-400 font-medium">
              {profile?.email || user?.email}
            </Text>

            {/* Badges */}
            <View className="flex-row gap-2 mt-4 flex-wrap justify-center">
              <View className="bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100/50">
                <Text className="text-[11px] font-semibold text-indigo-600">
                  Huy hiệu: {stats?.member_tier || "Newbie 🌟"}
                </Text>
              </View>
              <View className="bg-slate-100/70 px-3 py-1 rounded-full border border-slate-200/50">
                <Text className="text-[11px] font-semibold text-slate-600">
                  {stats?.checkin_count || 0} Dấu chân check-in
                </Text>
              </View>
            </View>

            {/* Rank progress */}
            <View className="w-full bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 mt-5">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[11px] font-bold text-indigo-900">Tiến trình thăng hạng</Text>
                <Text className="text-[11px] font-bold text-indigo-900">{stats?.checkin_count || 0}/50 check-ins</Text>
              </View>
              <View className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden mb-1">
                <View
                  style={{ width: `${Math.min(100, ((stats?.checkin_count || 0) / 50) * 100)}%` }}
                  className="bg-indigo-500 h-full rounded-full"
                />
              </View>
              <Text className="text-[9px] text-slate-400 font-medium">
                Tích lũy thêm check-in để nâng cấp huy hiệu cao hơn nhé!
              </Text>
            </View>
          </View>
        </View>

        {/* Dashboard Stats */}
        <View className="px-4 flex-row gap-3">
          <View className="flex-1 bg-white rounded-2xl border border-line p-4 shadow-sm">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Đơn Đặt</Text>
            <Text className="text-2xl font-extrabold text-slate-800 mt-1">{stats?.total_orders || 0}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl border border-line p-4 shadow-sm">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Chi Tiêu</Text>
            <Text className="text-base font-extrabold text-teal-600 mt-1" numberOfLines={1}>
              {formatCurrency(stats?.total_spending || 0)}
            </Text>
          </View>
        </View>

        {/* Favorite Location Card */}
        {favoriteLocation ? (
          <View className="m-4 bg-white rounded-2xl border border-line p-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2.5">
              Địa điểm yêu thích nhất
            </Text>
            <View className="flex-row items-center gap-3">
              {favoriteLocation.first_image ? (
                <Image
                  source={{ uri: resolveBackendUrl(favoriteLocation.first_image) || "" }}
                  className="h-14 w-14 rounded-xl"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-14 w-14 rounded-xl bg-teal-50 justify-center items-center border border-teal-100">
                  <Ionicons name="trophy" size={24} color="#0f766e" />
                </View>
              )}
              <View className="flex-1 justify-center">
                <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
                  {favoriteLocation.location_name}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Đã ghé thăm: {favoriteLocation.visit_count || 0} lần • Chi tiêu: {formatCurrency(favoriteLocation.total_amount || 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Submenu List */}
        <View className="mx-4 bg-white rounded-2xl border border-line overflow-hidden shadow-sm">
          {/* Saved locations */}
          <Pressable
            onPress={() => router.push("/saved")}
            className="flex-row items-center justify-between p-4 border-b border-line active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-amber-50 justify-center items-center">
                <Ionicons name="bookmark" size={16} color="#d97706" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Địa điểm đã lưu</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>

          {/* Diaries */}
          <Pressable
            onPress={() => router.push("/profile/diary")}
            className="flex-row items-center justify-between p-4 border-b border-line active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-purple-50 justify-center items-center">
                <Ionicons name="journal" size={16} color="#7c3aed" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Nhật ký hành trình & Check-in</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>

          {/* Vouchers */}
          <Pressable
            onPress={() => router.push("/profile/vouchers")}
            className="flex-row items-center justify-between p-4 border-b border-line active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-rose-50 justify-center items-center">
                <Ionicons name="ticket" size={16} color="#e11d48" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Ví Voucher của tôi</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>

          {/* Reminders */}
          <Pressable
            onPress={() => router.push("/profile/reminders")}
            className="flex-row items-center justify-between p-4 border-b border-line active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-sky-50 justify-center items-center">
                <Ionicons name="alarm" size={16} color="#0284c7" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Nhắc lịch booking</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>

          {/* History */}
          <Pressable
            onPress={() => router.push("/profile/history")}
            className="flex-row items-center justify-between p-4 border-b border-line active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-emerald-50 justify-center items-center">
                <Ionicons name="time" size={16} color="#059669" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Lịch sử giao dịch</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>

          {/* SOS emergency */}
          <Pressable
            onPress={() => router.push("/profile/sos")}
            className="flex-row items-center justify-between p-4 active:bg-slate-50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-red-50 justify-center items-center">
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Cứu hộ SOS khẩn cấp</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </Pressable>
        </View>

        {/* Log out Button */}
        <Pressable
          className="mx-4 mt-6 min-h-[50px] items-center justify-center rounded-2xl bg-red-600 shadow-sm active:bg-red-700"
          onPress={async () => {
            await signOut();
            router.replace("/sign-in");
          }}
        >
          <Text className="text-base font-extrabold text-white">Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      {/* Avatar Cropper Modal */}
      <AvatarCropper
        visible={cropperVisible}
        imageUri={selectedImageUri}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropperVisible(false)}
      />
    </SafeAreaView>
  );
}
