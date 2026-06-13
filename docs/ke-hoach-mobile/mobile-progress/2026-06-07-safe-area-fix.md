# Tiến độ — Fix Safe Area + Chuẩn bị Giai đoạn 3

> **Ngày:** 2026-06-07
> **Trạng thái:** ✅ HOÀN THÀNH

---

## Fix Safe Area (Tai thỏ + Nút điều hướng)

### Vấn đề
Tab bar dùng `height: 60` cố định → bị che bởi nút điều hướng trên Android 3 nút, và không tính đến tai thỏ trên iPhone.

### Giải pháp
Dùng `useSafeAreaInsets()` từ `react-native-safe-area-context` — tự động đo vùng an toàn theo từng điện thoại.

### File đã sửa

| File | Thay đổi |
|------|----------|
| `app/(tabs)/_layout.tsx` | Thêm `useSafeAreaInsets()`, `height: 60 + insets.bottom`, `paddingBottom: 8 + insets.bottom` |

### Kết quả theo thiết bị

| Thiết bị | insets.top | insets.bottom | Tab bar height |
|----------|-----------|---------------|----------------|
| iPhone có tai thỏ | ~59px | ~34px | 94px |
| iPhone không tai thỏ | ~20px | ~0px | 60px |
| Android 3 nút | ~24px | ~48px | 108px |
| Android gesture | ~24px | ~20px | 80px |

### File đã sẵn sàng (không cần sửa)

| File | Xử lý safe area |
|------|-----------------|
| `app/_layout.tsx` | `SafeAreaProvider` bọc toàn app |
| `app/login.tsx` | `SafeAreaView` bọc màn hình |
| `app/register.tsx` | `SafeAreaView` bọc màn hình |
| `app/forgot-password.tsx` | `SafeAreaView` bọc màn hình |

---

## Chuẩn bị Giai đoạn 3

Đã tạo file kế hoạch chi tiết: `docs/ke-hoach-mobile/buoc-3-tab-screens.md`

---

*Cập nhật: 2026-06-07*
