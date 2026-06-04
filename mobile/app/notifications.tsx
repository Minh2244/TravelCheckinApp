// app/notifications.tsx
// Man hinh thong bao: hien thi danh sach thong bao, danh dau da doc, xoa tat ca

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import axiosClient from '../api/axiosClient';
import { USER_API } from '../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import type { Notification } from '../types';

// Bat plugin relativeTime va locale Viet
dayjs.extend(relativeTime);
dayjs.locale('vi');

// Dinh dang thoi gian tuong doi: "2 gio truoc", "3 ngay truoc"
const formatRelativeTime = (value: string): string => {
  const dt = dayjs(value);
  if (!dt.isValid()) return value;
  return dt.fromNow();
};

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Lay danh sach thong bao
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get(USER_API.NOTIFICATIONS);
      setNotifications(res.data.data || []);
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Danh dau tat ca da doc
  const handleMarkAllRead = useCallback(async () => {
    try {
      await axiosClient.post(USER_API.NOTIFICATIONS_READ_ALL);
      setNotifications((prev) =>
        prev.map((n) => (n.is_read ? n : { ...n, is_read: 1 }))
      );
    } catch {
      // Khong lam gi khi loi
    }
  }, []);

  // Xac nhan xoa tat ca
  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Xóa tất cả thông báo',
      'Bạn có chắc muốn xóa toàn bộ thông báo? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosClient.post(USER_API.NOTIFICATIONS_DELETE_ALL);
              setNotifications([]);
            } catch {
              // Khong lam gi khi loi
            }
          },
        },
      ]
    );
  }, []);

  // Render moi thong bao
  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.is_read;

    return (
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* Cham xanh cho thong bao chua doc */}
          <View style={styles.dotColumn}>
            <View style={[styles.dot, isUnread && styles.dotUnread]} />
          </View>

          {/* Noi dung thong bao */}
          <View style={styles.content}>
            <Text
              style={[styles.title, isUnread && styles.titleUnread]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  // Co thong bao chua doc hay khong
  const hasUnread = notifications.some((n) => !n.is_read);
  const hasNotifications = notifications.length > 0;

  return (
    <View style={styles.container}>
      <Header
        title="Thông báo"
        rightIcon={hasUnread ? 'checkmark-done' : undefined}
        onRightPress={hasUnread ? handleMarkAllRead : undefined}
      />

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <>
          {/* Nut xoa tat ca khi co thong bao */}
          {hasNotifications && (
            <View style={styles.actionBar}>
              <Text style={styles.countText}>
                {notifications.length} thông báo
              </Text>
              <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.deleteText}>Xóa tất cả</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.notification_id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchNotifications(true)}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="notifications-off-outline"
                title="Chưa có thông báo"
                description="Bạn sẽ nhận được thông báo về đơn đặt chỗ, khuyến mãi và các hoạt động khác."
              />
            }
          />
        </>
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  countText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
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
  dotColumn: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  dotUnread: {
    backgroundColor: colors.info,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
});
