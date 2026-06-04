// app/booking/[serviceId].tsx
// Form dat cho: ticket/table/room, VietQR payment, xac nhan chuyen khoan

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, BOOKINGS_API } from '../../api/endpoints';
import { buildVietQrImageUrl } from '../../utils/vietqr';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Badge from '../../components/Badge';
import LoadingOverlay from '../../components/LoadingOverlay';
import type { Location, Service, Payment } from '../../types';

export default function BookingScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const svcId = Number(serviceId);
  const router = useRouter();

  const [service, setService] = useState<Service | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Trang thai form
  const [quantity, setQuantity] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [notes, setNotes] = useState('');
  const [voucherCode, setVoucherCode] = useState('');

  // Trang thai thanh toan
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Tim service tu tat ca locations
  useEffect(() => {
    const fetch = async () => {
      try {
        const allLocs = await axiosClient.get(LOCATIONS_API.LIST);
        const locs = allLocs.data.data || allLocs.data || [];
        for (const loc of locs) {
          const svcRes = await axiosClient.get(LOCATIONS_API.SERVICES(loc.location_id));
          const svcs = svcRes.data.data || svcRes.data || [];
          const found = svcs.find((s: Service) => s.service_id === svcId);
          if (found) {
            setService(found);
            setLocation(loc);
            break;
          }
        }
      } catch {
        Alert.alert('Lỗi', 'Không thể tải thông tin dịch vụ');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [svcId]);

  // Tao don dat cho va payment
  const handleBooking = async () => {
    if (!service || !location) return;
    if (!contactName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên liên hệ');
      return;
    }
    if (!contactPhone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        location_id: location.location_id,
        service_id: service.service_id,
        check_in_date: checkInDate,
        quantity,
        source: 'mobile',
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
      };
      if (checkOutDate) payload.check_out_date = checkOutDate;
      if (notes.trim()) payload.notes = notes.trim();
      if (voucherCode.trim()) payload.voucher_code = voucherCode.trim();

      const res = await axiosClient.post(BOOKINGS_API.CREATE, payload);
      const newBookingId = res.data.bookingId || res.data.data?.bookingId;
      setBookingId(newBookingId);

      // Tao payment
      const payRes = await axiosClient.post(BOOKINGS_API.PAYMENT(newBookingId));
      setPayment(payRes.data.data || payRes.data);
      setShowPayment(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không thể tạo đặt chỗ';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Xac nhan da chuyen khoan
  const handleConfirmTransfer = async () => {
    if (!bookingId || !service) return;
    setConfirming(true);
    try {
      const svcType = service.service_type;
      if (svcType === 'ticket') {
        await axiosClient.post(BOOKINGS_API.CONFIRM_TICKETS(bookingId));
      } else if (svcType === 'table') {
        await axiosClient.post(BOOKINGS_API.CONFIRM_TABLES(bookingId));
      } else {
        await axiosClient.post(BOOKINGS_API.CONFIRM_ROOMS(bookingId));
      }
      setShowPayment(false);
      setShowSuccess(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể xác nhận chuyển khoản');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <LoadingOverlay visible message="Đang tải..." />;
  if (!service || !location) {
    return (
      <View style={styles.container}>
        <Header title="Lỗi" />
        <Text style={styles.errorText}>Không tìm thấy dịch vụ</Text>
      </View>
    );
  }

  // Tao URL VietQR tu thong tin payment
  const qrResult = payment
    ? buildVietQrImageUrl({
        bankName: payment.bank_name,
        bankAccount: payment.bank_account,
        accountHolder: payment.account_holder,
        amount: payment.amount,
        addInfo: payment.transaction_content,
      })
    : null;

  return (
    <View style={styles.container}>
      <Header title="Đặt chỗ" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Thong tin dich vu */}
        <Card>
          <Text style={styles.svcName}>{service.service_name}</Text>
          <Badge text={service.service_type} variant="info" />
          <Text style={styles.svcPrice}>{(service.price ?? 0).toLocaleString()}đ</Text>
          <Text style={styles.locName}>{location.location_name}</Text>
        </Card>

        {/* Form dat cho */}
        <Card style={{ marginTop: spacing.md }}>
          <Input
            label="Tên liên hệ *"
            value={contactName}
            onChangeText={setContactName}
            leftIcon="person"
          />
          <Input
            label="Số điện thoại *"
            value={contactPhone}
            onChangeText={setContactPhone}
            leftIcon="call"
            keyboardType="phone-pad"
          />
          <Input
            label="Ngày check-in"
            value={checkInDate}
            onChangeText={setCheckInDate}
            leftIcon="calendar"
          />
          {service.service_type === 'room' && (
            <Input
              label="Ngày check-out"
              value={checkOutDate}
              onChangeText={setCheckOutDate}
              leftIcon="calendar"
            />
          )}

          {/* Bo dem so luong */}
          <Text style={styles.label}>Số lượng</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.min(50, quantity + 1))}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Input
            label="Mã voucher"
            value={voucherCode}
            onChangeText={setVoucherCode}
            leftIcon="ticket"
          />
          <Input
            label="Ghi chú"
            value={notes}
            onChangeText={setNotes}
            leftIcon="document-text"
            multiline
          />
        </Card>

        {/* Tong tien */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalValue}>
              {((service.price ?? 0) * quantity).toLocaleString()}đ
            </Text>
          </View>
        </Card>

        <Button
          title="Đặt chỗ"
          onPress={handleBooking}
          loading={submitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>

      {/* Modal thanh toan VietQR */}
      <Modal visible={showPayment} animationType="slide">
        <View style={styles.paymentModal}>
          <Header
            title="Thanh toán"
            onRightPress={() => setShowPayment(false)}
            rightIcon="close"
          />
          <ScrollView contentContainerStyle={styles.paymentContent}>
            {qrResult?.url && (
              <Image
                source={{ uri: qrResult.url }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            )}
            {payment && (
              <Card>
                <Text style={styles.bankName}>{payment.bank_name}</Text>
                <Text style={styles.bankAccount}>{payment.bank_account}</Text>
                <Text style={styles.accountHolder}>{payment.account_holder}</Text>
                <Text style={styles.amount}>
                  {payment.amount?.toLocaleString()}đ
                </Text>
                <Text style={styles.transferContent}>
                  {payment.transaction_content}
                </Text>
              </Card>
            )}
            <Button
              title="Xác nhận đã chuyển khoản"
              onPress={handleConfirmTransfer}
              loading={confirming}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal thanh cong */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successTitle}>Đặt chỗ thành công!</Text>
            <Text style={styles.successText}>Mã đặt chỗ: #{bookingId}</Text>
            <Button
              title="Xem vé"
              onPress={() => {
                setShowSuccess(false);
                router.replace('/(tabs)/tickets');
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  errorText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  svcName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  svcPrice: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  locName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  paymentModal: { flex: 1, backgroundColor: colors.background },
  paymentContent: { padding: spacing.md, alignItems: 'center' },
  qrImage: { width: 280, height: 280, marginBottom: spacing.lg },
  bankName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bankAccount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  accountHolder: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  amount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.error,
    marginTop: spacing.sm,
  },
  transferContent: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  successText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
