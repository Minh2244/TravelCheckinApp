mobile/
├── src/
│ │
│ ├── api/ # Gọi Backend (Axios)
│ │ ├── apiClient.ts # Config Interceptors (Tự động gắn Token)
│ │ ├── auth.api.ts
│ │ ├── user.api.ts
│ │ ├── location.api.ts
│ │ ├── booking.api.ts
│ │ ├── payment.api.ts
│ │ ├── voucher.api.ts # 🆕 User lấy mã, Owner tạo mã
│ │ ├── checkin.api.ts # Employee quét mã
│ │ ├── ai.api.ts # 🆕 Chat Gemini & Lịch trình
│ │ ├── sos.api.ts # 🆕 Gửi tọa độ GPS khẩn cấp
│ │ └── commission.api.ts # 🆕 Owner xem nợ
│ │
│ ├── assets/ # Tài nguyên tĩnh
│ │ ├── images/ # Ảnh nền, Logo
│ │ ├── icons/ # File .png hoặc .svg
│ │ └── fonts/ # Font chữ tùy chỉnh
│ │
│ ├── components/ # UI Reusable
│ │ ├── common/ # Các component cơ bản
│ │ │ ├── Button.tsx
│ │ │ ├── Input.tsx
│ │ │ ├── Header.tsx # Header chuẩn có nút Back
│ │ │ ├── Loading.tsx # Spinner xoay xoay
│ │ │ ├── Modal.tsx
│ │ │ └── SafeView.tsx # Xử lý tai thỏ (SafeAreaView)
│ │ │
│ │ ├── map/ # 🆕 Component Bản đồ
│ │ │ ├── CustomMarker.tsx
│ │ │ └── MapCluster.tsx # Gom nhóm địa điểm khi zoom out
│ │ │
│ │ ├── qr/ # 🆕 Component QR
│ │ │ ├── QrScanner.tsx # Camera quét mã (Employee)
│ │ │ └── QrCodeView.tsx # Hiển thị mã thanh toán (User)
│ │ │
│ │ └── ai/ # 🆕 Chat UI
│ │ ├── ChatBubble.tsx
│ │ └── TypingIndicator.tsx
│ │
│ ├── constants/
│ │ ├── api.ts # BASE_URL (Lưu ý: Android Emulator dùng 10.0.2.2)
│ │ ├── colors.ts # Bảng màu (Primary, Secondary, Error...)
│ │ ├── screens.ts # Tên các màn hình (SCREEN_NAME)
│ │ └── storage.ts # Key lưu MMKV/AsyncStorage
│ │
│ ├── context/ # Global State (React Context)
│ │ ├── AuthContext.tsx # Lưu User & Token
│ │ ├── LocationContext.tsx # 🆕 Lưu vị trí GPS hiện tại của User
│ │ └── ThemeContext.tsx # Dark/Light mode
│ │
│ ├── hooks/
│ │ ├── useAuth.ts
│ │ ├── useLocation.ts # 🆕 Hook lấy GPS real-time
│ │ ├── useCamera.ts # 🆕 Xin quyền Camera
│ │ └── useDebounce.ts # Search không lag
│ │
│ ├── navigation/ # Điều hướng (React Navigation)
│ │ ├── RootNavigator.tsx # Switch tổng (Auth vs App)
│ │ ├── AuthNavigator.tsx # Login, Register
│ │ ├── BottomTabNavigator.tsx # 🆕 Menu dưới đáy cho User
│ │ ├── UserStack.tsx # Flow chi tiết của User
│ │ ├── OwnerStack.tsx # Flow của Owner
│ │ └── EmployeeStack.tsx # Flow của Employee
│ │
│ ├── screens/
│ │ │
│ │ ├── auth/
│ │ │ ├── LoginScreen.tsx
│ │ │ ├── RegisterScreen.tsx
│ │ │ └── OnboardingScreen.tsx
│ │ │
│ │ ├── user/ # USER FLOW
│ │ │ ├── HomeScreen.tsx # Feed địa điểm, Banner
│ │ │ ├── MapScreen.tsx # Bản đồ toàn màn hình
│ │ │ ├── LocationDetailScreen.tsx
│ │ │ ├── BookingScreen.tsx # Form đặt chỗ + Chọn Voucher
│ │ │ ├── PaymentResultScreen.tsx # Kết quả thanh toán QR
│ │ │ ├── AiChatScreen.tsx # 🆕 Chat với Gemini
│ │ │ ├── ItineraryScreen.tsx # 🆕 Xem lịch trình AI gợi ý
│ │ │ ├── DiaryScreen.tsx # 🆕 Viết nhật ký + Up ảnh
│ │ │ └── ProfileScreen.tsx
│ │ │
│ │ ├── owner/ # OWNER FLOW
│ │ │ ├── OwnerDashboardScreen.tsx
│ │ │ ├── MyLocationsScreen.tsx
│ │ │ ├── VoucherManageScreen.tsx # 🆕 Tạo Voucher
│ │ │ ├── RevenueScreen.tsx
│ │ │ └── FinanceDebtScreen.tsx # 🆕 Xem nợ Admin & QR thanh toán
│ │ │
│ │ └── employee/ # EMPLOYEE FLOW
│ │ ├── EmployeeHomeScreen.tsx # Danh sách task
│ │ └── ScanQrScreen.tsx # 🆕 Màn hình Camera quét mã
│ │
│ ├── store/ # State Management (Zustand - Gọn hơn Redux)
│ │ ├── auth.store.ts
│ │ └── booking.store.ts # Lưu tạm thông tin đặt phòng
│ │
│ ├── types/ # TypeScript Interfaces (Khớp DB)
│ │ ├── user.ts
│ │ ├── location.ts
│ │ ├── booking.ts
│ │ └── env.d.ts
│ │
│ ├── utils/
│ │ ├── formatter.ts # Tiền tệ, Ngày tháng
│ │ ├── validator.ts # Validate email, phone
│ │ └── permission.ts # 🆕 Xử lý quyền (Cam, Mic, Loc)
│ │
│ ├── App.tsx # Entry Point
│ └── index.js
│
├── package.json
├── app.json # Config Expo
├── babel.config.js
└── tsconfig.json

# ĐIỂM "ĂN TIỀN" CẦN LƯU Ý KHI CODE MOBILE

💎 1. Xử lý QR Code & Camera (Check-in Thần Tốc)
Đây là tính năng cốt lõi của Employee. Nó phải nhanh, nhạy và có phản hồi (Rung/Tiếng kêu) để người dùng biết là đã quét xong.

Vấn đề: Camera bị lag, quét mãi không nhận, hoặc quét xong không biết chuyện gì xảy ra.

Giải pháp "Ăn tiền":

Hiệu ứng: Khi quét thành công -> Rung máy (Haptic Feedback) + Hiện dấu tích xanh ngay lập tức.

Debounce: Chặn việc quét liên tục 1 mã (Employee lỡ tay giữ camera lâu nó gửi 10 request về server).

Thư viện: Dùng expo-camera (Dễ nhất cho Expo Go).

💡 Lưu ý thực hiện:

Xin quyền Camera ngay khi vào màn hình Employee.

Xử lý trường hợp User không cho quyền -> Hiện nút "Mở Cài đặt".

💎 2. Tính năng SOS & Location (Cứu hộ Real-time)
Đây là tính năng "Killer Feature" để bán dự án (Tính nhân văn & An toàn).

Vấn đề: Lấy tọa độ GPS chậm, hoặc không lấy được khi ở trong nhà.

Giải pháp "Ăn tiền":

Lấy tọa độ chính xác cao: Dùng Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).

Reverse Geocoding: Từ tọa độ (10.7, 106.6) -> Chuyển thành địa chỉ văn bản ("123 Đường A, Quận 1") để gửi về cho Admin dễ đọc.

One-Touch: Nút SOS phải to, nổi, bấm là gửi ngay (có loading), không hỏi han rườm rà.

💡 Lưu ý thực hiện:

Cần xin quyền LOCATION_FOREGROUND.

Test trên máy thật (Android/iOS) vì Emulator chỉnh GPS rất phiền.

💎 3. Cấu hình API Client (Tự động nhận diện IP LAN)
Đây là điểm "tinh tế" về kỹ thuật. Giúp bạn code ở nhà, lên trường, ra quán cafe đều chạy được ngay mà không cần sửa code IP thủ công.

Vấn đề: Code cứng IP 192.168.1.5, ra quán cafe IP đổi thành 192.168.0.10 -> App lỗi Network Error.

Giải pháp "Ăn tiền": Dùng code tự động lấy IP của máy tính đang chạy server Metro Bundler.

🛠️ HƯỚNG DẪN THỰC HIỆN CHI TIẾT (COPY LÀ CHẠY)
1️⃣ Cấu hình file src/constants/api.ts (Giải quyết vấn đề IP)
Cài thư viện cần thiết:

Bash

npx expo install expo-constants
Sửa file api.ts:

TypeScript

import Constants from 'expo-constants';

// Hàm lấy địa chỉ IP của máy tính đang chạy Expo
const getLocalHost = () => {
const hostUri = Constants.expoConfig?.hostUri;
const localhost = hostUri?.split(':')[0];
return localhost || '192.168.1.X'; // Fallback nếu không lấy được
};

// PORT của Backend Node.js
const PORT = '5000';

// Logic chọn URL
const DEV_URL = `http://${getLocalHost()}:${PORT}/api`;
const PROD_URL = 'https://api.your-domain.com/api';

// Tự động chuyển đổi
export const API_URL = **DEV** ? DEV_URL : PROD_URL;

console.log('🔗 Mobile kết nối tới:', API_URL);
2️⃣ Code mẫu màn hình ScanQrScreen.tsx (Cho Employee)
Cài thư viện:

Bash

npx expo install expo-camera expo-haptics
Code logic quét mã "xịn":

TypeScript

import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert } from 'react-native';
import { CameraView, Camera } from "expo-camera"; // Expo Camera mới
import \* as Haptics from 'expo-haptics'; // Rung máy
import { useIsFocused } from '@react-navigation/native'; // Chỉ bật cam khi đang ở màn hình này

export default function ScanQrScreen() {
const [hasPermission, setHasPermission] = useState<boolean | null>(null);
const [scanned, setScanned] = useState(false);
const isFocused = useIsFocused(); // Quan trọng: Tắt cam khi sang tab khác để đỡ tốn pin

useEffect(() => {
const getCameraPermissions = async () => {
const { status } = await Camera.requestCameraPermissionsAsync();
setHasPermission(status === "granted");
};
getCameraPermissions();
}, []);

const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
if (scanned) return; // Chặn quét đúp
setScanned(true);

    // 1. Rung máy báo hiệu
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 2. Gọi API Verify Checkin ở đây
    console.log("Mã QR:", data);

    // 3. Hiện thông báo
    Alert.alert("Đã quét!", `Nội dung: ${data}`, [
      { text: "OK", onPress: () => setScanned(false) } // Reset để quét tiếp
    ]);

};

if (hasPermission === null) return <Text>Đang xin quyền...</Text>;
if (hasPermission === false) return <Text>Không có quyền truy cập Camera</Text>;

return (
<View style={styles.container}>
{isFocused && (
<CameraView
onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
style={StyleSheet.absoluteFillObject}
/>
)}
{scanned && (
<Button title={'Chạm để quét lại'} onPress={() => setScanned(false)} />
)}
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
flexDirection: 'column',
justifyContent: 'center',
},
});
3️⃣ Code mẫu nút SOS (src/components/common/SosButton.tsx)
Cài thư viện:

Bash

npx expo install expo-location
Code nút SOS gửi tọa độ:

TypeScript

import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import \* as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../../constants/api';

const SosButton = () => {
const [loading, setLoading] = useState(false);

const handlePressSos = async () => {
Alert.alert(
"CẢNH BÁO SOS",
"Bạn có chắc chắn muốn gửi tín hiệu cầu cứu kèm vị trí hiện tại?",
[
{ text: "Hủy", style: "cancel" },
{
text: "GỬI NGAY",
style: "destructive",
onPress: sendSignal
}
]
);
};

const sendSignal = async () => {
setLoading(true);
try {
// 1. Xin quyền Location
let { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
Alert.alert('Lỗi', 'Cần quyền vị trí để gửi SOS!');
return;
}

      // 2. Lấy tọa độ
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // 3. Gọi API (Giả định bạn đã code API /sos)
      await axios.post(`${API_URL}/sos`, {
        latitude,
        longitude,
        message: "Người dùng cần hỗ trợ khẩn cấp!"
      });

      Alert.alert("Đã gửi!", "Admin đã nhận được vị trí của bạn.");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể gửi tín hiệu SOS. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }

};

return (
<TouchableOpacity 
      style={styles.fab} 
      onPress={handlePressSos}
      disabled={loading}
    >
{loading ? (
<ActivityIndicator color="#FFF" />
) : (
<Ionicons name="warning" size={28} color="#FFF" />
)}
</TouchableOpacity>
);
};

const styles = StyleSheet.create({
fab: {
position: 'absolute',
bottom: 20,
right: 20,
width: 60,
height: 60,
borderRadius: 30,
backgroundColor: '#FF3B30', // Màu đỏ báo động
justifyContent: 'center',
alignItems: 'center',
elevation: 5, // Bóng đổ Android
shadowColor: '#000', // Bóng đổ iOS
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3,
shadowRadius: 3,
zIndex: 999,
}
});

export default SosButton;

# Các thư viện và cấu hình cần cài đặt:

📱 PHẦN C: MOBILE APP (Expo + TypeScript)
Dành cho User (Map, SOS) và Employee (Quét QR).

1. Cài đặt thư viện cốt lõi
   Chạy trong thư mục mobile/:

Bash

npx expo install expo-constants expo-linking expo-router react-native-safe-area-context react-native-screens expo-status-bar 2. Cài đặt thư viện "Ăn tiền" (Camera, Map, SOS)
Bash

npx expo install expo-camera expo-location expo-haptics expo-image-picker expo-secure-store
Giải thích công dụng:

expo-camera: Quét QR Check-in.

expo-location: Lấy tọa độ GPS để gửi SOS.

expo-haptics: Rung điện thoại khi quét mã thành công.

expo-image-picker: Chọn ảnh từ thư viện để viết Nhật ký/Review.

expo-secure-store: Lưu Token đăng nhập an toàn (thay cho AsyncStorage cũ).

3. Cài đặt thư viện Logic & UI
   Bash

npm install axios zustand @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack react-native-svg react-native-qrcode-svg date-fns
Giải thích:

react-native-qrcode-svg: Hiển thị mã QR thanh toán trên điện thoại (User đưa cho Owner quét).

@react-navigation/\*: Điều hướng chuyển màn hình.

date-fns: Format ngày tháng (VD: "2 phút trước").

📝 TÓM TẮT FILE .env (Biến môi trường)
Bạn cần tạo file .env ở Backend để chứa các khóa bí mật. Đừng bao giờ hard-code vào trong file .ts.

File backend/.env:

Đoạn mã

PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=mat_khau_mysql_cua_ban
DB_NAME=TravelCheckinApp

# Bí mật để ký Token (Gõ bừa một chuỗi dài ngoằng)

JWT_SECRET=SieuBiMatKhongTheDoanDuoc123!@#

# Google Gemini API Key (Lấy tại aistudio.google.com)

GEMINI_API_KEY=AIzaSy...

# Google Maps API Key (Lấy tại console.cloud.google.com)

# Cái này dùng ở cả Frontend và Mobile

GOOGLE_MAP_KEY=AIzaSy...
