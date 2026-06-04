// app/location/[id].tsx
// Chi tiet dia diem: anh, thong tin, dich vu, danh gia, voucher

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, TextInput,
  FlatList, StyleSheet, Linking, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import { extractOpenClose } from '../../utils/openingHours';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SegmentedControl from '../../components/SegmentedControl';
import RatingStars from '../../components/RatingStars';
import EmptyState from '../../components/EmptyState';
import type { Location, Service, Review, Voucher } from '../../types';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locationId = Number(id);

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [locRes, svcRes, revRes, vchRes, favRes] = await Promise.all([
        axiosClient.get(LOCATIONS_API.DETAIL(locationId)),
        axiosClient.get(LOCATIONS_API.SERVICES(locationId)),
        axiosClient.get(LOCATIONS_API.REVIEWS(locationId)),
        axiosClient.get(USER_API.VOUCHERS_LOCATION(locationId)).catch(() => ({ data: [] })),
        axiosClient.get(USER_API.FAVORITES).catch(() => ({ data: [] })),
      ]);
      setLocation(locRes.data.data || locRes.data);
      setServices(svcRes.data.data || svcRes.data || []);
      setReviews(revRes.data.data || revRes.data || []);
      setVouchers(vchRes.data.data || vchRes.data || []);
      const favs = favRes.data.data || favRes.data || [];
      setIsFavorite(favs.some((f: { location_id: number }) => f.location_id === locationId));
    } catch {
      // Giu trang thai cu
    }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await axiosClient.delete(USER_API.FAVORITES + `/${locationId}`);
      } else {
        await axiosClient.patch(USER_API.FAVORITES + `/${locationId}`, {});
      }
      setIsFavorite(!isFavorite);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật yêu thích');
    }
  };

  const submitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn số sao');
      return;
    }
    setSubmittingReview(true);
    try {
      await axiosClient.post(USER_API.REVIEWS, {
        location_id: locationId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewRating(0);
      setReviewComment('');
      await fetchData();
      Alert.alert('Thành công', 'Đánh giá đã được gửi');
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  const claimVoucher = async (voucherId: number) => {
    try {
      await axiosClient.post(USER_API.VOUCHERS_CLAIM(voucherId));
      Alert.alert('Thành công', 'Đã nhận voucher');
      await fetchData();
    } catch {
      Alert.alert('Lỗi', 'Không thể nhận voucher');
    }
  };

  if (!location) {
    return <View style={styles.loadingContainer}><Header title="Đang tải..." /></View>;
  }

  const openingInfo = extractOpenClose(location.opening_hours);

  return (
    <View style={styles.container}>
      <Header title={location.location_name} transparent />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero image */}
        {location.first_image ? (
          <Image source={{ uri: location.first_image }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback]}>
            <Ionicons name="image-outline" size={64} color={colors.textMuted} />
          </View>
        )}

        {/* Info card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.locationName}>{location.location_name}</Text>
            <TouchableOpacity onPress={toggleFavorite}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite ? colors.error : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.address}>{location.address || location.province || ''}</Text>
          <View style={styles.metaRow}>
            {location.avg_rating != null && location.avg_rating > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={styles.metaText}>{location.avg_rating.toFixed(1)} ({location.total_reviews || 0})</Text>
              </View>
            )}
            {openingInfo && <Badge text={`${openingInfo.open}-${openingInfo.close}`} variant="success" />}
          </View>
          {/* Quick actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL(`tel:${location.phone}`)}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Gọi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => router.push(`/(tabs)/map` as any)}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>Chỉ đường</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Vouchers */}
        {vouchers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voucher khả dụng</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={vouchers}
              keyExtractor={(item) => String(item.voucher_id)}
              renderItem={({ item }) => (
                <Card style={styles.voucherCard}>
                  <Text style={styles.voucherDiscount}>
                    {item.discount_type === 'percentage' ? `${item.discount_value}%` : `${item.discount_value.toLocaleString()}đ`}
                  </Text>
                  <Text style={styles.voucherCode}>{item.voucher_code}</Text>
                  <Text style={styles.voucherMin}>Đơn tối thiểu {item.min_order.toLocaleString()}đ</Text>
                  <Button title="Nhận" onPress={() => claimVoucher(item.voucher_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                </Card>
              )}
            />
          </View>
        )}

        {/* Segmented tabs */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <SegmentedControl options={['Tổng quan', 'Dịch vụ', 'Đánh giá']} selected={activeTab} onChange={setActiveTab} />
        </View>

        {/* Tab content */}
        <View style={{ padding: spacing.md, paddingBottom: 100 }}>
          {activeTab === 0 && (
            // Tong quan
            <View>
              {location.description && (
                <Text style={styles.description}>{location.description}</Text>
              )}
              <Card style={{ marginTop: spacing.md }}>
                {openingInfo && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailText}>Mở cửa: {openingInfo.open} - {openingInfo.close}</Text>
                  </View>
                )}
                {location.phone && (
                  <TouchableOpacity style={styles.detailRow} onPress={() => Linking.openURL(`tel:${location.phone}`)}>
                    <Ionicons name="call" size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.primary }]}>{location.phone}</Text>
                  </TouchableOpacity>
                )}
                {location.email && (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{location.email}</Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {activeTab === 1 && (
            // Dich vu
            <View>
              {services.length === 0 ? (
                <EmptyState icon="cube-outline" title="Chưa có dịch vụ" />
              ) : (
                services.map((svc) => (
                  <Card key={svc.service_id} style={styles.serviceCard}>
                    <View style={styles.serviceHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{svc.service_name}</Text>
                        <Badge text={svc.service_type} variant="info" />
                      </View>
                      <Text style={styles.servicePrice}>{svc.price.toLocaleString()}đ</Text>
                    </View>
                    {svc.description && <Text style={styles.serviceDesc}>{svc.description}</Text>}
                    <Button
                      title="Đặt ngay"
                      onPress={() => router.push(`/booking/${svc.service_id}` as any)}
                      variant="primary"
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))
              )}
            </View>
          )}

          {activeTab === 2 && (
            // Danh gia
            <View>
              {/* Form danh gia */}
              <Card style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>Viết đánh giá</Text>
                <RatingStars rating={reviewRating} size={28} interactive onChange={setReviewRating} />
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  placeholderTextColor={colors.textMuted}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  numberOfLines={3}
                />
                <Button title="Gửi đánh giá" onPress={submitReview} loading={submittingReview} />
              </Card>

              {/* Danh sach danh gia */}
              {reviews.length === 0 ? (
                <EmptyState icon="chatbubble-outline" title="Chưa có đánh giá" />
              ) : (
                reviews.map((rev) => (
                  <Card key={rev.review_id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar uri={rev.avatar_url} name={rev.full_name} size={36} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={styles.reviewName}>{rev.full_name}</Text>
                        <RatingStars rating={rev.rating} size={14} />
                      </View>
                    </View>
                    {rev.comment && <Text style={styles.reviewComment}>{rev.comment}</Text>}
                    {rev.owner_reply && (
                      <View style={styles.ownerReply}>
                        <Text style={styles.ownerReplyLabel}>Phản hồi từ chủ địa điểm:</Text>
                        <Text style={styles.ownerReplyText}>{rev.owner_reply}</Text>
                      </View>
                    )}
                  </Card>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  heroImage: { width: '100%', height: 220 },
  heroFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  infoCard: { marginHorizontal: spacing.md, marginTop: -40 },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  locationName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },
  address: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.primary, marginLeft: 6 },
  section: { marginTop: spacing.lg, paddingLeft: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  voucherCard: { width: 160, marginRight: spacing.sm },
  voucherDiscount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  voucherCode: { fontSize: fontSize.sm, color: colors.text, marginTop: 4 },
  voucherMin: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  description: { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  detailText: { fontSize: fontSize.base, color: colors.text, marginLeft: spacing.sm },
  serviceCard: { marginBottom: spacing.sm },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  servicePrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  serviceDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  reviewForm: { marginBottom: spacing.md },
  reviewFormTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  reviewInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, fontSize: fontSize.base, color: colors.text,
    minHeight: 80, textAlignVertical: 'top', marginVertical: spacing.md,
  },
  reviewCard: { marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  reviewComment: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  ownerReply: { marginTop: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.primary },
  ownerReplyLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
  ownerReplyText: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
});
