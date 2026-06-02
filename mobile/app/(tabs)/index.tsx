// Trang chủ - Dashboard
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../src/stores/useAuthStore';
import userApi from '../../src/api/userApi';
import locationApi from '../../src/api/locationApi';
import { COLORS, SIZES, FONTS, LOCATION_TYPES } from '../../src/utils/constants';
import type { Location } from '../../src/types';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  // Lấy lời chào theo thời gian
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  // Tải dữ liệu
  const fetchData = useCallback(async () => {
    try {
      const [locationsRes, favoritesRes] = await Promise.all([
        locationApi.getLocations({ source: 'mobile', type: selectedType }),
        userApi.getFavorites().catch(() => ({ data: [] })),
      ]);

      setLocations(locationsRes.data.locations || []);
      setFavorites(
        (Array.isArray(favoritesRes.data) ? favoritesRes.data : []).map(
          (f: { location_id: number }) => f.location_id
        )
      );
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Quick actions
  const quickActions = [
    { icon: 'map', label: 'Bản đồ', onPress: () => router.push('/(tabs)/map') },
    { icon: 'heart', label: 'Đã lưu', onPress: () => router.push('/(tabs)/saved') },
    { icon: 'ticket', label: 'Vouchers', onPress: () => router.push('/(tabs)/vouchers') },
    { icon: 'person', label: 'Cá nhân', onPress: () => router.push('/(tabs)/profile') },
  ];

  // Render location card
  const renderLocationCard = ({ item }: { item: Location }) => {
    const isFavorite = favorites.includes(item.location_id);

    return (
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => router.push(`/location/${item.location_id}`)}
      >
        {item.first_image ? (
          <Image source={{ uri: item.first_image }} style={styles.locationImage} />
        ) : (
          <View style={[styles.locationImage, styles.locationImageFallback]}>
            <Ionicons name="image-outline" size={32} color={COLORS.textLight} />
          </View>
        )}
        <View style={styles.locationInfo}>
          <Text style={styles.locationName} numberOfLines={1}>
            {item.location_name}
          </Text>
          <Text style={styles.locationAddress} numberOfLines={1}>
            {item.address}
          </Text>
          <View style={styles.locationMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={COLORS.secondary} />
              <Text style={styles.ratingText}>
                {item.rating > 0 ? item.rating.toFixed(1) : 'Mới'}
              </Text>
            </View>
            {isFavorite && (
              <Ionicons name="heart" size={14} color={COLORS.error} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.userName}>{user?.full_name || 'Khách'}</Text>
        </View>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={24} color={COLORS.primary} />
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickActionButton}
            onPress={action.onPress}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter theo loại */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(LOCATION_TYPES).map(([key, { label, value }]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                selectedType === value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === value && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Danh sách địa điểm */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Khám phá địa điểm</Text>
        {isLoading ? (
          <Text style={styles.loadingText}>Đang tải...</Text>
        ) : locations.length === 0 ? (
          <Text style={styles.emptyText}>Không có địa điểm nào</Text>
        ) : (
          <FlatList
            data={locations}
            renderItem={renderLocationCard}
            keyExtractor={(item) => item.location_id.toString()}
            scrollEnabled={false}
            numColumns={2}
            columnWrapperStyle={styles.locationGrid}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxxl + SIZES.xl,
    paddingBottom: SIZES.lg,
    backgroundColor: COLORS.surface,
  },
  greeting: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SIZES.lg,
    paddingHorizontal: SIZES.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SIZES.md,
  },
  quickActionButton: {
    alignItems: 'center',
    gap: SIZES.xs,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
  },
  filterSection: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  filterChip: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    marginRight: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.xxxl,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  loadingText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SIZES.xl,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    paddingVertical: SIZES.xl,
  },
  locationGrid: {
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
  },
  locationCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginBottom: SIZES.md,
  },
  locationImage: {
    width: '100%',
    height: 120,
  },
  locationImageFallback: {
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    padding: SIZES.md,
  },
  locationName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  locationAddress: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  locationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
  },
});
