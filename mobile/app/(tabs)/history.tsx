// screens/history.tsx
// Man hinh lich su check-in, hien thi danh sach cac lan check-in cua nguoi dung

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import { USER_API } from '../../api/endpoints';
import axiosClient from '../../api/axiosClient';
import { Checkin, ApiResponse } from '../../types';

// Map trang thai check-in sang variant cua Badge
const STATUS_MAP: Record<Checkin['status'], { variant: 'success' | 'warning' | 'error'; label: string }> = {
  verified: { variant: 'success', label: 'Da xac thuc' },
  pending: { variant: 'warning', label: 'Cho duyet' },
  failed: { variant: 'error', label: 'That bai' },
};

export default function HistoryScreen() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Lay du lieu lich su check-in tu API
  const fetchCheckins = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await axiosClient.get<ApiResponse<Checkin[]>>(USER_API.CHECKINS);
      if (response.data?.data) {
        setCheckins(response.data.data);
      }
    } catch (error) {
      // Xu ly loi im lang, khong hien thi cho nguoi dung
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // Dinh dang thoi gian check-in sang dinh dang doc duoc
  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} - ${date}`;
  };

  // Render tung muc check-in
  const renderItem = ({ item }: { item: Checkin }) => {
    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;

    return (
      <Card style={styles.card}>
        {/* Anh dia diem hoac icon fallback */}
        <View style={styles.imageRow}>
          {item.first_image ? (
            <Image source={{ uri: item.first_image }} style={styles.locationImage} />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="location-outline" size={28} color={colors.primary} />
            </View>
          )}
          <View style={styles.infoContainer}>
            <Text style={styles.locationName} numberOfLines={1}>
              {item.location_name || 'Dia diem khong xac dinh'}
            </Text>
            {item.address ? (
              <Text style={styles.address} numberOfLines={1}>
                {item.address}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Dong thoi gian va trang thai */}
        <View style={styles.metaRow}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.timeText}>{formatTime(item.checkin_time)}</Text>
          </View>
          <Badge text={statusInfo.label} variant={statusInfo.variant} />
        </View>
      </Card>
    );
  };

  // Hien thi loading ban dau
  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Header title="Lich su check-in" showBack={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Lich su check-in" showBack={false} />

      <FlatList
        data={checkins}
        keyExtractor={(item) => item.checkin_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={checkins.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="footsteps-outline"
            title="Chua co lan check-in nao"
            description="Hay bat dau hanh trinh cua ban bang cach check-in tai mot dia diem!"
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchCheckins(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyContent: {
    flexGrow: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  imageFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  locationName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  address: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});
