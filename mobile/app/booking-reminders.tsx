// app/booking-reminders.tsx
// Man hinh nhac nho dat cho: hien thi danh sach lich dat sap dien ra

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../api/axiosClient';
import { USER_API } from '../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import type { BookingReminder } from '../types';

// Dinh dang ngay gio hien thi
const formatDateTime = (value: string): string => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Icon theo loai dich vu
const getServiceIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type?.toLowerCase()) {
    case 'room': return 'bed-outline';
    case 'table': return 'restaurant-outline';
    case 'ticket': return 'ticket-outline';
    default: return 'calendar-outline';
  }
};

// Badge variant theo trang thai
const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'muted' | 'info' => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return 'success';
    case 'pending': return 'warning';
    case 'cancelled': return 'error';
    case 'completed': return 'muted';
    default: return 'info';
  }
};

// Label trang thai
const getStatusLabel = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return 'Đã xác nhận';
    case 'pending': return 'Chờ xác nhận';
    case 'cancelled': return 'Đã hủy';
    case 'completed': return 'Hoàn thành';
    case 'expired': return 'Hết hạn';
    default: return status;
  }
};

export default function BookingRemindersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState<BookingReminder[]>([]);

  // Lay danh sach nhac nho
  const fetchReminders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get(USER_API.BOOKING_REMINDERS);
      setReminders(res.data.data || []);
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const renderItem = ({ item }: { item: BookingReminder }) => {
    const icon = getServiceIcon(item.service_type);

    return (
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* Icon loai dich vu */}
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={24} color={colors.primary} />
          </View>

          {/* Thong tin nhac nho */}
          <View style={styles.info}>
            <View style={styles.topRow}>
              <Text style={styles.locationName} numberOfLines={1}>{item.location_name}</Text>
              <Badge text={getStatusLabel(item.status)} variant={getStatusVariant(item.status)} />
            </View>

            <Text style={styles.serviceName}>{item.service_name}</Text>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>{formatDateTime(item.check_in_date)}</Text>
            </View>

            {item.check_out_date ? (
              <View style={styles.detailRow}>
                <Ionicons name="log-out-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.detailText}>{formatDateTime(item.check_out_date)}</Text>
              </View>
            ) : null}

            {item.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesText} numberOfLines={3}>{item.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Nhắc nhở đặt chỗ" />

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => String(item.booking_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchReminders(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-clear-outline"
              title="Chưa có nhắc nhở nào"
              description="Bạn không có lịch đặt chỗ nào chuẩn bị diễn ra trong thời gian tới."
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
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  serviceName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: fontWeight.medium,
  },
  notesBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notesText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
