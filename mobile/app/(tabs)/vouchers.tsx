// Trang vouchers đã lưu
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import userApi from '../../src/api/userApi';
import { COLORS, SIZES, FONTS } from '../../src/utils/constants';
import type { Voucher } from '../../src/types';

type FilterTab = 'all' | 'active' | 'expired';

export default function VouchersScreen() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Tải danh sách vouchers
  const fetchVouchers = useCallback(async () => {
    try {
      const response = await userApi.getMySavedVouchers();
      setVouchers(Array.isArray(response.data) ? response.data : []);
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Lọc vouchers theo tab
  const filteredVouchers = vouchers.filter((v) => {
    if (activeTab === 'all') return true;
    const now = new Date();
    const endDate = new Date(v.end_date);
    if (activeTab === 'active') return endDate >= now;
    return endDate < now;
  });

  // Kiểm tra voucher còn hiệu lực
  const isActive = (voucher: Voucher) => {
    const now = new Date();
    const endDate = new Date(voucher.end_date);
    return endDate >= now;
  };

  // Format ngày
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Render voucher card
  const renderVoucher = ({ item }: { item: Voucher }) => {
    const active = isActive(item);
    const isPercent = item.discount_type === 'percent';

    return (
      <View style={[styles.voucherCard, !active && styles.voucherCardExpired]}>
        {/* Phần trái - giá trị giảm giá */}
        <View style={[styles.voucherValue, !active && styles.voucherValueExpired]}>
          <Text style={styles.voucherDiscount}>
            {isPercent ? `${item.discount_value}%` : `${(item.discount_value / 1000).toFixed(0)}K`}
          </Text>
          <Text style={styles.voucherDiscountLabel}>GIẢM</Text>
        </View>

        {/* Phần phải - thông tin */}
        <View style={styles.voucherInfo}>
          <Text style={styles.voucherName} numberOfLines={1}>
            {item.campaign_name}
          </Text>
          {item.campaign_description && (
            <Text style={styles.voucherDesc} numberOfLines={2}>
              {item.campaign_description}
            </Text>
          )}
          {item.min_order_value && (
            <Text style={styles.voucherCondition}>
              Đơn tối thiểu: {(item.min_order_value / 1000).toFixed(0)}K
            </Text>
          )}
          {item.max_discount_amount && isPercent && (
            <Text style={styles.voucherCondition}>
              Giảm tối đa: {(item.max_discount_amount / 1000).toFixed(0)}K
            </Text>
          )}
          <Text style={styles.voucherDate}>
            {formatDate(item.start_date)} - {formatDate(item.end_date)}
          </Text>
          {item.location_names && item.location_names.length > 0 && (
            <Text style={styles.voucherLocation} numberOfLines={1}>
              📍 {item.location_names.join(', ')}
            </Text>
          )}
          {!active && (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredText}>Đã hết hạn</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Tab buttons
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Còn hiệu lực' },
    { key: 'expired', label: 'Hết hạn' },
  ];

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Danh sách vouchers */}
      {filteredVouchers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="ticket-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>
            {activeTab === 'all'
              ? 'Chưa có voucher nào'
              : activeTab === 'active'
              ? 'Không có voucher còn hiệu lực'
              : 'Không có voucher hết hạn'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredVouchers}
          renderItem={renderVoucher}
          keyExtractor={(item) => item.voucher_id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  list: {
    padding: SIZES.lg,
    gap: SIZES.md,
  },
  voucherCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  voucherCardExpired: {
    opacity: 0.6,
  },
  voucherValue: {
    width: 100,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.md,
  },
  voucherValueExpired: {
    backgroundColor: COLORS.textLight,
  },
  voucherDiscount: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: '#fff',
  },
  voucherDiscountLabel: {
    fontSize: FONTS.xs,
    color: '#fff',
    fontWeight: '600',
  },
  voucherInfo: {
    flex: 1,
    padding: SIZES.md,
  },
  voucherName: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  voucherDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xs,
  },
  voucherCondition: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
  },
  voucherDate: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
  },
  voucherLocation: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    marginTop: SIZES.xs,
  },
  expiredBadge: {
    marginTop: SIZES.xs,
    alignSelf: 'flex-start',
  },
  expiredText: {
    fontSize: FONTS.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: FONTS.lg,
    color: COLORS.textSecondary,
    marginTop: SIZES.lg,
  },
});
