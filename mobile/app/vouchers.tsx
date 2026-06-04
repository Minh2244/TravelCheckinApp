import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axiosClient from '../api/axiosClient';

interface VoucherItem {
  voucher_id: number;
  code: string;
  discount_value: number;
  discount_type: 'percentage' | 'fixed';
  min_order_value: number;
  expiry_date: string | null;
  location_name?: string;
}

export default function VouchersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);

  const fetchVouchers = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await axiosClient.get('/user/vouchers/saved');
      setVouchers(res.data.data || []);
    } catch (err) {
      console.log('Error fetching saved vouchers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Không thời hạn';
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: VoucherItem }) => {
    return (
      <View style={styles.card}>
        <View style={styles.voucherLeft}>
          <Text style={styles.voucherValue}>
            {item.discount_type === 'percentage' ? `${item.discount_value}%` : `${(item.discount_value / 1000)}k`}
          </Text>
          <Text style={styles.voucherLabel}>GIẢM</Text>
        </View>

        <View style={styles.voucherRight}>
          <Text style={styles.voucherCode}>{item.code}</Text>
          {item.location_name && (
            <Text style={styles.voucherLoc} numberOfLines={1}>Dành cho: {item.location_name}</Text>
          )}
          <Text style={styles.voucherMin}>Đơn tối thiểu: {Number(item.min_order_value).toLocaleString()}đ</Text>
          <View style={styles.footerRow}>
            <Ionicons name="time-outline" size={12} color="#94a3b8" />
            <Text style={styles.voucherExpiry}>HSD: {formatDate(item.expiry_date)}</Text>
          </View>
        </View>
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
        <Text style={styles.headerTitle}>Voucher của tôi</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#14b8a6" />
          <Text style={styles.loadingText}>Đang tải kho voucher...</Text>
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item, index) => (item.voucher_id || index).toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchVouchers(true)} colors={['#14b8a6']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có voucher nào</Text>
              <Text style={styles.emptySubtitle}>Các mã ưu đãi do bạn thu thập tại các cửa hàng ẩm thực, khách sạn sẽ hiển thị đầy đủ tại đây.</Text>
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
    borderWidth: 1,
    borderColor: '#fed7aa',
    overflow: 'hidden',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  voucherLeft: {
    width: 80,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderRightColor: '#fed7aa',
    borderStyle: 'dashed',
  },
  voucherValue: { fontSize: 20, fontWeight: '900', color: '#ea580c' },
  voucherLabel: { fontSize: 9, fontWeight: '900', color: '#ea580c', marginTop: 2, letterSpacing: 0.5 },
  voucherRight: { flex: 1, padding: 12, justifyContent: 'space-between' },
  voucherCode: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  voucherLoc: { fontSize: 11, color: '#475569', fontWeight: '500', marginTop: 2 },
  voucherMin: { fontSize: 10, color: '#64748b', marginTop: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  voucherExpiry: { fontSize: 10, color: '#94a3b8', marginLeft: 4, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 120, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
