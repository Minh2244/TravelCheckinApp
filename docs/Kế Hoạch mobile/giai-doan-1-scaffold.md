# Giai đoạn 1: Tạo khung Mobile App

## Mục tiêu
Tạo project Expo mới với SDK 54, cài dependencies, cấu hình EAS Build để build APK.

---

## Bước 1: Tạo Expo project

```bash
cd E:\TravelCheckinApp
npx create-expo-app@latest mobile --template blank-typescript
```

> Template `blank-typescript` = sạch, chỉ có App.tsx + tsconfig

---

## Bước 2: Cài dependencies chính

### Core
```bash
npx expo install expo-router expo-splash-screen expo-font expo-web-browser expo-linking expo-constants expo-status-bar
```

### Navigation (cần cho expo-router)
```bash
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
```

### State & API
```bash
npm install zustand @tanstack/react-query axios
npm install @react-native-async-storage/async-storage
```

### Map
```bash
npx expo install react-native-maps
```

### UI & Utilities
```bash
npx expo install expo-location expo-image-picker expo-notifications expo-device
npm install react-native-qrcode-svg react-native-svg
npm install date-fns clsx
```

### DateTime Picker
```bash
npx expo install @react-native-community/datetimepicker
```

---

## Bước 3: Cấu hình file .env

Tạo file `mobile/.env`:

```env
# API Configuration
EXPO_PUBLIC_API_URL=https://diligent-suffice-paradox.ngrok-free.dev/api

# Google OAuth (cùng Client ID với website)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=649280086350-dcnmaq0dg1isfnt7hmtso9paq6r8jgqr.apps.googleusercontent.com

# Facebook App ID (cùng App ID với website)
EXPO_PUBLIC_FACEBOOK_APP_ID=4153740721542373
```

> **Lưu ý:** Thêm `mobile/.env` vào `.gitignore` để không commit secrets lên git.

---

## Bước 4: Cấu hình app.json

```json
{
  "expo": {
    "name": "TravelCheckin",
    "slug": "travel-checkin",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "travelcheckin",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.minh2244.travelcheckin",
      "config": {
        "googleMapsApiKey": "YOUR_GOOGLE_MAPS_API_KEY"
      }
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-web-browser"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## Bước 5: Cấu hình EAS Build

### Tạo eas.json
```json
{
  "cli": {
    "version": ">= 20.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Cài EAS CLI
```bash
npm install -g eas-cli
```

### Đăng nhập EAS
```bash
eas login
```

### Build APK đầu tiên (development)
```bash
cd E:\TravelCheckinApp\mobile
eas build --profile development --platform android
```

> Lần đầu build mất ~10-15 phút trên cloud. Sau đó tải APK về cài vào điện thoại.

---

## Bước 6: Tạo folder structure

```
mobile/
├── app/                    # Expo Router
│   ├── _layout.tsx         # Root layout
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       └── index.tsx       # Home screen tạm
├── src/
│   ├── api/
│   │   └── client.ts       # Axios instance
│   ├── components/
│   │   └── ui/
│   ├── hooks/
│   ├── stores/
│   │   └── authStore.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── image.ts
│       └── format.ts
├── assets/
│   ├── icon.png
│   ├── splash-icon.png
│   └── adaptive-icon.png
├── .env
├── app.json
├── eas.json
└── package.json
```

---

## Bước 7: Tạo màn hình Home tạm để test

Tạo `app/(tabs)/index.tsx` với 1 Text đơn giản:
```tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>TravelCheckin - Home</Text>
    </View>
  );
}
```

---

## Bước 8: Cách chạy app (2 chế độ)

### Chế độ 1: Expo Go (nhanh, thử nghiệm)
```bash
cd E:\TravelCheckinApp\mobile
npx expo start
```
- Quét QR bằng app **Expo Go** trên điện thoại
- Hot reload, sửa code thấy ngay
- **Lưu ý:** Chỉ dùng được packages có trong Expo Go (danh sách bên dưới)

### Chế độ 2: Custom Dev Client APK (ổn định, đầy đủ)
```bash
# Build APK lần đầu (chỉ cần 1 lần)
cd E:\TravelCheckinApp\mobile
eas build --profile development --platform android

# Sau khi cài APK vào điện thoại, chạy:
npx expo start --dev-client
```
- Quét QR bằng **custom APK** (không phải Expo Go)
- Hỗ trợ TẤT CẢ native modules
- Ổn định hơn Expo Go

### Packages tương thích Expo Go

| Package | Expo Go? |
|---|---|
| expo-router, expo-font, expo-web-browser... | ✅ Có sẵn |
| react-native-maps | ✅ Có sẵn |
| react-native-screens, react-native-reanimated | ✅ Có sẵn |
| expo-location, expo-image-picker, expo-notifications | ✅ Có sẵn |
| zustand, axios, date-fns, clsx | ✅ JS-only, luôn được |
| @tanstack/react-query | ✅ JS-only, luôn được |
| @react-native-async-storage/async-storage | ✅ Có sẵn |
| react-native-qrcode-svg + react-native-svg | ✅ Có sẵn |
| @react-native-community/datetimepicker | ✅ Có sẵn |

> **Tất cả packages trong kế hoạch đều chạy được trên Expo Go!**

---

## Kết quả sau giai đoạn 1

- [x] Project Expo SDK 54 hoạt động
- [x] File .env cấu hình API URL, Google OAuth, Facebook App ID
- [x] EAS Build cấu hình xong
- [x] Build được APK đầu tiên (custom dev client)
- [x] Chạy được trên Expo Go (quét QR)
- [x] Chạy được trên custom APK (ổn định hơn)
- [x] Màn hình Home hiển thị được
- [x] Folder structure sẵn sàng cho coding

---

## Thứ tự chạy lệnh

```bash
# 1. Tạo project
cd E:\TravelCheckinApp
npx create-expo-app@latest mobile --template blank-typescript

# 2. Cài dependencies
cd mobile
npx expo install expo-router expo-splash-screen expo-font expo-web-browser expo-linking expo-constants expo-status-bar
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
npx expo install react-native-maps
npx expo install expo-location expo-image-picker expo-notifications expo-device
npx expo install @react-native-community/datetimepicker
npm install zustand @tanstack/react-query axios @react-native-async-storage/async-storage react-native-qrcode-svg react-native-svg date-fns clsx

# 3. Tạo file .env (xem nội dung ở Bước 3)

# 4. Cấu hình (viết tay app.json, eas.json)

# 5. Cài EAS CLI
npm install -g eas-cli
eas login

# 6. Test nhanh với Expo Go
npx expo start
# → Quét QR bằng Expo Go trên điện thoại

# 7. Build APK (custom dev client) - tùy chọn, ổn định hơn
eas build --profile development --platform android
# → Tải APK về, cài vào điện thoại
# → Chạy: npx expo start --dev-client
# → Quét QR bằng custom APK
```
