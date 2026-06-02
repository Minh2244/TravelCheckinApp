// Trang hồ sơ cá nhân
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import useAuthStore from '../../src/stores/useAuthStore';
import userApi from '../../src/api/userApi';
import { COLORS, SIZES, FONTS } from '../../src/utils/constants';
import type { User } from '../../src/types';

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Tải profile mới nhất
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userApi.getProfile();
        const profile = response.data;
        setFullName(profile.full_name);
        setPhone(profile.phone || '');
        setAvatarUrl(profile.avatar_url || '');
        setUser(profile);
      } catch {
        // Bỏ qua lỗi
      }
    };
    fetchProfile();
  }, [setUser]);

  // Chọn ảnh avatar
  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const formData = new FormData();
      formData.append('avatar', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as unknown as Blob);

      try {
        setIsSaving(true);
        const response = await userApi.uploadAvatar(formData);
        setAvatarUrl(response.data.avatar_url);
        if (user) {
          setUser({ ...user, avatar_url: response.data.avatar_url });
        }
        Alert.alert('Thành công', 'Đã cập nhật avatar');
      } catch {
        Alert.alert('Lỗi', 'Không thể upload avatar');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Lưu profile
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Lỗi', 'Họ tên không được để trống');
      return;
    }
    if (phone && !/^0\d{9}$/.test(phone)) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ');
      return;
    }

    setIsSaving(true);
    try {
      const response = await userApi.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        skip_avatar: true,
      });
      setUser(response.data);
      setIsEditing(false);
      Alert.alert('Thành công', 'Đã cập nhật hồ sơ');
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ');
    } finally {
      setIsSaving(false);
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={48} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.full_name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Thông tin cá nhân */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
          >
            <Text style={styles.editButton}>
              {isEditing ? 'Lưu' : 'Chỉnh sửa'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Họ tên */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Họ và tên</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nhập họ tên"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.full_name || '-'}</Text>
          )}
        </View>

        {/* Email (không chỉnh sửa) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{user?.email}</Text>
        </View>

        {/* Số điện thoại */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Số điện thoại</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.phone || 'Chưa cập nhật'}</Text>
          )}
        </View>

        {/* Vai trò */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Vai trò</Text>
          <Text style={styles.fieldValue}>
            {user?.role === 'user'
              ? 'Người dùng'
              : user?.role === 'owner'
              ? 'Chủ địa điểm'
              : user?.role}
          </Text>
        </View>

        {/* Trạng thái */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Trạng thái</Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    user?.status === 'active' ? COLORS.success : COLORS.warning,
                },
              ]}
            />
            <Text style={styles.fieldValue}>
              {user?.status === 'active' ? 'Đã kích hoạt' : 'Chờ kích hoạt'}
            </Text>
          </View>
        </View>

        {/* Nút hủy chỉnh sửa */}
        {isEditing && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setIsEditing(false);
              setFullName(user?.full_name || '');
              setPhone(user?.phone || '');
            }}
          >
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nút đăng xuất */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>

      {/* Loading overlay */}
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SIZES.md,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  userName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  editButton: {
    fontSize: FONTS.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: SIZES.lg,
  },
  fieldLabel: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xs,
  },
  fieldValue: {
    fontSize: FONTS.lg,
    color: COLORS.text,
  },
  fieldInput: {
    fontSize: FONTS.lg,
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: SIZES.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SIZES.md,
    marginTop: SIZES.sm,
  },
  cancelButtonText: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    marginTop: SIZES.xl,
    marginBottom: SIZES.xxxl,
    paddingVertical: SIZES.lg,
    marginHorizontal: SIZES.lg,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  logoutText: {
    fontSize: FONTS.lg,
    color: COLORS.error,
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
