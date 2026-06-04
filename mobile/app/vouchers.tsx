// app/vouchers.tsx
// Man hinh voucher da luu: hien thi danh sach voucher cua nguoi dung

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
import type { Voucher } from '../types';

// Dinh dang ngay het han
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Không thời hạn';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 'Không thời hạn';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Dinh dang gia tri giam
const formatDiscount = (item: Voucher): string => {
  if (item.discount_type === 'percentage') return `${item.discount_value}%`;
  return `${(item.discount_value / 1000).toFixed(0)}k`;
};

// Dinh dang tien toi thieu
const formatMinOrder = (value: number): string => {
  if (!value || value <= 0) return 'Không yêu cầu';
  return `${value.toLocaleString('vi-VN')}đ`;
};

export default function VouchersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  // Lay danh sach voucher da luu
  const fetchVouchers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get(USER_API.VOUCHERS_SAVED);
      setVouchers(res.data.data || []);
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // Kiem tra voucher het han
  const isExpired = (endDate: string): boolean => {
    const d = new Date(endDate);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  };

  const renderItem = ({ item }: { item: Voucher }) => {
    const expired = item.end_date ? isExpired(item.end_date) : false;

    return (
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* Phan gia tri giam */}
          <View style={styles.discountBox}>
            <Text style={styles.discountValue}>{formatDiscount(item)}</Text>
            <Text style={styles.discountLabel}>GIẢM</Text>
          </View>

          {/* Phan thong tin voucher */}
          <View style={styles.voucherInfo}>
            <View style={styles.codeRow}>
              <Text style={styles.voucherCode}>{item.voucher_code}</Text>
              {expired ? (
                <Badge text="Hết hạn" variant="muted" />
              ) : (
                <Badge text="Còn hạn" variant="success" />
              )}
            </View>

            {item.location_name ? (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.detailText} numberOfLines={1}>{item.location_name}</Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Ionicons name="cart-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>Đơn tối thiểu: {formatMinOrder(item.min_order)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.expiryText}>HSD: {formatDate(item.end_date)}</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Voucher của tôi" />

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item) => String(item.voucher_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchVouchers(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="ticket-outline"
              title="Chưa có voucher nào"
              description="Các mã ưu đãi do bạn thu thập tại các cửa hàng sẽ hiển thị tại đây."
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
    padding: 0,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
  },
  discountBox: {
    width: 88,
    backgroundColor: colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRightWidth: 1.5,
    borderRightColor: colors.warning,
    borderStyle: 'dashed',
  },
  discountValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.warning,
  },
  discountLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.warning,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  voucherInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  voucherCode: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 0.5,
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
    flex: 1,
  },
  expiryText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: 6,
  },
});
