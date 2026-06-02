// Trang địa điểm đã lưu
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi from '../../src/api/userApi';
import { COLORS, SIZES, FONTS } from '../../src/utils/constants';
import type { FavoriteLocation } from '../../src/types';

export default function SavedScreen() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Tải danh sách đã lưu
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await userApi.getFavorites();
      setFavorites(Array.isArray(response.data) ? response.data : []);
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Bỏ lưu địa điểm
  const handleRemove = async (locationId: number) => {
    Alert.alert('Xác nhận', 'Bạn có muốn bỏ lưu địa điểm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ lưu',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(locationId);
          try {
            await userApi.removeFavorite(locationId);
            setFavorites((prev) =>
              prev.filter((f) => f.location_id !== locationId)
            );
          } catch {
            Alert.alert('Lỗi', 'Không thể bỏ lưu. Vui lòng thử lại.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  // Render mỗi item
  const renderItem = ({ item }: { item: FavoriteLocation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/location/${item.location_id}`)}
    >
      {item.first_image ? (
        <Image source={{ uri: item.first_image }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Ionicons name="image-outline" size={32} color={COLORS.textLight} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.location_name}
        </Text>
        <Text style={styles.cardAddress} numberOfLines={1}>
          {item.address}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={COLORS.secondary} />
            <Text style={styles.ratingText}>
              {item.rating > 0 ? item.rating.toFixed(1) : 'Mới'}
            </Text>
          </View>
          <Text style={styles.cardType}>{item.location_type}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(item.location_id)}
        disabled={removingId === item.location_id}
      >
        {removingId === item.location_id ? (
          <ActivityIndicator size="small" color={COLORS.error} />
        ) : (
          <Ionicons name="heart" size={24} color={COLORS.error} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header count */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {favorites.length} địa điểm đã lưu
        </Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>Chưa có địa điểm nào được lưu</Text>
          <Text style={styles.emptySubtext}>
            Nhấn biểu tượng trái tim để lưu địa điểm yêu thích
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.location_id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  header: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerText: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  list: {
    padding: SIZES.lg,
    gap: SIZES.md,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardImage: {
    width: 100,
    height: 100,
  },
  cardImageFallback: {
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    padding: SIZES.md,
  },
  cardTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  cardAddress: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  cardType: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
    textTransform: 'capitalize',
  },
  removeButton: {
    padding: SIZES.md,
  },
  emptyText: {
    fontSize: FONTS.lg,
    color: COLORS.textSecondary,
    marginTop: SIZES.lg,
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.sm,
  },
});
