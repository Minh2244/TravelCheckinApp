import AsyncStorage from '@react-native-async-storage/async-storage';

// Format số tiền
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

// Format ngày tháng
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

// Format thời gian
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Format ngày giờ đầy đủ
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Kiểm tra email hợp lệ
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Kiểm tra số điện thoại hợp lệ
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
  return phoneRegex.test(phone);
};

// Rút gọn văn bản
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Tạo ID ngẫu nhiên
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Delay function
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Lưu token vào AsyncStorage
export const saveTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
};

// Lấy token từ AsyncStorage
export const getTokens = async (): Promise<{ accessToken: string | null; refreshToken: string | null }> => {
  const accessToken = await AsyncStorage.getItem('accessToken');
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  return { accessToken, refreshToken };
};

// Xóa token khỏi AsyncStorage
export const clearTokens = async (): Promise<void> => {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
};

// Lưu user vào AsyncStorage
export const saveUser = async (user: any): Promise<void> => {
  await AsyncStorage.setItem('user', JSON.stringify(user));
};

// Lấy user từ AsyncStorage
export const getUser = async (): Promise<any | null> => {
  const userStr = await AsyncStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

// Kiểm tra đã đăng nhập chưa
export const isLoggedIn = async (): Promise<boolean> => {
  const accessToken = await AsyncStorage.getItem('accessToken');
  return !!accessToken;
};

// Format số điện thoại
export const formatPhoneNumber = (phone: string): string => {
  if (phone.startsWith('+84')) {
    phone = '0' + phone.substring(3);
  }
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
};

// Tính khoảng cách giữa 2 điểm (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

// Format khoảng cách
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};
