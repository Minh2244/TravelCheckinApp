// app/saved-locations.tsx
// Man hinh dia diem da luu: hien thi danh sach yeu thich, xoa khoi danh sach

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axiosClient from '../api/axiosClient';
import { USER_API } from '../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import type { FavoriteLocation } from '../types';

// Ham xu ly URL anh tu backend
const resolveImageUrl = (url: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const base = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';
  return `${base}${url}`;
};

export default function SavedLocationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  // Lay danh sach dia diem yeu thich
  const fetchFavorites = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get(USER_API.FAVORITES);
      setFavorites(res.data.data || []);
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  // Xoa dia diem khoi danh sach yeu thich
  const handleUnfavorite = (locationId: number) => {
    Alert.alert('Xóa khỏi yêu thích', 'Bạn có chắc muốn xóa địa điểm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosClient.delete(`${USER_API.FAVORITES}/${locationId}`);
            setFavorites(prev => prev.filter(item => item.location_id !== locationId));
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa địa điểm này khỏi danh sách yêu thích.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: FavoriteLocation }) => {
    const imageUrl = resolveImageUrl(item.first_image);

    return (
      <Card
        style={styles.card}
        onPress={() => router.push(`/location/${item.location_id}` as any)}
      >
        <View style={styles.cardRow}>
          {/* Anh dia diem */}
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            </View>
          )}

          {/* Thong tin dia diem */}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.location_name}</Text>
            {item.address ? (
              <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            ) : null}

            {/* Rating */}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={styles.ratingText}>{Number(item.avg_rating || 0).toFixed(1)}</Text>
            </View>
          </View>

          {/* Nut xoa yeu thich */}
          <TouchableOpacity
            style={styles.unfavoriteBtn}
            onPress={() => handleUnfavorite(item.location_id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="heart" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Địa điểm đã lưu" />

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => String(item.location_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchFavorites(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-dislike-outline"
              title="Chưa có địa điểm nào"
              description="Hãy nhấn nút lưu hình trái tim ở các trang chi tiết để lưu lại địa điểm bạn yêu thích."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  card: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  imageFallback: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  address: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: fontWeight.semibold,
    marginLeft: 4,
  },
  unfavoriteBtn: {
    padding: spacing.sm,
  },
});
