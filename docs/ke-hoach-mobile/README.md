# 📁 Kế hoạch Mobile — Mục lục

> Folder chứa toàn bộ tài liệu kế hoạch, đặc tả, và tiến độ phát triển Mobile App.

---

## Cấu trúc folder

```
docs/ke-hoach-mobile/
├── README.md                                        ← Bạn đang đọc
├── mobile-rebuild-plan.md                           ← Kế hoạch tổng thể (9 giai đoạn)
├── mobile-execution-steps.md                        ← Các bước chi tiết từng giai đoạn
├── mobile-feature-spec.md                           ← Đặc tả chức năng (05/06)
├── mobile-api-spec-vi.md                            ← Đặc tả API tiếng Việt (07/06)
├── mobile-requirements.md                           ← Yêu cầu tóm tắt (07/06)
├── bao-cao-he-thong-thong-bao.md                    ← Điều tra hệ thống thông báo (07/06)
│
├── buoc-1-foundation.md                             ← Kế hoạch Giai đoạn 1
├── buoc-2-auth-flow.md                              ← Kế hoạch Giai đoạn 2
├── buoc-3-tab-screens-va-notifications.md           ← Kế hoạch Giai đoạn 3 (07/06) ← MỚI
│
└── mobile-progress/                                 ← Tiến độ đã hoàn thành
    ├── 2026-06-05-g0-database-foundation.md
    ├── 2026-06-06-buoc-1-foundation.md
    ├── 2026-06-06-buoc-2-auth-flow.md
    └── 2026-06-07-safe-area-fix.md
```

---

## Tiến độ tổng quan

| Giai đoạn | Nội dung | Trạng thái | Ngày |
|-----------|----------|------------|------|
| G0 | Database Foundation | ✅ Hoàn thành | 2026-06-05 |
| 1 | Foundation (Theme, Types, API, Store) | ✅ Hoàn thành | 2026-06-06 |
| 2 | Auth Flow (Login, Register, OTP) | ✅ Hoàn thành | 2026-06-06 |
| 3 | Tab Screens + Notifications (Backend → Website → Mobile) | 🔄 Kế hoạch | 2026-06-07 |
| 4 | Map & Check-in | ⬜ Chưa bắt đầu | — |
| 5 | Location Detail | ⬜ Chưa bắt đầu | — |
| 6 | Booking Flow | ⬜ Chưa bắt đầu | — |
| 7 | Tickets & History | ⬜ Chưa bắt đầu | — |
| 8 | Voucher, Diary, SOS | ⬜ Chưa bắt đầu | — |
| 9 | Polish & Testing | ⬜ Chưa bắt đầu | — |

---

## Giai đoạn 3 — Tóm tắt

**7 bước, ~200 phút, thứ tự: Backend → Website → Mobile**

| Bước | Nội dung | Platform | Thời gian |
|------|----------|----------|-----------|
| 3.1 | DB Migration: thêm cột `type` | Backend | 15 phút |
| 3.2 | Backend: cập nhật INSERT + API | Backend | 30 phút |
| 3.3 | Website: trang Notifications riêng | Website | 40 phút |
| 3.4 | Mobile: Home Screen | Mobile | 45 phút |
| 3.5 | Mobile: Profile Screen | Mobile | 35 phút |
| 3.6 | Mobile: Notifications Screen | Mobile | 25 phút |
| 3.7 | Test toàn bộ | All | 15 phút |

---

## Tài liệu tham khảo

| File | Mục đích |
|------|----------|
| `mobile-rebuild-plan.md` | Kế hoạch 9 giai đoạn tổng thể |
| `mobile-execution-steps.md` | Chi tiết từng bước (test cases, UI mockup) |
| `mobile-feature-spec.md` | Đặc tả chức năng đầy đủ |
| `mobile-api-spec-vi.md` | Danh sách API + ràng buộc nghiệp vụ |
| `mobile-requirements.md` | Yêu cầu tóm tắt cho AI Studio |
| `bao-cao-he-thong-thong-bao.md` | Điều tra hệ thống thông báo |

---

*Cập nhật: 2026-06-07*
