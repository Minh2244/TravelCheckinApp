# Giai đoạn 2: Trang Chủ (Home Tab)

Tài liệu này phân tích chi tiết giao diện và luồng hoạt động của Trang chủ ứng dụng Mobile. Trang chủ được thiết kế đồng bộ với `UserDashboard` trên Website nhưng được tối ưu hóa hiển thị cho màn hình điện thoại.

*(Lưu ý: Luôn xử lý khoảng không an toàn - SafeArea, tai thỏ và thanh điều hướng ảo dưới đáy màn hình một cách tự động để phù hợp với mọi kích cỡ thiết bị).*

## 1. Công nghệ & Xử lý Giao diện
- **Khung giao diện**: React Native + Expo Router.
- **Canh chỉnh giao diện**: `nativewind` (Tailwind CSS) với tông màu **Teal/Emerald** (`teal-600` = `#0d9488`) chủ đạo xuyên suốt toàn app (bao gồm cả Tab bar active). Viền bo tròn hiện đại.
- **Xử lý Tai thỏ & Điều hướng**: Sử dụng hook `useSafeAreaInsets` từ `react-native-safe-area-context`. Tất cả `paddingTop` và `paddingBottom` của màn hình chính sẽ được cộng thêm giá trị `insets.top` và `insets.bottom` tương ứng, đảm bảo không bao giờ bị lẹm giao diện vào phần notch hay thanh home ảo trên cả iOS và Android.
- **Tối ưu hiển thị**: Các vùng Truy cập nhanh và Phân loại dùng Cuộn ngang (`ScrollView horizontal`). Danh sách địa điểm dùng `FlatList` chia 2 cột (`numColumns={2}`).
- **Hiển thị ảnh**: Dùng `expo-image` để hiển thị ảnh thật từ Backend, hỗ trợ lazy loading và cache tự động, không cài thêm thư viện ngoài.

---

## 2. Bản vẽ Giao diện (Mockup)

```text
------------------------------------------------
| [Tai thỏ / Status Bar tự động căn chỉnh]     |
|----------------------------------------------|
|                                              |
|  Chào buổi tối, Minh                         |
|  Thứ năm, ngày 18 tháng 6 năm 2026           |
|                                              |
|  [ ⛅ 27°C | Thành phố Cần Thơ | Nhiều mây ] |
|                                              |
|----------------------------------------------|
|  Truy cập nhanh                              |
|  [ 🗺️ Bản đồ ] [ 🔖 Đã lưu ] [ 📅 Lịch trình] -> (Cuộn ngang)
|                                              |
|----------------------------------------------|
|  Hoạt động của bạn                           |
|  [ 0 Check-in ] [ 0 Đã lưu ] [ 0 Voucher ]   |
|                                              |
|----------------------------------------------|
|  Đề xuất cho bạn                   Xem tất cả|
|  [🔍 Tìm kiếm địa điểm, nhà hàng...]         |
|  (Tất cả)  Ăn uống   Lưu trú   Du lịch       |
|                                              |
|  [ Ảnh Địa Điểm ]    [ Ảnh Địa Điểm ]        |
|  Nhà hàng A          Khách sạn B             |
|  ⭐ 4.0 (1 đánh giá)  ⭐ 0 (Chưa có)          |
|  📍 Q. Ninh Kiều      📍 Q. Cái Răng          |
|                                              |
| [Thanh điều hướng ảo tự động căn chỉnh]      |
------------------------------------------------
```

## 3. Chi tiết Xử lý Logic & Code

### 3.1. Các thay đổi và File cần tạo/cập nhật
1. **`mobile/tailwind.config.js` & `mobile/constants/index.ts`**: Cập nhật màu `primary` từ Blue sang **Teal** (`#0d9488` làm 600). Đồng bộ toàn app dùng Teal.
2. **`mobile/app/(tabs)/_layout.tsx`**: Đổi `tabBarActiveTintColor` sang `#0d9488` (teal-600) để nhất quán với giao diện Home.
3. **`mobile/types/index.ts`**: Cập nhật `Location` interface dùng đúng tên field từ Backend: `location_id`, `location_name`, `address`, `images`, `first_image`, `rating`, `total_reviews`, `location_type`, v.v.
4. **`mobile/api/geoApi.ts`**: Tạo mới — gọi backend `/geo/reverse` để lấy tên khu vực (Nominatim). Backend cần được bổ sung gọi thêm Open-Meteo để gộp `temperature` + `weather` vào response (xem Lưu ý & Phụ thuộc).
5. **`mobile/api/userApi.ts`**: Tạo mới — lấy thống kê check-in, yêu thích, voucher của người dùng.
6. **`mobile/store/locationStore.ts`**: Tạo mới — Zustand store lưu cache danh sách địa điểm. Hook `useLocations` sẽ đọc từ store trước (cache hit), nếu không có mới fetch từ API rồi lưu vào store. Hỗ trợ background refresh.
7. **`mobile/hooks/useLocations.ts`**: Tạo mới — hook quản lý danh sách địa điểm, tích hợp với `locationStore` làm cache middleware.
   - **Xử lý quan trọng**: Tải danh sách Favorites, dùng `filter` để loại bỏ hoàn toàn các địa điểm đã lưu khỏi danh sách "Đề xuất". Chỉ hiển thị các địa điểm của Owner/Admin (bằng cách truyền param `source: 'mobile'`).
   - **Xử lý danh mục**: Frontend sẽ tự filter danh sách đã cache khi người dùng bấm chọn category: "Ăn uống" (`restaurant`, `cafe`), "Lưu trú" (`hotel`, `resort`), "Du lịch" (`tourist`).
8. **`mobile/app/(tabs)/index.tsx`**: Viết lại toàn bộ UI theo đúng mockup (3 section: Truy cập nhanh, Hoạt động, Đề xuất), tích hợp `useSafeAreaInsets()` và GPS Banner.

### 3.2. Luồng Quyền Vị trí (GPS Banner — Không chặn cứng)
- Khi vào Home, app **ngay lập tức** yêu cầu quyền vị trí.
- Nếu người dùng **từ chối** hoặc GPS tắt: **KHÔNG chặn toàn màn hình**. Thay vào đó, hiển thị một **banner cảnh báo nổi bật** ở đầu màn hình với thông báo và nút "Bật GPS" (`Linking.openSettings()`).
- Các tính năng yêu cầu GPS (Bản đồ, Check-in, Thời tiết) sẽ bị **vô hiệu hóa (disabled)** kèm tooltip giải thích.
- Người dùng **vẫn xem được** danh sách địa điểm đề xuất (không phụ thuộc GPS).
- Khi người dùng bật lại GPS từ Settings và quay lại app, banner tự động ẩn.

```tsx
// GPS Banner component
import { Linking } from 'react-native';

function GPSBanner() {
  return (
    <View className="bg-amber-50 border border-amber-300 mx-4 mb-3 p-3 rounded-xl flex-row items-center gap-3">
      <Text className="text-amber-600 text-base">📍</Text>
      <View className="flex-1">
        <Text className="text-amber-800 font-bold text-sm">Cần quyền vị trí</Text>
        <Text className="text-amber-700 text-xs mt-0.5">Bật GPS để xem thời tiết và dùng bản đồ.</Text>
      </View>
      <TouchableOpacity
        className="bg-amber-500 px-3 py-1.5 rounded-lg"
        onPress={() => Linking.openSettings()}
      >
        <Text className="text-white font-bold text-xs">Bật GPS</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 3.3. Nguồn dữ liệu Thời tiết
- App gọi `geoApi.reverse(lat, lng)` lên backend.
- **Backend** sẽ thực hiện 2 việc: (1) Reverse geocoding lấy tên địa danh, (2) Gọi Open-Meteo API lấy nhiệt độ và mô tả thời tiết.
- Backend trả về một object duy nhất chứa cả `district/city` và `temperature`, `weather_description`.
- Điều này đảm bảo không lộ API key phía Client và dễ cache phía Backend.

### 3.4. Cache Locations với Zustand Store
```typescript
// mobile/store/locationStore.ts
import { create } from 'zustand';

interface LocationState {
  locations: any[];
  lastFetched: number | null;
  setLocations: (data: any[]) => void;
  clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  lastFetched: null,
  setLocations: (data) => set({ locations: data, lastFetched: Date.now() }),
  clearCache: () => set({ locations: [], lastFetched: null }),
}));

// Trong useLocations hook: kiểm tra cache trước
export const isCacheValid = () => {
  const { lastFetched } = useLocationStore.getState();
  return lastFetched !== null && Date.now() - lastFetched < CACHE_TTL;
};
```

### 3.5. Location Type chuẩn (đồng bộ với Backend)

> ⚠️ **Quan trọng**: Đã xác nhận qua `locationController.ts` — Backend trả về field `rating` và `total_reviews` (không phải `avg_rating` / `review_count`). Ngoài ra Backend còn trả thêm `first_image` (URL ảnh đầu tiên dạng string) bên cạnh `images` (mảng URL).

```typescript
// Cập nhật trong mobile/types/index.ts
export interface Location {
  location_id: number;
  location_name: string;
  address: string;
  latitude: number;
  longitude: number;
  location_type: 'tourist' | 'restaurant' | 'hotel' | 'cafe' | 'resort' | 'other' | string;
  rating: number;           // ← đúng tên field Backend (không phải avg_rating)
  total_reviews: number;    // ← đúng tên field Backend (không phải review_count)
  images: string[];         // Mảng URL ảnh đầy đủ (từ entity_images)
  first_image: string | null; // URL ảnh chính (từ entity_images primary)
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}
```

### 3.6. Cấu trúc Code Mẫu (SafeArea + Đầy đủ 3 Section)

```tsx
// mobile/app/(tabs)/index.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, Linking, AppState } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useLocations } from "../../hooks/useLocations";
import geoApi from "../../api/geoApi";
import userApi from "../../api/userApi";
import useAuthStore from "../../store/authStore";

// Lưu ý: route "/(tabs)/saved" chưa tồn tại trong giai đoạn 2,
// nút này sẽ được kết nối ở giai đoạn sau (tab Yêu thích / Đã lưu)
const QUICK_ACCESS = [
  { icon: "🗺️", label: "Bản đồ", route: "/(tabs)/explore" },
  { icon: "🔖", label: "Đã lưu", route: "/(tabs)/profile" }, // tạm redirect profile
  { icon: "📅", label: "Lịch trình", route: "/(tabs)/booking" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [hasGPS, setHasGPS] = useState<boolean | null>(null);
  const [geoData, setGeoData] = useState<{ city?: string; temperature?: number; weather?: string } | null>(null);
  const [stats, setStats] = useState({ checkins: 0, saved: 0, vouchers: 0 });

  const { locations, loading, category, setCategory, keyword, setKeyword } = useLocations();

  // Xử lý GPS — không chặn cứng, chỉ hiện banner
  useEffect(() => {
    checkGPS();
    // Khi user quay lại app từ Settings, kiểm tra lại quyền
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkGPS();
    });
    return () => sub.remove();
  }, []);

  const checkGPS = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setHasGPS(true);
      loadGeoData();
    } else {
      const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
      const granted = newStatus === 'granted';
      setHasGPS(granted);
      if (granted) loadGeoData();
    }
  };

  const loadGeoData = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await geoApi.reverse(pos.coords.latitude, pos.coords.longitude);
      setGeoData(result);
    } catch (e) {
      console.log('Lỗi lấy thời tiết:', e);
    }
  };

  // Lấy thống kê hoạt động người dùng
  useEffect(() => {
    (async () => {
      try {
        const [checkins, favorites, vouchers] = await Promise.all([
          userApi.getCheckins(),
          userApi.getFavorites(),
          userApi.getMySavedVouchers(),
        ]);
        setStats({
          checkins: checkins?.data?.length || 0,
          saved: favorites?.data?.length || 0,
          vouchers: vouchers?.data?.length || 0,
        });
      } catch (e) {}
    })();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  })();

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <FlatList
        data={locations}
        numColumns={2}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 16,
        }}
        ListHeaderComponent={
          <View className="mb-4">
            {/* GPS Banner — chỉ hiện khi không có quyền */}
            {hasGPS === false && (
              <View className="bg-amber-50 border border-amber-300 mb-3 p-3 rounded-xl flex-row items-center gap-3">
                <Text className="text-amber-600 text-base">📍</Text>
                <View className="flex-1">
                  <Text className="text-amber-800 font-bold text-sm">Cần quyền vị trí</Text>
                  <Text className="text-amber-700 text-xs mt-0.5">Bật GPS để xem thời tiết và dùng bản đồ.</Text>
                </View>
                <TouchableOpacity
                  className="bg-amber-500 px-3 py-1.5 rounded-lg"
                  onPress={() => Linking.openSettings()}
                >
                  <Text className="text-white font-bold text-xs">Bật GPS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Lời chào & Thời tiết */}
            <View className="mb-4">
              <Text className="text-2xl font-bold text-slate-800">{greeting}, {user?.full_name?.split(' ').pop() || 'bạn'}</Text>
              <Text className="text-xs text-slate-500 mt-1">{dateStr}</Text>
              {geoData && (
                <View className="bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl mt-3 flex-row items-center gap-2 self-start">
                  <Text className="text-sm">⛅</Text>
                  <Text className="text-sm font-bold text-teal-800">
                    {geoData.temperature}°C · {geoData.city} · {geoData.weather}
                  </Text>
                </View>
              )}
            </View>

            {/* Section 1: Truy cập nhanh */}
            <View className="mb-4">
              <Text className="text-base font-bold text-slate-800 mb-2">Truy cập nhanh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {QUICK_ACCESS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    className="items-center mr-4 bg-white rounded-2xl px-5 py-3 border border-slate-100"
                    onPress={() => router.push(item.route as any)}
                  >
                    <Text className="text-2xl mb-1">{item.icon}</Text>
                    <Text className="text-xs font-bold text-slate-700">{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Section 2: Hoạt động của bạn */}
            <View className="mb-4 bg-white rounded-2xl p-4 border border-slate-100">
              <Text className="text-base font-bold text-slate-800 mb-3">Hoạt động của bạn</Text>
              <View className="flex-row justify-around">
                {[
                  { count: stats.checkins, label: "Check-in", icon: "📷" },
                  { count: stats.saved, label: "Đã lưu", icon: "🔖" },
                  { count: stats.vouchers, label: "Voucher", icon: "🎫" },
                ].map((s) => (
                  <View key={s.label} className="items-center">
                    <Text className="text-xl">{s.icon}</Text>
                    <Text className="text-xl font-bold text-teal-600 mt-1">{s.count}</Text>
                    <Text className="text-xs text-slate-500">{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Section 3: Đề xuất - Header */}
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base font-bold text-slate-800">Đề xuất cho bạn</Text>
              <TouchableOpacity><Text className="text-xs text-teal-600 font-bold">Xem tất cả</Text></TouchableOpacity>
            </View>

            {/* Bộ lọc danh mục */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {['Tất cả', 'Ăn uống', 'Lưu trú', 'Du lịch'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full mr-2 ${category === cat ? 'bg-teal-600' : 'bg-slate-200'}`}
                >
                  <Text className={`font-bold text-sm ${category === cat ? 'text-white' : 'text-slate-600'}`}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1 m-1 bg-white rounded-xl overflow-hidden border border-slate-100">
            {/* Ảnh thật từ Backend — ưu tiên first_image (ảnh primary), fallback images[0] */}
            <Image
              source={{ uri: item.first_image || item.images?.[0] }}
              style={{ height: 96, width: '100%', backgroundColor: '#e2e8f0' }}
              contentFit="cover"
            />
            <View className="p-2">
              <Text className="font-bold text-slate-800 text-xs" numberOfLines={1}>{item.location_name}</Text>
              <Text className="text-slate-400 text-[10px] mt-0.5">
                ⭐ {item.rating?.toFixed(1) || '0'} ({item.total_reviews || 0} đánh giá)
              </Text>
              <Text className="text-slate-400 text-[10px] mt-0.5" numberOfLines={1}>📍 {item.address}</Text>
            </View>
          </View>
        )}
        keyExtractor={item => item.location_id.toString()}
      />
    </View>
  );
}
```

---

## 4. Lộ trình Triển khai (Các bước thực hiện)

Giai đoạn 2 sẽ được chia làm 4 bước để đảm bảo tiến độ và dễ kiểm soát lỗi:

- **Bước 1 (Đồng bộ nền tảng)**: Cập nhật màu Teal vào `tailwind.config.js`, `constants/index.ts`, và `_layout.tsx`. Cập nhật `types/index.ts` với `Location` interface đúng chuẩn Backend.
- **Bước 2 (Khởi tạo API, Store & Hooks)**: Tạo `geoApi.ts`, `userApi.ts`, `locationStore.ts`, và `useLocations.ts` (bao gồm cache middleware và thuật toán lọc Favorites).
- **Bước 3 (Giao diện)**: Viết lại toàn bộ UI `index.tsx` với đầy đủ 3 section theo mockup, tích hợp `useSafeAreaInsets()`, `expo-image`, và GPS Banner.
- **Bước 4 (Tích hợp & Kiểm thử)**: Ghép nối dữ liệu thật từ API, kiểm thử luồng GPS Banner, cache, lọc Favorites, và hiển thị ảnh.

---

## 5. Tiêu chí Nghiệm thu (Kết quả đầu ra)

Để hoàn thành Giai đoạn 2, ứng dụng phải đạt được 100% các tiêu chí sau:

1. **GPS Banner**: Khi không có quyền vị trí, hiển thị banner cảnh báo màu vàng ở đầu màn hình. Nút "Bật GPS" mở đúng màn hình Settings của thiết bị (`Linking.openSettings()`). Banner tự ẩn khi GPS được bật và người dùng quay lại app.
2. **Hiển thị Thời tiết**: Sau khi có vị trí, khu vực lời chào hiển thị đúng Nhiệt độ, Khu vực và Mô tả thời tiết (dữ liệu từ Backend qua Open-Meteo).
3. **Responsive Tai thỏ**: Dù vuốt danh sách lên xuống, các thành phần ở đỉnh và đáy màn hình không bao giờ bị che khuất bởi tai thỏ hay thanh điều hướng ảo của iOS/Android.
4. **Lọc dữ liệu thông minh**: Các địa điểm đã được người dùng nhấn "Lưu" (nằm trong danh sách Favorites) tuyệt đối không xuất hiện trong lưới "Đề xuất cho bạn".
5. **Cache hoạt động**: Chuyển sang tab khác và quay lại Home — danh sách địa điểm hiển thị ngay lập tức (từ cache), đồng thời background refresh diễn ra sau 5 phút.
6. **Ảnh thật từ Backend**: Card địa điểm hiển thị ảnh thật từ URL, có placeholder màu xám khi đang tải, không bị giật lag.
7. **Màu sắc nhất quán**: Tab bar active, nút lọc danh mục, badge thống kê đều dùng màu Teal-600 (`#0d9488`) xuyên suốt.

---

## 6. Lưu ý & Phụ thuộc

### Mobile
- **`expo-image`** có sẵn trong SDK Expo 54, chỉ cần `import { Image } from 'expo-image'`. Không cần cài thêm.
- **Route `/(tabs)/saved`** chưa tồn tại — nút "Đã lưu" trong Truy cập nhanh tạm thời redirect sang profile. Sẽ kết nối đúng ở giai đoạn sau.
- **Ô tìm kiếm** trong mockup (dòng `[🔍 Tìm kiếm...]`) hiện chưa có trong code mẫu. `keyword`/`setKeyword` đã chuẩn bị sẵn trong hook — sẽ render `TextInput` ở giai đoạn 3 (Khám phá).
- **Gọi API locations**: bắt buộc thêm `source: 'mobile'` vào params để Backend filter đúng `source IN ('owner','admin')` — nếu thiếu, API trả cả địa điểm OSM/tự do.

### Backend (cần làm trước khi code Mobile)
- **`geoController.ts` – thêm Open-Meteo**: Sau khi Nominatim trả về địa danh, gọi thêm `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weathercode` (miễn phí, không cần API key). Gộp kết quả vào response với shape: `{ city, temperature, weather }`. Giá trị `weather` nên map `weathercode` sang text tiếng Việt (0 = Trời quang, 1–3 = Nhiều mây, v.v.).
- **Confirm field `location_id` trong `/user/favorites`**: Đã xác nhận qua source code – response trả đúng `location_id` ✅.
- **Confirm field `rating` / `total_reviews` trong `/locations`**: Đã xác nhận – Backend trả `rating` và `total_reviews` (không phải `avg_rating`/`review_count`) ✅. Type trong kế hoạch đã được sửa.

---

## 7. Ghi chú triển khai lại từ đầu

- Folder `mobile/` cũ đã được xóa; Giai đoạn 2 này là đặc tả để dựng lại Home tab từ đầu.
- Home mới không được dừng ở mức mockup hay shell: phải làm đủ GPS banner, thời tiết, thống kê nhanh, danh sách đề xuất, lọc category, ảnh thật từ backend và điều hướng sang các cụm phase sau.
- Quick access, banner và các action nổi trên Home phải luôn nằm đúng vùng SafeArea, không bị che bởi notch hoặc thanh điều hướng ảo.
