import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../api/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';
import { buildVietQrImageUrl } from '../../utils/vietqr';

const { width } = Dimensions.get('window');

interface ServiceDetail {
  service_id: number;
  service_name: string;
  service_type: 'room' | 'table' | 'ticket' | 'food' | 'combo' | 'other';
  price: number | string;
  description?: string;
}

interface LocationDetail {
  location_id: number;
  location_name: string;
  address: string;
}

export default function BookingScreen() {
  const { serviceId, locationId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  // States
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [service, setService] = useState<ServiceDetail | null>(null);

  // Form Fields
  const [contactName, setContactName] = useState(user?.full_name || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState(''); // Chỉ dùng cho phòng khách sạn
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  
  // Payment States
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<{
    bookingId: number;
    amount: number;
    bankName: string;
    bankAccount: string;
    accountHolder: string;
  } | null>(null);

  // Success invoice state (View-and-disappear)
  const [successInvoice, setSuccessInvoice] = useState<{
    bookingId: number;
    amount: number;
    date: string;
  } | null>(null);

  // Khởi tạo ngày đặt chỗ mặc định
  useEffect(() => {
    const today = new Date();
    // checkIn: Hôm nay lúc 19:00
    const checkInStr = today.toISOString().split('T')[0] + ' 19:00:00';
    setCheckInDate(checkInStr);

    // checkOut: Ngày mai lúc 12:00
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const checkOutStr = tomorrow.toISOString().split('T')[0] + ' 12:00:00';
    setCheckOutDate(checkOutStr);
  }, []);

  // Tải chi tiết dịch vụ & địa điểm
  const fetchBookingInfo = useCallback(async () => {
    if (!serviceId || !locationId) return;
    try {
      setLoading(true);
      const [locRes, servicesRes] = await Promise.all([
        axiosClient.get(`/locations/${locationId}`),
        axiosClient.get(`/locations/${locationId}/services`),
      ]);

      setLocation(locRes.data.data);
      const sList: ServiceDetail[] = servicesRes.data.data || [];
      const found = sList.find(s => Number(s.service_id) === Number(serviceId));
      setService(found || null);
    } catch (error) {
      console.log('Error loading booking page info', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin dịch vụ đặt trước.');
    } finally {
      setLoading(false);
    }
  }, [serviceId, locationId]);

  useEffect(() => {
    fetchBookingInfo();
  }, [fetchBookingInfo]);

  // Tạo đơn đặt chỗ
  const handleCreateBooking = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên và số điện thoại liên lạc.');
      return;
    }
    if (!checkInDate.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập thời gian Check-in.');
      return;
    }

    try {
      setSubmittingBooking(true);

      const payload: any = {
        location_id: Number(locationId),
        service_id: Number(serviceId),
        check_in_date: checkInDate,
        quantity: quantity,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        notes: notes.trim(),
        source: 'mobile',
      };

      if (service?.service_type === 'room') {
        payload.check_out_date = checkOutDate;
      }
      if (voucherCode.trim()) {
        payload.voucher_code = voucherCode.trim().toUpperCase();
      }

      // 1. Tạo đơn đặt trước trên backend
      const res = await axiosClient.post('/bookings', payload);
      
      if (res.data && res.data.success) {
        const bookingId = res.data.data.booking_id;
        
        // 2. Gọi API lấy thông tin thanh toán VietQR của Owner
        const payRes = await axiosClient.post(`/bookings/${bookingId}/payments`);
        if (payRes.data && payRes.data.success) {
          const p = payRes.data.data;
          setCreatedBooking({
            bookingId: bookingId,
            amount: Number(p.amount),
            bankName: p.bankName || p.bank_name,
            bankAccount: p.bankAccount || p.bank_account,
            accountHolder: p.accountHolder || p.account_holder,
          });
        } else {
          Alert.alert('Thành công', 'Đơn đặt chỗ đã được tạo. Bạn có thể thanh toán sau trong mục Vé của tôi.');
          router.replace('/(tabs)/tickets');
        }
      }
    } catch (err: any) {
      console.log('Lỗi tạo đơn hàng', err);
      Alert.alert('Đặt chỗ thất bại', err.response?.data?.message || 'Không thể tạo đơn đặt trước lúc này.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Xác nhận chuyển khoản VietQR thành công
  const handleConfirmTransfer = async () => {
    if (!createdBooking || !service) return;
    const { bookingId, amount } = createdBooking;

    try {
      setSubmittingBooking(true);
      let endpoint = '';
      if (service.service_type === 'room') {
        endpoint = `/bookings/${bookingId}/rooms/confirm-transfer`;
      } else if (service.service_type === 'table') {
        endpoint = `/bookings/${bookingId}/tables/confirm-transfer`;
      } else {
        endpoint = `/bookings/${bookingId}/tickets/confirm-transfer`;
      }

      const confirmRes = await axiosClient.post(endpoint);
      if (confirmRes.data && confirmRes.data.success) {
        // Tắt modal VietQR thanh toán
        setCreatedBooking(null);
        // Hiển thị hóa đơn thành công (View-and-disappear)
        setSuccessInvoice({
          bookingId: bookingId,
          amount: amount,
          date: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
        });
      } else {
        Alert.alert('Chưa nhận được giao dịch', confirmRes.data.message || 'Hệ thống chưa nhận được tiền. Vui lòng chờ 1-2 phút rồi nhấn lại.');
      }
    } catch (err: any) {
      console.log('Lỗi xác nhận chuyển khoản', err);
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể gửi xác nhận lúc này.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Đóng hóa đơn thành công -> Chuyển sang màn hình quản lý vé QR chính thức
  const handleCloseSuccessInvoice = () => {
    setSuccessInvoice(null);
    router.replace('/(tabs)/tickets');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={styles.loadingText}>Đang tải thông tin dịch vụ...</Text>
      </View>
    );
  }

  if (!service || !location) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="close-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Không tìm thấy thông tin dịch vụ này.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sPrice = Number(service.price);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt dịch vụ trực tuyến</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Service Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.locName}>{location.location_name}</Text>
          <Text style={styles.srvName}>{service.service_name}</Text>
          <Text style={styles.srvPrice}>
            {sPrice > 0 ? `${sPrice.toLocaleString()}đ` : 'Miễn phí đặt trước'}
          </Text>
        </View>

        {/* Booking Form */}
        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Thông tin liên hệ</Text>
          
          <Text style={styles.inputLabel}>Họ và tên khách hàng</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập họ và tên..."
            value={contactName}
            onChangeText={setContactName}
          />

          <Text style={styles.inputLabel}>Số điện thoại liên lạc</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập số điện thoại..."
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />

          <View style={styles.divider} />

          <Text style={styles.formSectionTitle}>Thông tin lịch trình</Text>

          <Text style={styles.inputLabel}>Thời gian Check-in (YYYY-MM-DD HH:mm:ss)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ví dụ: 2026-06-04 19:00:00"
            value={checkInDate}
            onChangeText={setCheckInDate}
          />

          {service.service_type === 'room' && (
            <>
              <Text style={styles.inputLabel}>Thời gian Check-out (YYYY-MM-DD HH:mm:ss)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 2026-06-05 12:00:00"
                value={checkOutDate}
                onChangeText={setCheckOutDate}
              />
            </>
          )}

          {/* Quantity Counter */}
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>
              {service.service_type === 'room' ? 'Số lượng phòng đặt:' : (service.service_type === 'table' ? 'Số lượng khách đi:' : 'Số lượng vé mua:')}
            </Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={18} color="#1e293b" />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={18} color="#1e293b" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.inputLabel}>Mã giảm giá Voucher (nếu có)</Text>
          <TextInput
            style={[styles.textInput, styles.codeFormat]}
            placeholder="Ví dụ: TRAVEL10"
            autoCapitalize="characters"
            value={voucherCode}
            onChangeText={setVoucherCode}
          />

          <Text style={styles.inputLabel}>Ghi chú bổ sung</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Nhập ghi chú yêu cầu riêng (không bắt buộc)..."
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Pricing estimation box */}
        <View style={styles.priceEstimationCard}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Tạm tính ({quantity} phần):</Text>
            <Text style={styles.estimateValue}>{(sPrice * quantity).toLocaleString()}đ</Text>
          </View>
          <Text style={styles.estimateNote}>
            * Tổng giá tiền chưa trừ giảm giá voucher và sẽ hiển thị chính xác khi sinh hóa đơn.
          </Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleCreateBooking}
          disabled={submittingBooking}
        >
          {submittingBooking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Tiến hành thanh toán</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* 1. Modal VietQR thanh toán (sinh ngay sau khi đặt thành công) */}
      <Modal visible={!!createdBooking} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            {createdBooking && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Hóa đơn thanh toán chuyển khoản</Text>
                  <TouchableOpacity onPress={() => {
                    setCreatedBooking(null);
                    router.replace('/(tabs)/tickets');
                  }}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.paymentScrollBody}>
                  <Text style={styles.paymentLocation}>{location.location_name}</Text>
                  
                  <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Số tiền cần thanh toán:</Text>
                    <Text style={styles.amountValue}>{createdBooking.amount.toLocaleString()}đ</Text>
                  </View>

                  {/* Render mã VietQR */}
                  {buildVietQrImageUrl({
                    bankName: createdBooking.bankName,
                    bankAccount: createdBooking.bankAccount,
                    accountHolder: createdBooking.accountHolder,
                    amount: createdBooking.amount,
                    addInfo: `BK-${createdBooking.bookingId}`,
                  }).url ? (
                    <View style={styles.vietQrImageContainer}>
                      <Image
                        source={{
                          uri: buildVietQrImageUrl({
                            bankName: createdBooking.bankName,
                            bankAccount: createdBooking.bankAccount,
                            accountHolder: createdBooking.accountHolder,
                            amount: createdBooking.amount,
                            addInfo: `BK-${createdBooking.bookingId}`,
                          }).url!,
                        }}
                        style={styles.vietQrImage}
                      />
                    </View>
                  ) : (
                    <View style={styles.paymentErrorContainer}>
                      <Text style={styles.paymentErrorText}>Không thể tạo mã VietQR do thiếu thông tin ngân hàng Chủ cơ sở.</Text>
                    </View>
                  )}

                  {/* Chi tiết chuyển khoản */}
                  <View style={styles.bankDetailsContainer}>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Ngân hàng:</Text>
                      <Text style={styles.bankDetailValue}>{createdBooking.bankName.toUpperCase()}</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Số tài khoản:</Text>
                      <Text style={styles.bankDetailValue}>{createdBooking.bankAccount}</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Chủ tài khoản:</Text>
                      <Text style={styles.bankDetailValue}>{createdBooking.accountHolder}</Text>
                    </View>
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Nội dung chuyển:</Text>
                      <Text style={[styles.bankDetailValue, styles.highlightText]}>BK-{createdBooking.bookingId}</Text>
                    </View>
                  </View>

                  <View style={styles.warningBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                    <Text style={styles.warningText}>
                      Nhập đúng nội dung "BK-{createdBooking.bookingId}" để hệ thống tự động hoàn tất vé check-in ngay.
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.confirmPaymentBtn} onPress={handleConfirmTransfer}>
                    <Text style={styles.confirmPaymentBtnText}>Xác nhận đã chuyển khoản</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. Màn hình hóa đơn tạm thời thành công (View-and-disappear) */}
      <Modal visible={!!successInvoice} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successInvoiceContent}>
            {successInvoice && (
              <>
                <View style={styles.successHeader}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={32} color="#ffffff" />
                  </View>
                  <Text style={styles.successTitle}>Thanh toán thành công!</Text>
                  <Text style={styles.successSubtitle}>Hóa đơn của bạn đã hoàn tất xử lý</Text>
                </View>

                <View style={styles.invoiceDivider} />

                <View style={styles.invoiceBody}>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Mã hóa đơn:</Text>
                    <Text style={styles.invoiceValue}>#BK-{successInvoice.bookingId}</Text>
                  </View>
                  
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Địa điểm dịch vụ:</Text>
                    <Text style={styles.invoiceValue}>{location.location_name}</Text>
                  </View>

                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Thời gian:</Text>
                    <Text style={styles.invoiceValue}>{successInvoice.date}</Text>
                  </View>

                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Số tiền đã trả:</Text>
                    <Text style={[styles.invoiceValue, styles.invoiceHighlight]}>{successInvoice.amount.toLocaleString()}đ</Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                <Text style={styles.successFooterText}>
                  Chiếc vé check-in chứa mã QR Code chính thức đã được chuyển vào mục Vé của tôi.
                </Text>

                <TouchableOpacity style={styles.successCloseBtn} onPress={handleCloseSuccessInvoice}>
                  <Text style={styles.successCloseText}>Đóng & Xem vé QR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#64748b', marginBottom: 20 },
  backBtn: { backgroundColor: '#14b8a6', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: 'bold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBackBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { padding: 16, paddingBottom: 50 },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  locName: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  srvName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginVertical: 6 },
  srvPrice: { fontSize: 15, fontWeight: '900', color: '#14b8a6' },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  formSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 6 },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  codeFormat: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8, marginBottom: 16 },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  counterRow: { flexDirection: 'row', alignItems: 'center' },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, color: '#0f172a' },
  priceEstimationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estimateLabel: { fontSize: 13, color: '#475569', fontWeight: 'bold' },
  estimateValue: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  estimateNote: { fontSize: 10, color: '#94a3b8', marginTop: 8, lineHeight: 14 },
  submitBtn: {
    backgroundColor: '#14b8a6',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paymentModalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  paymentScrollBody: { padding: 20 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  paymentLocation: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 10 },
  amountContainer: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  amountLabel: { fontSize: 12, color: '#b45309', fontWeight: '500' },
  amountValue: { fontSize: 24, fontWeight: '900', color: '#b45309', marginTop: 4 },
  vietQrImageContainer: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  vietQrImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  paymentErrorContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  paymentErrorText: { fontSize: 13, color: '#ef4444', fontWeight: '600', textAlign: 'center' },
  bankDetailsContainer: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  bankDetailLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  bankDetailValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  highlightText: { color: '#2563eb' },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#b45309',
    marginLeft: 6,
    lineHeight: 16,
    fontWeight: '500',
  },
  confirmPaymentBtn: {
    backgroundColor: '#14b8a6',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginTop: 10,
  },
  confirmPaymentBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  successInvoiceContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successHeader: { alignItems: 'center', marginBottom: 20 },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  successSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  invoiceDivider: { width: '100%', height: 1, backgroundColor: '#e2e8f0' },
  invoiceBody: { width: '100%', paddingVertical: 16 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  invoiceLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  invoiceValue: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  invoiceHighlight: { color: '#10b981', fontSize: 16 },
  successFooterText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  successCloseBtn: {
    backgroundColor: '#1e293b',
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCloseText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});
