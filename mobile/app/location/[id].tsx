import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../api/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

interface ServiceData {
  service_id: number;
  service_name: string;
  service_type: 'room' | 'table' | 'ticket' | 'food' | 'combo' | 'other';
  price: number | string;
  description?: string;
}

interface ReviewData {
  review_id: number;
  rating: number;
  comment: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  images?: string | string[];
}

interface VoucherData {
  voucher_id: number;
  code: string;
  discount_value: number;
  discount_type: 'percentage' | 'fixed';
  min_order_value: number;
  remaining: number;
}

interface LocationDetail {
  location_id: number;
  location_name: string;
  location_type: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  total_reviews: number;
  description: string | null;
  first_image: string | null;
  images: string | string[];
  opening_hours: string | null;
  phone: string | null;
  email: string | null;
}

type TabType = 'overview' | 'services' | 'reviews';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Data States
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [weather, setWeather] = useState<{ temp: number | null; desc: string | null }>({ temp: null, desc: null });

  // Add Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Helper dịch loại địa điểm
  const typeLabelVi = (type?: string) => {
    if (!type) return 'Địa điểm';
    const map: Record<string, string> = {
      hotel: 'Khách sạn',
      resort: 'Resort',
      restaurant: 'Nhà hàng',
      cafe: 'Cà phê',
      tourist: 'Du lịch',
    };
    return map[type.toLowerCase()] || 'Địa điểm';
  };

  const resolveBackendUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${url}`;
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Load weather based on coordinates
  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
      const res = await fetch(url);
      const json = await res.json();
      const t = json?.current?.temperature_2m;
      const code = json?.current?.weather_code;

      const weatherCodeText = (c: number): string => {
        if (c === 0) return 'Trời quang';
        if (c === 1 || c === 2) return 'Ít mây';
        if (c === 3) return 'Nhiều mây';
        if (c === 61 || c === 63 || c === 65) return 'Mưa';
        if (c === 95) return 'Dông';
        return 'Thời tiết tốt';
      };

      setWeather({
        temp: t != null ? Math.round(t) : null,
        desc: code != null ? weatherCodeText(code) : null,
      });
    } catch (e) {
      console.log('Error fetching weather in detail', e);
    }
  };

  const fetchDetailData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [detailRes, serviceRes, reviewRes, voucherRes, favRes] = await Promise.all([
        axiosClient.get(`/locations/${id}`),
        axiosClient.get(`/locations/${id}/services`),
        axiosClient.get(`/locations/${id}/reviews`),
        axiosClient.get(`/user/vouchers/location/${id}`).catch(() => ({ data: { data: [] } })),
        axiosClient.get('/user/favorites').catch(() => ({ data: { data: [] } })),
      ]);

      const loc = detailRes.data.data;
      setLocation(loc);
      setServices(serviceRes.data.data || []);
      setReviews(reviewRes.data.data || []);
      setVouchers(voucherRes.data.data || []);
      
      // Kiểm tra xem đã yêu thích chưa
      const favList = favRes.data.data || [];
      const faved = favList.some((item: any) => Number(item.location_id) === Number(id));
      setIsFavorited(faved);

      if (loc?.latitude && loc?.longitude) {
        fetchWeather(Number(loc.latitude), Number(loc.longitude));
      }
    } catch (error) {
      console.log('Error fetching location detail', error);
      Alert.alert('Lỗi', 'Không thể tải chi tiết địa điểm.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetailData();
  }, [fetchDetailData]);

  // Toggle favorite
  const handleToggleFavorite = async () => {
    try {
      if (isFavorited) {
        await axiosClient.delete(`/user/favorites/${id}`);
        setIsFavorited(false);
      } else {
        await axiosClient.patch(`/user/favorites/${id}`, { note: '', tags: '' });
        setIsFavorited(true);
      }
    } catch (error) {
      console.log('Toggle favorite failed', error);
      Alert.alert('Thất bại', 'Không thể cập nhật danh sách yêu thích.');
    }
  };

  // Claim voucher
  const handleClaimVoucher = async (voucherId: number) => {
    try {
      const res = await axiosClient.post(`/user/vouchers/${voucherId}/claim`);
      if (res.data && res.data.success) {
        Alert.alert('Thành công', 'Đã lưu voucher vào ví của bạn.');
        // Refresh vouchers list
        const voucherRes = await axiosClient.get(`/user/vouchers/location/${id}`);
        setVouchers(voucherRes.data.data || []);
      }
    } catch (err: any) {
      Alert.alert('Lưu thất bại', err.response?.data?.message || 'Không thể lưu voucher.');
    }
  };

  // Submit review
  const handleSubmitReview = async () => {
    if (!comment.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung đánh giá của bạn.');
      return;
    }
    try {
      setSubmittingReview(true);
      const res = await axiosClient.post('/user/reviews', {
        location_id: Number(id),
        rating: rating,
        comment: comment.trim(),
        images: [],
      });

      if (res.data && res.data.success) {
        Alert.alert('Thành công', 'Đánh giá của bạn đã được gửi.');
        setComment('');
        // Reload reviews list
        const reviewRes = await axiosClient.get(`/locations/${id}/reviews`);
        setReviews(reviewRes.data.data || []);
      }
    } catch (err: any) {
      Alert.alert('Thất bại', err.response?.data?.message || 'Không thể gửi đánh giá.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Chỉ đường (điều hướng sang tab Bản đồ)
  const handleDirections = () => {
    if (!location) return;
    router.push({
      pathname: '/(tabs)/map',
      params: {
        destLat: location.latitude,
        destLng: location.longitude,
        destName: location.location_name,
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={styles.loadingText}>Đang tải chi tiết địa điểm...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Địa điểm không tồn tại hoặc đã bị gỡ bỏ.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroImage = resolveBackendUrl(location.first_image);

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero image header */}
        <View style={styles.heroContainer}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="image" size={64} color="#94a3b8" />
            </View>
          )}

          {/* Header Buttons */}
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.headerCircleBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#1e293b" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.headerCircleBtn} onPress={handleToggleFavorite}>
              <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={22} color={isFavorited ? "#ef4444" : "#1e293b"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic info box */}
        <View style={styles.infoCard}>
          <Text style={styles.locationTitle}>{location.location_name}</Text>
          <Text style={styles.locationAddress}>{location.address}</Text>

          <View style={styles.metaRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabelVi(location.location_type)}</Text>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#fbbf24" />
              <Text style={styles.ratingText}>
                {Number(location.rating || 0).toFixed(1)} ({location.total_reviews} đánh giá)
              </Text>
            </View>
          </View>

          {/* Weather Widget */}
          {weather.temp !== null && (
            <View style={styles.weatherBox}>
              <Ionicons name="sunny-outline" size={20} color="#f59e0b" />
              <Text style={styles.weatherText}>Thời tiết hiện tại: {weather.temp}°C, {weather.desc}</Text>
            </View>
          )}

          {/* Quick buttons */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDirections}>
              <Ionicons name="navigate-outline" size={18} color="#14b8a6" />
              <Text style={styles.actionBtnText}>Chỉ đường</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={handleToggleFavorite}>
              <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={18} color={isFavorited ? "#ef4444" : "#64748b"} />
              <Text style={[styles.actionBtnText, isFavorited && { color: '#ef4444' }]}>{isFavorited ? 'Đã lưu' : 'Lưu lại'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Local Vouchers list */}
        {vouchers.length > 0 && (
          <View style={styles.vouchersSection}>
            <Text style={styles.sectionTitle}>Mã ưu đãi đang diễn ra</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vouchersScroll}>
              {vouchers.map((v) => (
                <View key={v.voucher_id} style={styles.voucherCard}>
                  <View style={styles.voucherLeft}>
                    <Text style={styles.voucherValue}>
                      {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${(v.discount_value / 1000)}k`}
                    </Text>
                    <Text style={styles.voucherLabel}>GIẢM</Text>
                  </View>
                  <View style={styles.voucherRight}>
                    <Text style={styles.voucherCode}>{v.code}</Text>
                    <Text style={styles.voucherMin}>Đơn từ: {(v.min_order_value / 1000)}k</Text>
                    <TouchableOpacity style={styles.voucherClaimBtn} onPress={() => handleClaimVoucher(v.voucher_id)}>
                      <Text style={styles.voucherClaimText}>Lưu mã</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Segmented Tabs (Overview, Services, Reviews) */}
        <View style={styles.tabsContainer}>
          {(['overview', 'services', 'reviews'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'overview' ? 'Giới thiệu' : (tab === 'services' ? 'Dịch vụ & Vé' : 'Đánh giá');
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab contents */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            <Text style={styles.descTitle}>Thông tin chung</Text>
            <Text style={styles.descText}>
              {location.description || 'Địa điểm chưa cập nhật mô tả giới thiệu chi tiết.'}
            </Text>
            
            <View style={styles.divider} />

            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={18} color="#64748b" style={styles.detailIcon} />
              <View>
                <Text style={styles.detailLabel}>Giờ hoạt động:</Text>
                <Text style={styles.detailValue}>{location.opening_hours || 'Chưa cập nhật'}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="call-outline" size={18} color="#64748b" style={styles.detailIcon} />
              <View>
                <Text style={styles.detailLabel}>Điện thoại liên hệ:</Text>
                <Text style={styles.detailValue}>{location.phone || 'Chưa cập nhật'}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.detailIcon} />
              <View>
                <Text style={styles.detailLabel}>Email liên lạc:</Text>
                <Text style={styles.detailValue}>{location.email || 'Chưa cập nhật'}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'services' && (
          <View style={styles.tabContent}>
            <Text style={styles.descTitle}>Danh sách gói dịch vụ / Đặt chỗ</Text>
            {services.length === 0 ? (
              <View style={styles.emptySub}>
                <Ionicons name="construct-outline" size={32} color="#94a3b8" />
                <Text style={styles.emptySubText}>Địa điểm này chưa cấu hình gói dịch vụ trực tuyến.</Text>
              </View>
            ) : (
              services.map((s) => (
                <View key={s.service_id} style={styles.serviceItem}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{s.service_name}</Text>
                    <Text style={styles.serviceDesc} numberOfLines={2}>
                      {s.description || 'Không có mô tả dịch vụ.'}
                    </Text>
                    <Text style={styles.servicePrice}>
                      {Number(s.price) > 0 ? `${Number(s.price).toLocaleString()}đ` : 'Miễn phí đặt chỗ'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.serviceBookBtn}
                    onPress={() => router.push(`/booking/${s.service_id}?locationId=${location.location_id}` as any)}
                  >
                    <Text style={styles.serviceBookText}>Đặt vé</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            {/* Viết đánh giá mới */}
            <View style={styles.addReviewCard}>
              <Text style={styles.addReviewTitle}>Viết đánh giá của bạn</Text>
              
              {/* Star Rating Picker */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Ionicons name={rating >= s ? "star" : "star-outline"} size={26} color="#fbbf24" style={{ marginRight: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.reviewInput}
                placeholder="Nhập cảm nhận của bạn về chất lượng dịch vụ, thái độ phục vụ..."
                multiline
                numberOfLines={3}
                value={comment}
                onChangeText={setComment}
              />

              <TouchableOpacity
                style={styles.submitReviewBtn}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitReviewText}>Gửi đánh giá</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.descTitle}>Đánh giá từ khách hàng ({reviews.length})</Text>
            {reviews.length === 0 ? (
              <View style={styles.emptySub}>
                <Ionicons name="chatbox-ellipses-outline" size={32} color="#94a3b8" />
                <Text style={styles.emptySubText}>Chưa có bài đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!</Text>
              </View>
            ) : (
              reviews.map((r) => (
                <View key={r.review_id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Image
                      source={{ uri: r.avatar_url ? (r.avatar_url.startsWith('http') ? r.avatar_url : `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${r.avatar_url}`) : 'https://via.placeholder.com/150' }}
                      style={styles.reviewAvatar}
                    />
                    <View style={styles.reviewUserMeta}>
                      <Text style={styles.reviewUserName}>{r.full_name}</Text>
                      <View style={styles.reviewUserStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons key={star} name="star" size={10} color={r.rating >= star ? '#fbbf24' : '#cbd5e1'} />
                        ))}
                        <Text style={styles.reviewDate}> • {formatDate(r.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginVertical: 20 },
  backBtn: { backgroundColor: '#14b8a6', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: 'bold' },
  heroContainer: { width: '100%', height: 200, position: 'relative', backgroundColor: '#cbd5e1' },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  headerOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 5,
  },
  locationTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  locationAddress: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  typeBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 12,
  },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#2563eb' },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 12, color: '#475569', marginLeft: 4, fontWeight: '600' },
  weatherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  weatherText: { fontSize: 11, color: '#166534', marginLeft: 6, fontWeight: '500' },
  quickActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    justifyContent: 'space-around',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16 },
  actionBtnText: { fontSize: 13, color: '#475569', fontWeight: 'bold', marginLeft: 6 },
  vouchersSection: { marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginHorizontal: 16, marginBottom: 10 },
  vouchersScroll: { paddingHorizontal: 16, paddingBottom: 4 },
  voucherCard: {
    flexDirection: 'row',
    width: 200,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    overflow: 'hidden',
    marginRight: 10,
  },
  voucherLeft: {
    width: 60,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#fed7aa',
    borderStyle: 'dashed',
  },
  voucherValue: { fontSize: 16, fontWeight: '900', color: '#ea580c' },
  voucherLabel: { fontSize: 8, fontWeight: '900', color: '#ea580c', marginTop: 2 },
  voucherRight: { flex: 1, padding: 8, justifyContent: 'space-between' },
  voucherCode: { fontSize: 12, fontWeight: 'bold', color: '#1e293b' },
  voucherMin: { fontSize: 9, color: '#64748b' },
  voucherClaimBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  voucherClaimText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 20,
    backgroundColor: '#cbd5e1',
    padding: 3,
    borderRadius: 12,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  tabButtonActive: { backgroundColor: '#ffffff' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#0f172a', fontWeight: 'bold' },
  tabContent: { paddingHorizontal: 16 },
  descTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  descText: { fontSize: 13, color: '#334155', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailIcon: { marginRight: 12 },
  detailLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  detailValue: { fontSize: 13, color: '#334155', fontWeight: '600', marginTop: 1 },
  emptySub: { paddingVertical: 32, alignItems: 'center' },
  emptySubText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  serviceInfo: { flex: 1, marginRight: 10 },
  serviceName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  serviceDesc: { fontSize: 11, color: '#64748b', marginTop: 3 },
  servicePrice: { fontSize: 13, fontWeight: 'bold', color: '#14b8a6', marginTop: 6 },
  serviceBookBtn: {
    backgroundColor: '#14b8a6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  serviceBookText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  addReviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  addReviewTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  starsRow: { flexDirection: 'row', marginBottom: 12 },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitReviewBtn: {
    backgroundColor: '#1e293b',
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitReviewText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  reviewItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#cbd5e1' },
  reviewUserMeta: { marginLeft: 10 },
  reviewUserName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b' },
  reviewUserStars: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  reviewDate: { fontSize: 10, color: '#94a3b8' },
  reviewComment: { fontSize: 12, color: '#334155', lineHeight: 18 },
});
