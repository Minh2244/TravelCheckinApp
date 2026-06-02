// Trang chi tiết địa điểm
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import locationApi from '../../src/api/locationApi';
import userApi from '../../src/api/userApi';
import { COLORS, SIZES, FONTS } from '../../src/utils/constants';
import type { Location, LocationService, Review } from '../../src/types';

type TabKey = 'overview' | 'reviews' | 'intro';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locationId = Number(id);

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<LocationService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Tải dữ liệu
  const fetchData = useCallback(async () => {
    try {
      const [locRes, servicesRes, reviewsRes, favRes] = await Promise.all([
        locationApi.getLocationById(locationId),
        locationApi.getLocationServices(locationId),
        locationApi.getLocationReviews(locationId),
        userApi.getFavorites().catch(() => ({ data: [] })),
      ]);

      setLocation(locRes.data);
      setServices(
        Array.isArray(servicesRes.data) ? servicesRes.data : []
      );
      setReviews(
        Array.isArray(reviewsRes.data) ? reviewsRes.data : []
      );

      // Kiểm tra đã lưu chưa
      const favorites = Array.isArray(favRes.data) ? favRes.data : [];
      setIsFavorite(
        favorites.some(
          (f: { location_id: number }) => f.location_id === locationId
        )
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể tải thông tin địa điểm');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle yêu thích
  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await userApi.removeFavorite(locationId);
      } else {
        await userApi.saveFavorite(locationId);
      }
      setIsFavorite(!isFavorite);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật. Vui lòng thử lại.');
    }
  };

  // Chia sẻ
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${location?.location_name}\n${location?.address}`,
      });
    } catch {
      // Bỏ qua
    }
  };

  // Mở chỉ đường
  const handleDirections = () => {
    if (location?.latitude && location?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      Linking.openURL(url);
    }
  };

  // Gửi đánh giá
  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn số sao');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await userApi.createReview({
        location_id: locationId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      Alert.alert('Thành công', 'Đã gửi đánh giá');
      setReviewRating(0);
      setReviewComment('');
      // Tải lại reviews
      const reviewsRes = await locationApi.getLocationReviews(locationId);
      setReviews(
        Array.isArray(reviewsRes.data) ? reviewsRes.data : []
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi đánh giá');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Lấy giờ mở cửa
  const getOpeningStatus = () => {
    if (!location?.opening_hours) return null;
    try {
      const now = new Date();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = days[now.getDay()];
      const todayHours = location.opening_hours[today];

      if (!todayHours || todayHours.closed) {
        return { text: 'Đóng cửa hôm nay', isOpen: false };
      }

      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [openHour, openMinute] = todayHours.open.split(':').map(Number);
      const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);

      const current = currentHour * 60 + currentMinute;
      const open = openHour * 60 + openMinute;
      const close = closeHour * 60 + closeMinute;

      if (current >= open && current <= close) {
        return { text: `Đang mở cửa · Đóng lúc ${todayHours.close}`, isOpen: true };
      }
      return { text: `Đã đóng cửa · Mở lúc ${todayHours.open}`, isOpen: false };
    } catch {
      return null;
    }
  };

  // Render stars
  const renderStars = (rating: number, size: number = 16, interactive: boolean = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={interactive ? () => setReviewRating(star) : undefined}
            disabled={!interactive}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={size}
              color={star <= rating ? COLORS.secondary : COLORS.textLight}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render review item
  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewUser}>
          {item.user_avatar ? (
            <Image source={{ uri: item.user_avatar }} style={styles.reviewAvatar} />
          ) : (
            <View style={styles.reviewAvatarFallback}>
              <Ionicons name="person" size={16} color={COLORS.textLight} />
            </View>
          )}
          <Text style={styles.reviewUserName}>{item.user_name || 'Ẩn danh'}</Text>
        </View>
        {renderStars(item.rating, 14)}
      </View>
      {item.comment && (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Không tìm thấy địa điểm</Text>
      </View>
    );
  }

  const openingStatus = getOpeningStatus();

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Ảnh header */}
        {location.first_image ? (
          <Image source={{ uri: location.first_image }} style={styles.headerImage} />
        ) : (
          <View style={[styles.headerImage, styles.headerImageFallback]}>
            <Ionicons name="image-outline" size={64} color={COLORS.textLight} />
          </View>
        )}

        {/* Thông tin chính */}
        <View style={styles.mainInfo}>
          <Text style={styles.locationName}>{location.location_name}</Text>
          <Text style={styles.locationAddress}>{location.address}</Text>

          {/* Rating & stats */}
          <View style={styles.statsRow}>
            {location.rating > 0 && (
              <View style={styles.statItem}>
                {renderStars(Math.round(location.rating), 16)}
                <Text style={styles.statText}>
                  {location.rating.toFixed(1)} ({location.total_reviews})
                </Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.statText}>{location.total_checkins} check-in</Text>
            </View>
          </View>

          {/* Giờ mở cửa */}
          {openingStatus && (
            <View style={styles.openingStatus}>
              <Ionicons
                name="time-outline"
                size={16}
                color={openingStatus.isOpen ? COLORS.success : COLORS.error}
              />
              <Text
                style={[
                  styles.openingText,
                  { color: openingStatus.isOpen ? COLORS.success : COLORS.error },
                ]}
              >
                {openingStatus.text}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
              <Ionicons name="navigate" size={20} color={COLORS.primary} />
              <Text style={styles.actionText}>Chỉ đường</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? COLORS.error : COLORS.primary}
              />
              <Text style={styles.actionText}>
                {isFavorite ? 'Đã lưu' : 'Lưu'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={COLORS.primary} />
              <Text style={styles.actionText}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {(['overview', 'reviews', 'intro'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
              >
                {tab === 'overview'
                  ? 'Tổng quan'
                  : tab === 'reviews'
                  ? 'Đánh giá'
                  : 'Giới thiệu'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Mô tả */}
            {location.description && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Mô tả</Text>
                <Text style={styles.description}>{location.description}</Text>
              </View>
            )}

            {/* Dịch vụ */}
            {services.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Dịch vụ</Text>
                {services.map((service) => (
                  <View key={service.service_id} style={styles.serviceItem}>
                    <Text style={styles.serviceName}>{service.service_name}</Text>
                    <Text style={styles.servicePrice}>
                      {service.price > 0
                        ? `${(service.price / 1000).toFixed(0)}K`
                        : 'Liên hệ'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Liên hệ */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Liên hệ</Text>
              <View style={styles.contactItem}>
                <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.contactText}>{location.address}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            {/* Form đánh giá */}
            <View style={styles.reviewForm}>
              <Text style={styles.reviewFormTitle}>Viết đánh giá</Text>
              {renderStars(reviewRating, 24, true)}
              <TextInput
                style={styles.reviewInput}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                placeholderTextColor={COLORS.textLight}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmittingReview && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Gửi đánh giá</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Danh sách đánh giá */}
            {reviews.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
            ) : (
              <FlatList
                data={reviews}
                renderItem={renderReview}
                keyExtractor={(item) => item.review_id.toString()}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {activeTab === 'intro' && (
          <View style={styles.tabContent}>
            <Text style={styles.description}>
              {location.description || 'Chưa có thông tin giới thiệu.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONTS.lg,
    color: COLORS.textSecondary,
  },
  headerImage: {
    width: '100%',
    height: 220,
  },
  headerImageFallback: {
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainInfo: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
  },
  locationName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  locationAddress: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SIZES.lg,
    marginBottom: SIZES.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  statText: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  openingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.md,
  },
  openingText: {
    fontSize: FONTS.sm,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.xs,
    paddingVertical: SIZES.md,
    backgroundColor: COLORS.primary + '10',
    borderRadius: SIZES.radiusSm,
  },
  actionText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginTop: SIZES.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabContent: {
    padding: SIZES.lg,
  },
  infoSection: {
    marginBottom: SIZES.xl,
  },
  infoSectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  description: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  serviceName: {
    fontSize: FONTS.md,
    color: COLORS.text,
  },
  servicePrice: {
    fontSize: FONTS.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  contactText: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    flex: 1,
  },
  reviewForm: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.lg,
    marginBottom: SIZES.xl,
  },
  reviewFormTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: SIZES.md,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusSm,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    marginTop: SIZES.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: FONTS.md,
    fontWeight: '600',
  },
  reviewItem: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.lg,
    marginBottom: SIZES.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewUserName: {
    fontSize: FONTS.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  reviewComment: {
    fontSize: FONTS.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    paddingVertical: SIZES.xl,
  },
});
