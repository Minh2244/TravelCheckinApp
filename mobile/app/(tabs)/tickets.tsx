import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import axiosClient from '../../api/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';
import { buildVietQrImageUrl } from '../../utils/vietqr';

type TicketTab = 'tourist' | 'restaurant' | 'hotel';

interface BaseBooking {
  bookingId: number;
  locationName: string;
  bookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalAmount: number | string;
  secureCode?: string;
  contactName?: string;
  contactPhone?: string;
  checkInDate?: string;
  qrPayload?: string;
}

// Interface của từng loại vé
interface TouristTicket {
  ticket_id: number;
  booking_id: number;
  service_id: number;
  ticket_code: string;
  status: 'unused' | 'used' | 'void';
  service_name: string;
  location_name: string;
  check_in_date: string;
}

interface TableReservation extends BaseBooking {
  tableNames?: string[];
  startTime?: string;
  canCancel?: boolean;
}

interface RoomReservation extends BaseBooking {
  roomNames?: string[];
  checkOutDate?: string;
  nightCount?: number;
  canCancel?: boolean;
}

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  
  // Segmented Tabs State
  const [activeTab, setActiveTab] = useState<TicketTab>('tourist');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Data states
  const [touristTickets, setTouristTickets] = useState<TouristTicket[]>([]);
  const [tablePasses, setTablePasses] = useState<TableReservation[]>([]);
  const [roomPasses, setRoomPasses] = useState<RoomReservation[]>([]);

  // Modal QR Code Check-in
  const [selectedTicket, setSelectedTicket] = useState<TouristTicket | null>(null);
  const [selectedTablePass, setSelectedTablePass] = useState<TableReservation | null>(null);
  const [selectedRoomPass, setSelectedRoomPass] = useState<RoomReservation | null>(null);

  // VietQR Invoice State
  const [selectedUnpaidBooking, setSelectedUnpaidBooking] = useState<{
    id: number;
    locationName: string;
    amount: number;
    type: 'tourist' | 'restaurant' | 'hotel';
    bankName: string;
    bankAccount: string;
    accountHolder: string;
  } | null>(null);

  // Temporary Success Invoice Summary Screen Overlay (View-and-disappear)
  const [successInvoice, setSuccessInvoice] = useState<{
    bookingId: number;
    locationName: string;
    amount: number;
    date: string;
  } | null>(null);

  // Fetch all passes
  const fetchAllPasses = useCallback(async (isRefresh = false) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const [tourRes, tableRes, roomRes] = await Promise.all([
        axiosClient.get('/user/tickets').catch(() => ({ data: { data: [] } })),
        axiosClient.get('/bookings/table-reservations/pass').catch(() => ({ data: { data: [] } })),
        axiosClient.get('/bookings/room-reservations/pass').catch(() => ({ data: { data: [] } })),
      ]);

      setTouristTickets(tourRes.data.data || []);
      setTablePasses(tableRes.data.data || []);
      setRoomPasses(roomRes.data.data || []);
    } catch (error) {
      console.log('Lỗi khi tải dữ liệu vé:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPasses();
  }, [fetchAllPasses]);

  // Nhận diện click vào card để xử lý QR hoặc thanh toán VietQR
  const handleCardPress = async (item: any, type: 'tourist' | 'restaurant' | 'hotel') => {
    // 1. Nếu là vé tourist
    if (type === 'tourist') {
      setSelectedTicket(item);
      return;
    }

    // 2. Nếu là đặt bàn hoặc khách sạn
    const bookingId = Number(item.bookingId);
    
    // Nếu trạng thái là 'pending' (chưa thanh toán / chờ chuyển khoản)
    if (item.bookingStatus === 'pending') {
      try {
        setIsLoading(true);
        // Gọi API lấy thông tin thanh toán & VietQR ngân hàng của Owner địa điểm đó
        const paymentRes = await axiosClient.post(`/bookings/${bookingId}/payments`);
        if (paymentRes.data && paymentRes.data.success) {
          const p = paymentRes.data.data;
          setSelectedUnpaidBooking({
            id: bookingId,
            locationName: item.locationName,
            amount: Number(p.amount),
            type: type,
            bankName: p.bankName || p.bank_name,
            bankAccount: p.bankAccount || p.bank_account,
            accountHolder: p.accountHolder || p.account_holder,
          });
        } else {
          Alert.alert('Lỗi', 'Không thể lấy thông tin thanh toán của hóa đơn này.');
        }
      } catch (err) {
        console.log('Lỗi lấy thông tin thanh toán', err);
        Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ thanh toán.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Đã được duyệt/thanh toán -> hiển thị QR Code check-in
      if (type === 'restaurant') setSelectedTablePass(item);
      if (type === 'hotel') setSelectedRoomPass(item);
    }
  };

  // Xác nhận đã chuyển khoản (Confirm Transfer)
  const handleConfirmTransfer = async () => {
    if (!selectedUnpaidBooking) return;
    const { id, type, locationName, amount } = selectedUnpaidBooking;

    try {
      setIsLoading(true);
      let res: any;
      if (type === 'restaurant') {
        res = await axiosClient.post(`/bookings/${id}/tables/confirm-transfer`);
      } else if (type === 'hotel') {
        res = await axiosClient.post(`/bookings/${id}/rooms/confirm-transfer`);
      } else {
        res = await axiosClient.post(`/bookings/${id}/tickets/confirm-transfer`);
      }

      if (res.data && res.data.success) {
        // Tắt modal VietQR thanh toán
        setSelectedUnpaidBooking(null);

        // Hiển thị hóa đơn tạm thời thành công (View-and-disappear)
        setSuccessInvoice({
          bookingId: id,
          locationName: locationName,
          amount: amount,
          date: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
        });
      } else {
        Alert.alert('Xác nhận thất bại', res.data.message || 'Chưa nhận được giao dịch. Vui lòng thử lại sau ít phút.');
      }
    } catch (err: any) {
      console.log('Xác nhận chuyển khoản thất bại', err);
      Alert.alert('Xác nhận thất bại', err.response?.data?.message || 'Không thể gửi xác nhận.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tắt hóa đơn thành công -> Hóa đơn biến mất vĩnh viễn và cập nhật danh sách vé QR
  const handleCloseSuccessInvoice = () => {
    setSuccessInvoice(null);
    fetchAllPasses(); // Reload để nhận vé QR chính thức
  };

  // Hủy đặt chỗ
  const handleCancelBooking = (bookingId: number) => {
    Alert.alert(
      'Xác nhận hủy đặt chỗ?',
      'Bạn có chắc chắn muốn hủy đặt phòng/bàn này lập tức và giải phóng chỗ ăn nghỉ không?',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Đồng ý hủy',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const res = await axiosClient.post(`/bookings/${bookingId}/cancel`);
              if (res.data && res.data.success) {
                Alert.alert('Thành công', 'Đơn đặt chỗ của bạn đã được hủy bỏ và giải phóng.');
                fetchAllPasses();
              } else {
                Alert.alert('Lỗi', res.data.message || 'Không thể hủy đơn đặt chỗ.');
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Hủy đơn đặt chỗ thất bại.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDisplayDateTime = (value: string | null | undefined): string => {
    if (!value) return '';
    const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
    const dt = new Date(normalized);
    if (Number.isNaN(dt.getTime())) return value;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dt.getFullYear());
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  };

  const statusMeta = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Chờ thanh toán', bg: '#fef3c7', color: '#d97706', icon: 'time-outline' };
      case 'confirmed':
        return { label: 'Đã thanh toán', bg: '#dcfce7', color: '#15803d', icon: 'checkmark-circle-outline' };
      case 'completed':
        return { label: 'Đã sử dụng', bg: '#f1f5f9', color: '#64748b', icon: 'checkbox-outline' };
      case 'cancelled':
        return { label: 'Đã hủy', bg: '#fee2e2', color: '#b91c1c', icon: 'close-circle-outline' };
      default:
        return { label: 'Chưa dùng', bg: '#e0f2fe', color: '#0369a1', icon: 'ticket-outline' };
    }
  };

  const renderTouristTicket = ({ item }: { item: TouristTicket }) => {
    const isUnused = item.status === 'unused';
    const bg = isUnused ? '#e0f2fe' : (item.status === 'used' ? '#f1f5f9' : '#fee2e2');
    const color = isUnused ? '#0369a1' : (item.status === 'used' ? '#64748b' : '#b91c1c');

    return (
      <TouchableOpacity
        style={[styles.ticketCard, item.status !== 'unused' && styles.cardDisabled]}
        onPress={() => handleCardPress(item, 'tourist')}
        activeOpacity={0.8}
      >
        <View style={styles.ticketGraphic}>
          <Ionicons name="qr-code-outline" size={26} color={color} />
          <Text style={[styles.graphicText, { color }]}>{isUnused ? 'MỞ VÉ' : 'CHI TIẾT'}</Text>
          <View style={[styles.graphicHole, styles.graphicHoleTop]} />
          <View style={[styles.graphicHole, styles.graphicHoleBottom]} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.locationName} numberOfLines={1}>{item.location_name}</Text>
            <View style={[styles.badge, { backgroundColor: bg }]}>
              <Text style={[styles.badgeText, { color }]}>{isUnused ? 'Chưa dùng' : (item.status === 'used' ? 'Đã dùng' : 'Đã hủy')}</Text>
            </View>
          </View>
          <Text style={styles.serviceName} numberOfLines={2}>{item.service_name}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={13} color="#64748b" />
              <Text style={styles.infoText}>Ngày: {formatDate(item.check_in_date)}</Text>
            </View>
            <Text style={styles.codeText}>Mã: {item.ticket_code.split('-')[1] || '***'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTablePass = ({ item }: { item: TableReservation }) => {
    const meta = statusMeta(item.bookingStatus);
    const amount = Number(item.totalAmount || 0);

    return (
      <TouchableOpacity
        style={[styles.ticketCard, item.bookingStatus === 'cancelled' && styles.cardDisabled]}
        onPress={() => handleCardPress(item, 'restaurant')}
        activeOpacity={0.8}
      >
        <View style={styles.ticketGraphic}>
          <Ionicons name="restaurant-outline" size={26} color={meta.color} />
          <Text style={[styles.graphicText, { color: meta.color }]}>ĐẶT BÀN</Text>
          <View style={[styles.graphicHole, styles.graphicHoleTop]} />
          <View style={[styles.graphicHole, styles.graphicHoleBottom]} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.locationName} numberOfLines={1}>{item.locationName}</Text>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.serviceName}>Bàn: {item.tableNames?.join(', ') || 'Chờ xếp bàn'}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={13} color="#64748b" />
              <Text style={styles.infoText}>{formatDisplayDateTime(item.checkInDate || item.startTime)}</Text>
            </View>
            <Text style={styles.priceText}>{amount > 0 ? `${amount.toLocaleString()}đ` : 'Miễn phí cọc'}</Text>
          </View>
          
          {item.canCancel && item.bookingStatus !== 'cancelled' && (
            <TouchableOpacity style={styles.cardCancelButton} onPress={() => handleCancelBooking(item.bookingId)}>
              <Text style={styles.cardCancelText}>Hủy bàn</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRoomPass = ({ item }: { item: RoomReservation }) => {
    const meta = statusMeta(item.bookingStatus);
    const amount = Number(item.totalAmount || 0);

    return (
      <TouchableOpacity
        style={[styles.ticketCard, item.bookingStatus === 'cancelled' && styles.cardDisabled]}
        onPress={() => handleCardPress(item, 'hotel')}
        activeOpacity={0.8}
      >
        <View style={styles.ticketGraphic}>
          <Ionicons name="bed-outline" size={26} color={meta.color} />
          <Text style={[styles.graphicText, { color: meta.color }]}>PHÒNG</Text>
          <View style={[styles.graphicHole, styles.graphicHoleTop]} />
          <View style={[styles.graphicHole, styles.graphicHoleBottom]} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.locationName} numberOfLines={1}>{item.locationName}</Text>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.serviceName}>Phòng: {item.roomNames?.join(', ') || 'Đang chuẩn bị'}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.infoRow}>
              <Ionicons name="moon-outline" size={13} color="#64748b" />
              <Text style={styles.infoText}>{formatDate(item.checkInDate!)} ({item.nightCount} đêm)</Text>
            </View>
            <Text style={styles.priceText}>{amount.toLocaleString()}đ</Text>
          </View>
          
          {item.canCancel && item.bookingStatus !== 'cancelled' && (
            <TouchableOpacity style={styles.cardCancelButton} onPress={() => handleCancelBooking(item.bookingId)}>
              <Text style={styles.cardCancelText}>Hủy đặt phòng</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons
          name={activeTab === 'tourist' ? 'ticket-outline' : (activeTab === 'restaurant' ? 'restaurant-outline' : 'bed-outline')}
          size={44}
          color="#94a3b8"
        />
      </View>
      <Text style={styles.emptyTitle}>Chưa có vé nào</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'tourist' 
          ? 'Khi bạn mua vé tham quan du lịch, mã QR vé check-in sẽ xuất hiện ở đây.'
          : (activeTab === 'restaurant' ? 'Danh sách vé đặt chỗ ẩm thực sẽ hiện ra tại đây.' : 'Danh sách vỏ vé nhận phòng khách sạn/resort sẽ hiển thị tại đây.')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vé của tôi</Text>
        <Text style={styles.headerSubtitle}>Quản lý vé tham quan và dịch vụ của bạn</Text>
      </View>

      {/* Segmented control tabs */}
      <View style={styles.tabsContainer}>
        {(['tourist', 'restaurant', 'hotel'] as TicketTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'tourist' ? 'Du lịch' : (tab === 'restaurant' ? 'Ăn uống' : 'Lưu trú');
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List content */}
      <FlatList
        data={(activeTab === 'tourist' ? touristTickets : (activeTab === 'restaurant' ? tablePasses : roomPasses)) as any[]}
        keyExtractor={(item: any, index) => (item.ticket_id || item.bookingId || index).toString()}
        renderItem={
          (activeTab === 'tourist' 
            ? renderTouristTicket 
            : (activeTab === 'restaurant' ? renderTablePass : renderRoomPass)) as any
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchAllPasses(true)}
            colors={['#14b8a6']}
          />
        }
      />

      {/* 1. Modal QR Code cho Tourist ticket */}
      <Modal visible={!!selectedTicket} transparent animationType="fade" onRequestClose={() => setSelectedTicket(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTicket && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Mã vé điện tử</Text>
                  <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalLocation}>{selectedTicket.location_name}</Text>
                  <Text style={styles.modalService}>{selectedTicket.service_name}</Text>
                  <View style={[styles.qrContainer, selectedTicket.status !== 'unused' && styles.qrDisabled]}>
                    <QRCode
                      value={selectedTicket.ticket_code}
                      size={180}
                      color={selectedTicket.status === 'unused' ? '#0f172a' : '#cbd5e1'}
                      backgroundColor="#fff"
                    />
                    {selectedTicket.status !== 'unused' && (
                      <View style={styles.qrWatermark}>
                        <Text style={styles.qrWatermarkText}>
                          {selectedTicket.status === 'used' ? 'ĐÃ CHECK-IN' : 'VÔ HIỆU'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.qrInstruction}>Đưa mã QR cho nhân viên soát vé tại cửa</Text>
                  <View style={styles.fallbackCodeContainer}>
                    <Text style={styles.fallbackLabel}>Mã số vé:</Text>
                    <Text style={[styles.fallbackValue, selectedTicket.status !== 'unused' && styles.textStrikethrough]}>
                      {selectedTicket.ticket_code}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. Modal QR Code cho Đặt bàn (Table Pass) */}
      <Modal visible={!!selectedTablePass} transparent animationType="fade" onRequestClose={() => setSelectedTablePass(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTablePass && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Thẻ thông hành ẩm thực</Text>
                  <TouchableOpacity onPress={() => setSelectedTablePass(null)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalLocation}>{selectedTablePass.locationName}</Text>
                  <Text style={styles.modalService}>Bàn ăn: {selectedTablePass.tableNames?.join(', ') || 'Chờ gán bàn'}</Text>
                  <View style={[styles.qrContainer, selectedTablePass.bookingStatus === 'completed' && styles.qrDisabled]}>
                    <QRCode
                      value={selectedTablePass.qrPayload || `TABLE_BOOKING:${selectedTablePass.bookingId}`}
                      size={180}
                      color={selectedTablePass.bookingStatus === 'confirmed' ? '#0f172a' : '#cbd5e1'}
                      backgroundColor="#fff"
                    />
                    {selectedTablePass.bookingStatus === 'completed' && (
                      <View style={styles.qrWatermark}>
                        <Text style={styles.qrWatermarkText}>ĐÃ SỬ DỤNG</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.qrInstruction}>Đưa mã QR cho nhân viên tại quầy đón khách</Text>
                  <View style={styles.fallbackCodeContainer}>
                    <Text style={styles.fallbackLabel}>Giờ hẹn: {formatDisplayDateTime(selectedTablePass.checkInDate || selectedTablePass.startTime)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 3. Modal QR Code cho Đặt phòng (Room Pass) */}
      <Modal visible={!!selectedRoomPass} transparent animationType="fade" onRequestClose={() => setSelectedRoomPass(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedRoomPass && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Thẻ nhận phòng khách sạn</Text>
                  <TouchableOpacity onPress={() => setSelectedRoomPass(null)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalLocation}>{selectedRoomPass.locationName}</Text>
                  <Text style={styles.modalService}>Phòng nghỉ: {selectedRoomPass.roomNames?.join(', ') || 'Đang xếp phòng'}</Text>
                  <View style={[styles.qrContainer, selectedRoomPass.bookingStatus === 'completed' && styles.qrDisabled]}>
                    <QRCode
                      value={selectedRoomPass.qrPayload || `ROOM_BOOKING:${selectedRoomPass.bookingId}`}
                      size={180}
                      color={selectedRoomPass.bookingStatus === 'confirmed' ? '#0f172a' : '#cbd5e1'}
                      backgroundColor="#fff"
                    />
                    {selectedRoomPass.bookingStatus === 'completed' && (
                      <View style={styles.qrWatermark}>
                        <Text style={styles.qrWatermarkText}>ĐÃ CHECK-OUT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.qrInstruction}>Trình mã QR tại lễ tân khách sạn để nhận chìa khóa</Text>
                  <View style={styles.fallbackCodeContainer}>
                    <Text style={styles.fallbackLabel}>HSD: {formatDate(selectedRoomPass.checkInDate!)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 4. Modal VietQR thanh toán cho các đơn hàng chưa thanh toán */}
      <Modal visible={!!selectedUnpaidBooking} transparent animationType="slide" onRequestClose={() => setSelectedUnpaidBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            {selectedUnpaidBooking && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Hóa đơn thanh toán VietQR</Text>
                  <TouchableOpacity onPress={() => setSelectedUnpaidBooking(null)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={[]}
                  renderItem={null}
                  showsVerticalScrollIndicator={false}
                  ListHeaderComponent={
                    <View style={styles.paymentModalBody}>
                      <Text style={styles.paymentLocation}>{selectedUnpaidBooking.locationName}</Text>
                      
                      <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>Số tiền cần chuyển khoản:</Text>
                        <Text style={styles.amountValue}>{selectedUnpaidBooking.amount.toLocaleString()}đ</Text>
                      </View>

                      {/* Render mã VietQR động */}
                      {buildVietQrImageUrl({
                        bankName: selectedUnpaidBooking.bankName,
                        bankAccount: selectedUnpaidBooking.bankAccount,
                        accountHolder: selectedUnpaidBooking.accountHolder,
                        amount: selectedUnpaidBooking.amount,
                        addInfo: `BK-${selectedUnpaidBooking.id}`,
                      }).url ? (
                        <View style={styles.vietQrImageContainer}>
                          <Image
                            source={{
                              uri: buildVietQrImageUrl({
                                bankName: selectedUnpaidBooking.bankName,
                                bankAccount: selectedUnpaidBooking.bankAccount,
                                accountHolder: selectedUnpaidBooking.accountHolder,
                                amount: selectedUnpaidBooking.amount,
                                addInfo: `BK-${selectedUnpaidBooking.id}`,
                              }).url!,
                            }}
                            style={styles.vietQrImage}
                          />
                        </View>
                      ) : (
                        <View style={styles.paymentErrorContainer}>
                          <Text style={styles.paymentErrorText}>Thiếu dữ liệu ngân hàng VietQR của Chủ cơ sở.</Text>
                        </View>
                      )}

                      {/* Chi tiết tài khoản */}
                      <View style={styles.bankDetailsContainer}>
                        <View style={styles.bankDetailRow}>
                          <Text style={styles.bankDetailLabel}>Ngân hàng:</Text>
                          <Text style={styles.bankDetailValue}>{selectedUnpaidBooking.bankName.toUpperCase()}</Text>
                        </View>
                        <View style={styles.bankDetailRow}>
                          <Text style={styles.bankDetailLabel}>Số tài khoản:</Text>
                          <Text style={styles.bankDetailValue}>{selectedUnpaidBooking.bankAccount}</Text>
                        </View>
                        <View style={styles.bankDetailRow}>
                          <Text style={styles.bankDetailLabel}>Chủ tài khoản:</Text>
                          <Text style={styles.bankDetailValue}>{selectedUnpaidBooking.accountHolder}</Text>
                        </View>
                        <View style={styles.bankDetailRow}>
                          <Text style={styles.bankDetailLabel}>Nội dung chuyển:</Text>
                          <Text style={[styles.bankDetailValue, styles.highlightText]}>BK-{selectedUnpaidBooking.id}</Text>
                        </View>
                      </View>

                      <View style={styles.warningBox}>
                        <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                        <Text style={styles.warningText}>
                          Vui lòng điền CHÍNH XÁC nội dung chuyển khoản là "BK-{selectedUnpaidBooking.id}" để hệ thống duyệt vé tự động.
                        </Text>
                      </View>

                      {/* Nút xác nhận chuyển khoản */}
                      <TouchableOpacity style={styles.confirmPaymentButton} onPress={handleConfirmTransfer}>
                        <Text style={styles.confirmPaymentButtonText}>Xác nhận đã chuyển khoản</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 5. Màn hình hóa đơn tạm thời thành công (View-and-disappear) */}
      <Modal visible={!!successInvoice} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successInvoiceContent}>
            {successInvoice && (
              <>
                <View style={styles.successHeader}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={32} color="#ffffff" />
                  </View>
                  <Text style={styles.successTitle}>Đặt chỗ thành công!</Text>
                  <Text style={styles.successSubtitle}>Giao dịch đã được hệ thống xác nhận</Text>
                </View>

                <View style={styles.invoiceDivider} />

                <View style={styles.invoiceBody}>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Mã hóa đơn:</Text>
                    <Text style={styles.invoiceValue}>#BK-{successInvoice.bookingId}</Text>
                  </View>
                  
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Địa điểm:</Text>
                    <Text style={styles.invoiceValue}>{successInvoice.locationName}</Text>
                  </View>

                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Thời gian:</Text>
                    <Text style={styles.invoiceValue}>{successInvoice.date}</Text>
                  </View>

                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceLabel}>Tổng tiền:</Text>
                    <Text style={[styles.invoiceValue, styles.invoiceHighlight]}>{successInvoice.amount.toLocaleString()}đ</Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                <Text style={styles.successFooterText}>
                  Hóa đơn này sẽ tự động đóng. Vé check-in QR chính thức đã được cập nhật vào kho vé của bạn.
                </Text>

                <TouchableOpacity style={styles.successCloseButton} onPress={handleCloseSuccessInvoice}>
                  <Text style={styles.successCloseText}>Đóng & Xem vé QR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#14b8a6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardDisabled: {
    opacity: 0.65,
  },
  ticketGraphic: {
    width: 76,
    backgroundColor: '#f8fafc',
    borderRightWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  graphicHole: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    right: -11,
  },
  graphicHoleTop: { top: -10 },
  graphicHoleBottom: { bottom: -10 },
  graphicText: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 6,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  locationName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 4,
    fontWeight: '500',
  },
  codeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  priceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cardCancelButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fff1f2',
    alignSelf: 'flex-start',
  },
  cardCancelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  modalBody: { padding: 20, alignItems: 'center' },
  modalLocation: { fontSize: 13, color: '#64748b', fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  modalService: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  qrContainer: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  qrDisabled: { opacity: 0.25 },
  qrWatermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrWatermarkText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ef4444',
    transform: [{ rotate: '-25deg' }],
  },
  qrInstruction: { fontSize: 12, color: '#64748b', marginBottom: 20 },
  fallbackCodeContainer: {
    width: '100%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  fallbackLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  fallbackValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', letterSpacing: 0.5 },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  paymentModalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  paymentModalBody: {
    padding: 20,
  },
  paymentLocation: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 10,
  },
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
  confirmPaymentButton: {
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
  confirmPaymentButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
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
  successHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
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
  invoiceDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  invoiceBody: {
    width: '100%',
    paddingVertical: 16,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
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
  successCloseButton: {
    backgroundColor: '#1e293b',
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCloseText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
});