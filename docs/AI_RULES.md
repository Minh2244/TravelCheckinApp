# 🛑 QUY TẮC LẬP TRÌNH (CODING STANDARDS) - DỰ ÁN TRAVEL SMART CHECK-IN

Đây là bộ quy tắc **BẮT BUỘC**. Mọi đoạn code được sinh ra bởi AI (Copilot, ChatGPT, Claude...) đều phải tuân thủ nghiêm ngặt các điều dưới đây.

---

## 1. QUY TẮC CHUNG (CORE PRINCIPLES)

### 1.1. Format & Clean Code

- **❌ KHÔNG sử dụng Icon/Emoji:** Tuyệt đối không dùng ký tự (🔑, 👤, ⚙️,...) trong mã nguồn (tên biến, string, comment code). Chỉ dùng trong file tài liệu `.md`.
- **✅ Comment bằng TIẾNG VIỆT:**

  - Giải thích **Tại sao** (Why) làm vậy, không chỉ giải thích **Làm gì** (What).
  - Bắt buộc có comment cho: Interface, Function phức tạp, và Logic nghiệp vụ quan trọng.
  - Ví dụ:

    ```typescript
    // 🟢 ĐÚNG: Kiểm tra xem user có quyền owner của địa điểm này không để tránh gian lận
    if (checkPermission(user, location)) { ... }

    // 🔴 SAI: Kiểm tra quyền
    if (checkPermission(user, location)) { ... }
    ```

### 1.2. TypeScript & Type Safety

- **❌ KHÔNG dùng `any`:** Phải định nghĩa `interface` hoặc `type` rõ ràng cho mọi biến, tham số và dữ liệu trả về.
- **✅ Đồng bộ Interface:** Các Interface (User, Booking, Location...) phải khớp 100% với cấu trúc Database MySQL đã định nghĩa.

### 1.3. Cấu trúc thư mục

- **✅ Tuân thủ tuyệt đối:** Không được tự ý sáng tạo cấu trúc mới. Phải dựa theo:
  - Backend: xem `docs/Backend.md`
  - Mobile: xem `docs/Frontend.md`
  - Website: xem `docs/website.md`

---

## 2. BACKEND GUIDELINES (Node.js + Express)

### 2.1. Kiến trúc Modular

- Code phải chia tách rõ ràng theo mô hình: **Controller ↔ Service ↔ Model/Repository**.
  - **Controller:** Chỉ nhận Request, Validate dữ liệu, gọi Service, trả về Response.
  - **Service:** Chứa toàn bộ logic nghiệp vụ (tính toán tiền, check voucher, gọi AI).
  - **Model:** Chỉ chứa các câu lệnh SQL query trực tiếp với Database.

### 2.2. Xử lý lỗi (Error Handling)

- Không dùng `console.log` bừa bãi. Sử dụng `logger` hoặc `next(error)` trong middleware.
- Mọi logic `async/await` phải được bọc trong `try/catch` hoặc dùng wrapper `asyncHandler`.

---

## 3. FRONTEND GUIDELINES (React & React Native/Expo)

### 3.1. Tách biệt Logic & UI (Separation of Concerns)

- **UI Components (View):** Chỉ nhận `props` và hiển thị. Không chứa logic gọi API hay xử lý phức tạp.
- **Custom Hooks (Logic):** Mọi logic gọi API, xử lý state, `useEffect` phải được tách ra thành Custom Hook (ví dụ: `useAuth`, `useBooking`, `useSocket`).
  - _Ví dụ:_ Không gọi `axios.get()` trực tiếp trong `useEffect` của Component. Hãy gọi qua `useLocationApi()`.

### 3.2. Styling

- **Website:** Sử dụng **TailwindCSS**. Không viết inline style (trừ trường hợp động).
- **Mobile:** Sử dụng `StyleSheet.create` hoặc thư viện styling đã cấu hình, hạn chế hard-code màu sắc (dùng biến từ `src/constants/colors.ts`).

### 3.3. Performance

- Sử dụng `useMemo` và `useCallback` cho các hàm hoặc tính toán phức tạp để tránh re-render không cần thiết.
- Với Mobile: Sử dụng `FlatList` thay vì `ScrollView` cho danh sách dài.

---

## 4. DATABASE RULES (MySQL)

- **SQL Queries:** Viết câu lệnh SQL tường minh, sử dụng `Prepared Statements` (dấu `?`) để chống SQL Injection.
- **Không sửa cấu trúc DB:** Code sinh ra phải tương thích với schema hiện tại (bảng `users` có cột `address`, bảng `vouchers` có `apply_to_service_type`...).

---

## 5. EXAMPLE (VÍ DỤ MẪU)

**Yêu cầu:** Viết hàm lấy danh sách Booking của User.

**Output mong đợi (Backend):**

```typescript
// src/modules/booking/booking.service.ts

/**
 * Lấy danh sách booking của một user cụ thể
 * @param userId - ID của người dùng
 * @returns Danh sách booking kèm thông tin địa điểm
 */
export const getUserBookings = async (userId: number): Promise<IBooking[]> => {
  // Query database, join với bảng locations để lấy tên địa điểm
  const sql = `
    SELECT b.*, l.location_name, l.first_image
    FROM bookings b
    JOIN locations l ON b.location_id = l.location_id
    WHERE b.user_id = ?
    ORDER BY b.booking_date DESC
  `;

  const [rows] = await db.execute(sql, [userId]);
  return rows as IBooking[];
};
```

---
