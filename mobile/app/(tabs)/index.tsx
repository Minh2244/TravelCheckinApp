// app/(tabs)/index.tsx
// Trang chu — loi chao, thoi tiet, quick actions, goi y dia diem

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import axiosClient from '../../api/axiosClient';
import { USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import type { UserProfile, Location } from '../../types';
import useLocationPermission from '../../hooks/useLocationPermission';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

// Cac nut hanh dong nhanh
const QUICK_ACTIONS = [
  { icon: 'notifications' as const, label: 'Nhắc nhở', route: '/booking-reminders' },
  { icon: 'heart' as const, label: 'Đã lưu', route: '/saved-locations' },
  { icon: 'ticket' as const, label: 'Voucher', route: '/vouchers' },
  { icon: 'time' as const, label: 'Lịch sử', route: '/(tabs)/history' },
  { icon: 'warning' as const, label: 'SOS', route: '/sos' },
];

// Mau sac theo hang thanh vien
const TIER_COLORS: Record<string, string> = {
  Newbie: colors.textMuted,
  'Silver Traveler': '#94a3b8',
  'Gold Explorer': '#f59e0b',
  'Diamond Pathfinder': '#3b82f6',
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);
  const { location } = useLocationPermission();

  // Lay profile va goi y dia diem
  const fetchData = useCallback(async () => {
    try {
      const [profileRes, recRes] = await Promise.all([
        axiosClient.get(USER_API.PROFILE),
        axiosClient.get(USER_API.RECOMMENDATIONS, { params: { limit: 10 } }),
      ]);
      setProfile(profileRes.data.data || profileRes.data);
      setRecommendations(recRes.data.data || recRes.data || []);
    } catch {
      // Giu trang thai cu neu loi
    }
  }, []);

  // Lay thoi tiet tu Open-Meteo, dung GPS hoac mac dinh Can Tho
  const fetchWeather = useCallback(async () => {
    try {
      const lat = location?.latitude || 10.03;
      const lon = location?.longitude || 105.77;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
      );
      const data = await res.json();
      const temp = Math.round(data.current?.temperature_2m || 0);
      const code = data.current?.weather_code || 0;
      const desc =
        code <= 1
          ? 'Trời nắng'
          : code <= 3
            ? 'Nhiều mây'
            : code <= 48
              ? 'Sương mù'
              : 'Mưa';
      setWeather({ temp, desc });
    } catch {
      // Khong hien thi thoi tiet neu loi
    }
  }, [location]);

  useEffect(() => {
    fetchData();
    fetchWeather();
  }, [fetchData, fetchWeather]);

  // Keo de tai lai du lieu
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchWeather();
    setRefreshing(false);
  };

  const tier = profile?.stats?.member_tier || 'Newbie';
  const tierColor = TIER_COLORS[tier] || colors.textMuted;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header: avatar + loi chao + hang thanh vien */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar uri={user?.avatar_url} name={user?.full_name} size={48} />
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>{user?.full_name || 'Bạn'}</Text>
          </View>
        </View>
        <Badge text={tier} variant={tier === 'Newbie' ? 'muted' : 'warning'} />
      </View>

      {/* Thoi tiet */}
      {weather && (
        <Card style={styles.weatherCard}>
          <Ionicons name="partly-sunny" size={28} color={colors.warning} />
          <View style={styles.weatherTextContainer}>
            <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
            <Text style={styles.weatherDesc}>{weather.desc}</Text>
          </View>
        </Card>
      )}

      {/* Quick actions — 5 nut hanh dong */}
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickAction}
            onPress={() => router.push(action.route as never)}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={action.icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Goi y dia diem — 2 cot FlatList */}
      <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
      {recommendations.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="Chưa có gợi ý"
          description="Hãy khám phá thêm địa điểm!"
        />
      ) : (
        <FlatList
          data={recommendations}
          numColumns={2}
          scrollEnabled={false}
          keyExtractor={(item) => String(item.location_id)}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <Card
              style={styles.locationCard as never}
              onPress={() => router.push(`/location/${item.location_id}` as never)}
            >
              {item.first_image ? (
                <Image source={{ uri: item.first_image }} style={styles.locationImage} />
              ) : (
                <View style={[styles.locationImage, styles.locationImageFallback]}>
                  <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.locationInfo}>
                <Text style={styles.locationName} numberOfLines={2}>
                  {item.location_name}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {item.address || item.province || ''}
                </Text>
                {item.avg_rating != null && item.avg_rating > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{item.avg_rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  greetingContainer: { marginLeft: spacing.sm },
  greeting: { fontSize: fontSize.sm, color: colors.textSecondary },
  userName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weatherTextContainer: { marginLeft: spacing.sm },
  weatherTemp: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  weatherDesc: { fontSize: fontSize.sm, color: colors.textSecondary },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickAction: { alignItems: 'center', width: 64 },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  gridRow: { gap: spacing.md, marginBottom: spacing.md },
  locationCard: { width: CARD_WIDTH, padding: 0, overflow: 'hidden' },
  locationImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  locationImageFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: { padding: spacing.sm },
  locationName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  locationAddress: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 4,
  },
});
