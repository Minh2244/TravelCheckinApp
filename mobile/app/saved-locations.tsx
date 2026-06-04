import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axiosClient from '../api/axiosClient';

interface LocationItem {
  location_id: number;
  location_name: string;
  address: string;
  province: string;
  rating: number;
  first_image: string | null;
  location_type: string;
}

export default function SavedLocationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<LocationItem[]>([]);

  const fetchFavorites = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await axiosClient.get('/user/favorites');
      setFavorites(res.data.data || []);
    } catch (err) {
      console.log('Error fetching favorites', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleUnfavorite = async (locationId: number) => {
    try {
      await axiosClient.delete(`/user/favorites/${locationId}`);
      setFavorites(prev => prev.filter(item => item.location_id !== locationId));
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể xóa địa điểm này khỏi danh sách yêu thích.');
    }
  };

  const resolveBackendUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${url}`;
  };

  const renderItem = ({ item }: { item: LocationItem }) => {
    const imageUrl = resolveBackendUrl(item.first_image);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardPressable}
          onPress={() => router.push(`/location/${item.location_id}` as any)}
          activeOpacity={0.8}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.fallbackImage}>
              <Ionicons name="image-outline" size={24} color="#94a3b8" />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.location_name}</Text>
            <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            
            <View style={styles.meta}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.ratingText}>{Number(item.rating || 0).toFixed(1)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleUnfavorite(item.location_id)}>
          <Ionicons name="heart" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Địa điểm đã lưu</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#14b8a6" />
          <Text style={styles.loadingText}>Đang tải địa điểm đã lưu...</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.location_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchFavorites(true)} colors={['#14b8a6']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-dislike-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Không có địa điểm nào</Text>
              <Text style={styles.emptySubtitle}>Hãy nhấn nút lưu hình trái tim ở các trang chi tiết để lưu lại địa điểm bạn yêu thích nhé.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  list: { padding: 16, paddingBottom: 50 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  cardPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10 },
  image: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#cbd5e1' },
  fallbackImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12, marginRight: 10 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  address: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 11, color: '#475569', fontWeight: 'bold', marginLeft: 4 },
  deleteBtn: { padding: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 120, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
