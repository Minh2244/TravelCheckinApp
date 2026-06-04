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

interface ReminderItem {
  id: number;
  booking_id: number;
  location_name: string;
  service_name: string;
  check_in_date: string;
  notes: string | null;
  service_type: string;
}

export default function BookingRemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  const fetchReminders = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await axiosClient.get('/user/booking-reminders');
      setReminders(res.data.data || []);
    } catch (err) {
      console.log('Error fetching booking reminders', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const formatDisplayDateTime = (value: string): string => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dt.getFullYear());
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} lúc ${hh}:${min}`;
  };

  const getServiceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'room': return 'bed-outline';
      case 'table': return 'restaurant-outline';
      default: return 'calendar-outline';
    }
  };

  const getServiceColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'room': return '#6366f1';
      case 'table': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const renderItem = ({ item }: { item: ReminderItem }) => {
    const iconColor = getServiceColor(item.service_type);
    const isSystemNote = item.notes?.startsWith('[SYSTEM]');
    const displayNotes = isSystemNote 
      ? item.notes?.replace('[SYSTEM]', '').trim() 
      : item.notes;

    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}10` }]}>
          <Ionicons name={getServiceIcon(item.service_type) as any} size={24} color={iconColor} />
        </View>

        <View style={styles.info}>
          <Text style={styles.locName} numberOfLines={1}>{item.location_name}</Text>
          <Text style={styles.srvName}>{item.service_name}</Text>
          
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color="#64748b" />
            <Text style={styles.timeText}>{formatDisplayDateTime(item.check_in_date)}</Text>
          </View>

          {item.notes && (
            <View style={[styles.notesBox, isSystemNote && styles.systemNotesBox]}>
              <Text style={[styles.notesText, isSystemNote && styles.systemNotesText]} numberOfLines={3}>
                {isSystemNote ? `Lưu ý hệ thống: "${displayNotes}"` : `Yêu cầu: "${displayNotes}"`}
              </Text>
            </View>
          )}
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
        <Text style={styles.headerTitle}>Nhắc lịch</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#14b8a6" />
          <Text style={styles.loadingText}>Đang tải nhắc lịch...</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item, index) => (item.id || index).toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchReminders(true)} colors={['#14b8a6']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-clear-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Danh sách nhắc lịch trống</Text>
              <Text style={styles.emptySubtitle}>Bạn không có nhắc lịch đặt chỗ nào chuẩn bị diễn ra trong ngày hôm nay hoặc sắp tới.</Text>
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
    padding: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  info: { flex: 1 },
  locName: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  srvName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginTop: 3, marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 12, color: '#475569', fontWeight: '600', marginLeft: 4 },
  notesBox: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  notesText: { fontSize: 11, color: '#64748b', fontStyle: 'italic' },
  systemNotesBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  systemNotesText: {
    color: '#b45309',
    fontWeight: '500',
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 120, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
