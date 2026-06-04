// app/(tabs)/tickets.tsx
// Ve cua toi: ve du lich, dat ban, dat phong voi QR code va VietQR payment

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Modal,
  StyleSheet, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { USER_API, BOOKINGS_API } from '../../api/endpoints';
import { buildVietQrImageUrl } from '../../utils/vietqr';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import SegmentedControl from '../../components/SegmentedControl';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Header from '../../components/Header';
import type { Ticket, TablePass, RoomPass, Payment } from '../../types';

// Mau sac trang thai
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'muted' | 'info'> = {
  active: 'success', confirmed: 'success', paid: 'success', completed: 'success',
  pending: 'warning',
  used: 'muted', expired: 'muted', cancelled: 'muted', failed: 'error',
};

export default function TicketsScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tablePasses, setTablePasses] = useState<TablePass[]>([]);
  const [roomPasses, setRoomPasses] = useState<RoomPass[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // QR modal
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQrValue] = useState('');

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentBookingId, setPaymentBookingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tkRes, tpRes, rpRes] = await Promise.all([
        axiosClient.get(USER_API.TICKETS),
        axiosClient.get(BOOKINGS_API.TABLE_RESERVATIONS_PASS).catch(() => ({ data: [] })),
        axiosClient.get(BOOKINGS_API.ROOM_RESERVATIONS_PASS).catch(() => ({ data: [] })),
      ]);
      setTickets(tkRes.data.data || tkRes.data || []);
      setTablePasses(tpRes.data.data || tpRes.data || []);
      setRoomPasses(rpRes.data.data || rpRes.data || []);
    } catch {
      // Giu trang thai cu
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const showQRCode = (code: string) => {
    setQrValue(code);
    setShowQR(true);
  };

  const handlePayment = async (bookingId: number) => {
    try {
      const payRes = await axiosClient.post(BOOKINGS_API.PAYMENT(bookingId));
      setPayment(payRes.data.data || payRes.data);
      setPaymentBookingId(bookingId);
      setShowPayment(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo thanh toán');
    }
  };

  const handleConfirmTransfer = async (type: 'ticket' | 'table' | 'room') => {
    if (!paymentBookingId) return;
    setConfirming(true);
    try {
      if (type === 'ticket') await axiosClient.post(BOOKINGS_API.CONFIRM_TICKETS(paymentBookingId));
      else if (type === 'table') await axiosClient.post(BOOKINGS_API.CONFIRM_TABLES(paymentBookingId));
      else await axiosClient.post(BOOKINGS_API.CONFIRM_ROOMS(paymentBookingId));
      setShowPayment(false);
      setShowSuccess(true);
      await fetchData();
    } catch {
      Alert.alert('Lỗi', 'Không thể xác nhận chuyển khoản');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async (bookingId: number) => {
    Alert.alert('Hủy đặt chỗ', 'Bạn có chắc muốn hủy?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đặt chỗ',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosClient.post(BOOKINGS_API.CANCEL(bookingId));
            await fetchData();
          } catch {
            Alert.alert('Lỗi', 'Không thể hủy');
          }
        },
      },
    ]);
  };

  const qrUrl = payment
    ? buildVietQrImageUrl({
        bankName: payment.bank_name,
        bankAccount: payment.bank_account,
        accountHolder: payment.account_holder,
        amount: payment.amount,
        addInfo: payment.transaction_content,
      })
    : null;

  const TABS = ['Vé du lịch', 'Đặt bàn', 'Đặt phòng'];

  return (
    <View style={styles.container}>
      <Header title="Vé của tôi" showBack={false} />
      <View style={styles.segmentWrap}>
        <SegmentedControl options={TABS} selected={activeTab} onChange={setActiveTab} />
      </View>

      {/* Ticket list */}
      {activeTab === 0 && (
        tickets.length === 0 ? (
          <EmptyState icon="ticket-outline" title="Chưa có vé nào" description="Hãy đặt vé du lịch!" />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.ticket_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.ticket_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.service_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                <Text style={styles.ticketLocation}>{item.location_name}</Text>
                <Text style={styles.ticketCode}>{item.ticket_code}</Text>
                <Text style={styles.ticketDate}>{item.use_date ? `Ngày sử dụng: ${item.use_date}` : ''}</Text>
                {item.payment_status === 'pending' && item.booking_id && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* Table passes */}
      {activeTab === 1 && (
        tablePasses.length === 0 ? (
          <EmptyState icon="restaurant-outline" title="Chưa có đặt bàn" description="Hãy đặt bàn nhà hàng!" />
        ) : (
          <FlatList
            data={tablePasses}
            keyExtractor={(item) => String(item.booking_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.secure_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.location_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                {item.table_names && <Text style={styles.ticketLocation}>Bàn: {item.table_names}</Text>}
                <Text style={styles.ticketCode}>{item.secure_code}</Text>
                <Text style={styles.ticketDate}>Check-in: {item.check_in_date}</Text>
                {item.payment_status === 'pending' && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* Room passes */}
      {activeTab === 2 && (
        roomPasses.length === 0 ? (
          <EmptyState icon="bed-outline" title="Chưa có đặt phòng" description="Hãy đặt phòng khách sạn!" />
        ) : (
          <FlatList
            data={roomPasses}
            keyExtractor={(item) => String(item.booking_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.secure_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.location_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                <Text style={styles.ticketLocation}>{item.check_in_date} → {item.check_out_date}</Text>
                <Text style={styles.ticketCode}>{item.secure_code}</Text>
                {item.payment_status === 'pending' && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* QR Code Modal */}
      <Modal visible={showQR} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Mã QR</Text>
            {qrValue ? <QRCode value={qrValue} size={220} /> : null}
            <Text style={styles.qrCode}>{qrValue}</Text>
            <Button title="Đóng" onPress={() => setShowQR(false)} variant="outline" style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide">
        <View style={styles.paymentModal}>
          <Header title="Thanh toán" rightIcon="close" onRightPress={() => setShowPayment(false)} />
          <ScrollView contentContainerStyle={styles.paymentContent}>
            {qrUrl?.url && <Image source={{ uri: qrUrl.url }} style={styles.qrImage} resizeMode="contain" />}
            {payment && (
              <Card>
                <Text style={styles.bankName}>{payment.bank_name}</Text>
                <Text style={styles.bankAccount}>{payment.bank_account}</Text>
                <Text style={styles.accountHolder}>{payment.account_holder}</Text>
                <Text style={styles.amount}>{payment.amount?.toLocaleString()}đ</Text>
                <Text style={styles.transferContent}>{payment.transaction_content}</Text>
              </Card>
            )}
            <Button
              title="Xác nhận đã chuyển khoản"
              onPress={() => handleConfirmTransfer(activeTab === 0 ? 'ticket' : activeTab === 1 ? 'table' : 'room')}
              loading={confirming}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successTitle}>Xác nhận thành công!</Text>
            <Button title="Đóng" onPress={() => setShowSuccess(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentWrap: { padding: spacing.md },
  list: { padding: spacing.md, paddingBottom: 100 },
  ticketCard: { marginBottom: spacing.sm },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  ticketLocation: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  ticketCode: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary, marginTop: spacing.sm, letterSpacing: 1 },
  ticketDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  qrCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%' },
  qrTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
  qrCode: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  paymentModal: { flex: 1, backgroundColor: colors.background },
  paymentContent: { padding: spacing.md, alignItems: 'center' },
  qrImage: { width: 280, height: 280, marginBottom: spacing.lg },
  bankName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  bankAccount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  accountHolder: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.error, marginTop: spacing.sm },
  transferContent: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  successCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%' },
  successTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md },
});
