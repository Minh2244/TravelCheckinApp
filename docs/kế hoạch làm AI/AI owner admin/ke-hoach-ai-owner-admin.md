# Kế hoạch chi tiết AI cho Owner và Admin

**Cập nhật:** 2026-06-25
**Phạm vi:** Website Dashboard Owner/Admin
**Định hướng:** Trợ lý quản trị theo ngữ cảnh màn hình, dùng Gemini để hiểu ngôn ngữ và Backend Node.js để kiểm soát quyền
**Mức độ tổng thể:** Rất cao
**Điều kiện tiên quyết:** Khóa tuyệt đối AI Owner khỏi cụm vận hành và hoàn thiện permission, confirmation, audit
**Yêu cầu bắt buộc (Strict Requirement):** Bất cứ ai tham gia phát triển và tích hợp AI cho cụm Owner/Admin phải tuân thủ CHÍNH XÁC và NGHIÊM NGẶT 100% theo các quy tắc, phạm vi, và giới hạn đã được vạch ra trong bản kế hoạch này. Tuyệt đối không được vượt quyền hoặc tự ý nới lỏng các ràng buộc bảo mật.

---

## 1. Kết luận đánh giá

Mục tiêu là tạo một trợ lý AI hiểu câu hỏi, biết Owner/Admin đang ở màn hình nào và hỗ trợ theo đúng phạm vi được cấp.

Phạm vi đã chốt:

- **Owner:** AI chỉ hoạt động trong khu vực quản trị ngoài vận hành.
- **Owner:** AI không được tạo, sửa hoặc xóa địa điểm và dịch vụ.
- **Owner:** AI không xuất hiện và không truy cập dữ liệu ở cụm vận hành.
- **Admin:** AI có thể hỗ trợ toàn bộ chức năng Admin.
- **Cả hai:** AI không được tự sinh hoặc chạy SQL.
- Hành động ghi dữ liệu phải qua Backend, kiểm quyền và xác nhận.

### Hướng kiến trúc

AI chỉ tạo một `ActionPlan` có cấu trúc. Backend Node.js:

1. Xác thực user và role.
2. Kiểm tra phạm vi owner/location.
3. Resolve entity từ database.
4. Validate dữ liệu.
5. Kiểm tra route và phạm vi AI của role.
6. Hiển thị bản xem trước.
7. Yêu cầu xác nhận nếu có ghi dữ liệu.
8. Gọi service nghiệp vụ hiện có.
9. Ghi audit log và kết quả.

Gemini không kết nối MySQL, không biết database credential và không chạy SQL theo nội dung hội thoại.

### Độ khó

| Cụm | Độ khó | Nhận xét |
|---|---:|---|
| Read-only command | Trung bình | Ít rủi ro, nên làm đầu tiên |
| Hiểu ngữ cảnh màn hình | Trung bình - Cao | Frontend phải truyền context có kiểm soát |
| Entity extraction | Cao | Tên location, voucher, review và thời gian dễ mơ hồ |
| Write action Owner ngoài vận hành | Cao | Cần allowlist, preview và xác nhận |
| Write action Admin | Rất cao | Phạm vi ảnh hưởng lớn |
| Theo dõi chất lượng prompt/action | Cao | Cần log, evaluation và rollback prompt/model |
| Tạo câu trả lời review | Trung bình | Gemini tạo bản nháp, Owner duyệt |

**Ước lượng:** 20-35 ngày công cho phiên bản có kiểm soát; 35-50 ngày công nếu Admin có đầy đủ action ghi dữ liệu.

---

## 2. Phạm vi đúng của hệ thống

### Có trong phạm vi

- Hiểu câu hỏi và câu lệnh tiếng Việt bằng Gemini.
- Biết màn hình hiện tại qua context có cấu trúc.
- Giải thích dữ liệu đang hiển thị.
- Điều hướng tới màn hình được phép.
- Trả lời thống kê tổng hợp từ dữ liệu thật.
- Tạo bản xem trước hành động.
- Thực thi hành động qua handler đã đăng ký.
- Lưu lịch sử, độ tin cậy, xác nhận và audit.
- Quản lý prompt, action và quality evaluation.

### Cấm tuyệt đối đối với AI Owner

- Không hiện AI trong route vận hành.
- Không nhận context từ màn hình vận hành.
- Không đọc danh sách booking, check-in, phòng, bàn, order, vé hoặc thanh toán tại quầy.
- Không xác nhận/từ chối booking.
- Không check-in/check-out.
- Không mở, đặt, chuyển hoặc thanh toán bàn.
- Không bán hoặc soát vé.
- Không thay đổi phòng/bàn/trạng thái vận hành.
- Không tạo, sửa hoặc xóa địa điểm.
- Không tạo, sửa hoặc xóa dịch vụ.
- Không sửa cấu hình sơ đồ vận hành.
- Không thay đổi tài khoản ngân hàng, mật khẩu hoặc thông tin bảo mật.

### Route Owner bị chặn

```text
/owner/front-office
/owner/front-office/*
/owner/navigate
/owner/location-ops/*
/employee/front-office
/employee/front-office/*
/owner/bookings
/owner/payments
```

Các trang/code tương ứng:

```text
FrontOffice.tsx
FrontOfficeHotel.tsx
FrontOfficeRestaurant.tsx
FrontOfficeTourist.tsx
FrontOfficePaymentsHistory.tsx
FrontOfficeTouristTicketsHistory.tsx
OwnerBookings.tsx
OwnerPayments.tsx
OwnerLocationOpsConfig.tsx
```

### Không có trong phạm vi chung

- Tự sinh SQL.
- Tự động thực thi hành động nguy hiểm.
- Tự rollback thanh toán.
- Thay thế toàn bộ dashboard Owner/Admin.

---

## 3. Cách AI hiểu yêu cầu

### 3.1. Gemini hiểu ngôn ngữ và context

Ví dụ:

```text
"Tóm tắt các đánh giá xấu của địa điểm đang chọn"
=> intent: owner_review_summary
=> current_page: owner_reviews
=> selected_location_id: 5
```

Gemini là bộ phận hiểu ngôn ngữ chính. Không cần tự huấn luyện classifier riêng cho phiên bản đầu.

### 3.2. Context màn hình

Ví dụ:

```json
{
  "current_page": "owner_reviews",
  "selected_location_id": 5,
  "filters": {
    "rating": 1
  },
  "visible_review_ids": [120, 121]
}
```

Frontend chỉ gửi ID, bộ lọc và loại màn hình. Không gửi toàn bộ DOM, ảnh chụp màn hình, token hoặc dữ liệu nhạy cảm.

### 3.3. Tạo nội dung

Gemini có thể:

- Tóm tắt báo cáo.
- Giải thích biểu đồ.
- Soạn phản hồi review.
- Soạn nội dung voucher.
- Đề xuất bước xử lý.

Nội dung do AI soạn luôn là bản nháp trước khi đăng hoặc lưu.

---

## 4. Kiến trúc đề xuất

```text
Owner/Admin Website
       |
       v
Backend Node.js
  |-- Authentication / RBAC
  |-- Command Orchestrator
  |-- Action Registry
  |-- Entity Resolver
  |-- Policy Engine
  |-- Preview / Confirmation
  |-- Existing Business Services
  |-- Audit / Idempotency
       |
       +--> MySQL
       |
       +--> Gemini API
              |-- hiểu câu hỏi
              |-- chọn action từ allowlist
              |-- tạo nội dung/tóm tắt
```

### Runtime flow

1. Owner nhập: “Tóm tắt review xấu của địa điểm này”.
2. Website gửi text và context của trang review.
3. Node.js kiểm tra route hiện tại có cho AI Owner hoạt động hay không.
4. Node.js gửi Gemini danh sách action Owner được phép.
5. Backend tạo `ActionPlan`.
6. UI hiển thị:
   - Tóm tắt review.
   - Review liên quan.
   - Đề xuất phản hồi.
7. Owner có thể sửa bản nháp.
8. Nếu Owner chọn đăng phản hồi, Backend yêu cầu xác nhận rồi gọi handler.
9. Ghi `ai_action_runs` và `audit_logs`.
10. Trả kết quả.

---

## 5. Chuẩn ActionPlan

```ts
type ActionPlan = {
  command_id: string;
  actor: {
    user_id: number;
    role: "owner" | "admin";
  };
  intent: string;
  confidence: number;
  risk_level: "read" | "low" | "medium" | "high" | "critical";
  entities: Record<string, unknown>;
  resolved_entities: Record<string, unknown>;
  summary: string;
  warnings: string[];
  requires_confirmation: boolean;
  confirmation_mode: "none" | "button" | "typed_phrase" | "reauth";
  expires_at: string;
};
```

Model không trả:

- SQL.
- URL API tùy ý.
- Tên handler tùy ý ngoài action registry.
- user_id/owner_id được tin trực tiếp.

Backend tự lấy actor từ access token.

---

## 6. Action Registry

Mỗi action được viết bằng code và khai báo:

```ts
type ActionDefinition = {
  intent: string;
  roles: Array<"owner" | "admin">;
  riskLevel: "read" | "low" | "medium" | "high" | "critical";
  schema: unknown;
  preview: (context: ActionContext) => Promise<ActionPreview>;
  execute: (context: ActionContext) => Promise<ActionResult>;
};
```

### Quy tắc

- Chỉ intent có trong registry mới được thực thi.
- Handler tái sử dụng service nghiệp vụ hiện có.
- Không gọi lại controller qua HTTP nội bộ nếu có thể gọi service trực tiếp.
- Transaction bắt buộc cho action ghi nhiều bảng.
- Mỗi action có idempotency key.
- Action hết hạn phải parse lại.

---

## 7. Danh mục chức năng

### Owner được phép

| Nhóm | Ví dụ AI hỗ trợ | Quyền |
|---|---|---|
| Dashboard | Giải thích biểu đồ và số liệu tổng hợp | Đọc |
| Doanh thu tổng hợp | So sánh doanh thu theo kỳ từ báo cáo tổng hợp | Đọc |
| Địa điểm | Tóm tắt tình trạng và mở đúng trang | Đọc/điều hướng |
| Dịch vụ | Tóm tắt số lượng, trạng thái và mở đúng trang | Đọc/điều hướng |
| Voucher | Phân tích hiệu quả, soạn bản nháp voucher | Đọc/draft |
| Review | Tóm tắt đánh giá, soạn phản hồi | Đọc/draft/đăng sau xác nhận |
| Commission | Giải thích công nợ và lịch sử | Đọc |
| Logs | Tìm và giải thích log hoạt động | Đọc |
| Hồ sơ | Hướng dẫn Owner tự thao tác | Hướng dẫn |

### Owner bị cấm

| Nhóm | Phạm vi cấm |
|---|---|
| Vận hành | Toàn bộ Front Office |
| Booking | Xem chi tiết hoặc thay đổi trạng thái booking |
| Check-in/out | Mọi thao tác và dữ liệu chi tiết |
| Phòng/bàn/POS | Mọi dữ liệu và thao tác |
| Vé tại quầy | Bán, quét, xác nhận và lịch sử |
| Thanh toán vận hành | Tạo, xác nhận hoặc xem chi tiết giao dịch tại quầy |
| Địa điểm | Tạo, sửa, xóa |
| Dịch vụ | Tạo, sửa, xóa, đổi trạng thái |
| Cấu hình vận hành | Sơ đồ phòng/bàn/khu vực |
| Bảo mật/tài chính | Tài khoản ngân hàng, mật khẩu, phân quyền nhân viên |

AI có thể nói “Chức năng này cần Owner tự thao tác” và đưa hướng dẫn chung, nhưng không được mở route bị chặn hoặc gửi dữ liệu màn hình đó tới Gemini.

### Phase read-only Admin

| Intent | Ví dụ | Rủi ro |
|---|---|---|
| `admin_platform_revenue` | Doanh thu toàn hệ thống tháng này | Read |
| `admin_pending_approvals` | Có bao nhiêu dịch vụ chờ duyệt? | Read |
| `admin_owner_risk_summary` | Owner nào bị báo cáo nhiều? | Read |
| `admin_ai_health` | AI hôm nay lỗi bao nhiêu lần? | Read |

### Phase write Admin

| Intent | Ví dụ | Rủi ro |
|---|---|---|
| `admin_create_system_voucher_draft` | Soạn voucher toàn hệ thống | High |
| `admin_review_owner_service` | Duyệt dịch vụ X | High |
| `admin_suspend_location` | Tạm ẩn địa điểm Y | High |
| `admin_lock_account` | Khóa tài khoản Z | Critical |

Critical action cần typed phrase hoặc re-auth, không chỉ nút xác nhận.

---

## 8. Permission và an toàn

### Owner

- Chỉ đọc/phân tích location thuộc quyền sở hữu.
- Không được truyền `owner_id` để mở rộng scope.
- Entity resolver luôn thêm `owner_id = actor.user_id`.
- Nếu có nhiều location trùng tên, bắt buộc hỏi lại.
- Policy Engine từ chối toàn bộ action có tag `owner_operations`.
- Policy Engine từ chối CRUD `location` và `service` cho AI Owner.
- Frontend không mount AI bubble trong route cấm.
- Backend vẫn từ chối nếu client giả mạo route/context.
- Nhân viên `employee` không được sử dụng AI Owner trong phiên bản đầu.

### Admin

- Chia permission theo chức năng, không chỉ dựa vào role `admin`.
- Critical action cần lý do.
- Một số action có thể yêu cầu two-person approval trong phase nâng cao.

### Mức xác nhận

| Risk | Xác nhận |
|---|---|
| Read | Không |
| Low | Nút xác nhận tùy action |
| Medium | Preview + nút xác nhận |
| High | Preview + nhập câu xác nhận |
| Critical | Re-auth/OTP + audit đầy đủ |

### Không tự rollback chung

Mỗi action phải định nghĩa riêng:

- Có thể rollback hay không.
- Thời hạn rollback.
- Dữ liệu snapshot cần lưu.
- Ai được quyền rollback.

AI Owner không được gọi bất kỳ action vận hành nào, vì vậy không tồn tại rollback vận hành cho Owner.

---

## 9. Gemini và context màn hình

### Dữ liệu Frontend được phép gửi

```ts
type AssistantScreenContext = {
  role: "owner" | "admin";
  page_key: string;
  route: string;
  selected_location_id?: number;
  selected_entity_ids?: number[];
  filters?: Record<string, string | number | boolean>;
  summary?: Record<string, unknown>;
};
```

### Dữ liệu không được gửi

- Toàn bộ DOM.
- Ảnh chụp màn hình mặc định.
- Access token/refresh token.
- Password, OTP hoặc thông tin ngân hàng.
- Dữ liệu vận hành Owner.
- Dữ liệu không hiển thị hoặc không thuộc quyền actor.

### Gemini chỉ được chọn tool có sẵn

Backend gửi danh sách tool/action đã lọc theo:

- Role.
- Route.
- Permission.
- Feature flag.
- Risk level.

Nếu Owner đang ở route bị cấm, API trả:

```json
{
  "success": false,
  "code": "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE",
  "message": "Trợ lý AI không hoạt động trong khu vực vận hành."
}
```

---

## 10. Feedback và đánh giá chất lượng

- User có thể đánh dấu hữu ích/không hữu ích.
- Lưu action Gemini đã đề xuất và kết quả Backend.
- Lưu lỗi do chọn sai action, thiếu entity hoặc bị Policy Engine chặn.
- Dùng bộ câu hỏi cố định để kiểm thử khi đổi prompt/model.
- Không tự học hoặc tự thay đổi quyền từ nội dung hội thoại.
- Admin có thể đổi model/prompt qua cấu hình, nhưng phải có version và rollback cấu hình.

### Chỉ số

- Tỷ lệ chọn đúng action.
- Tỷ lệ bị Policy Engine chặn.
- Tỷ lệ user hủy ở bước xác nhận.
- Tỷ lệ action thành công.
- Thời gian phản hồi.
- Tỷ lệ AI Owner cố truy cập phạm vi cấm phải bằng 0 ở tầng thực thi.

---

## 11. Database đề xuất

Schema AI phải dùng chung cho User, Owner và Admin:

- `ai_conversations`: phân biệt bằng `assistant_scope`.
- `ai_chat_history`: lưu hội thoại, context và metadata.
- `ai_assistant_feedback`: dùng chung đánh giá.
- `ai_action_runs`: chỉ dành cho action Owner/Admin.
- `ai_action_policies`: allowlist, risk và confirmation.
- `ai_prompt_versions`: quản lý prompt/model configuration.
- `ai_training_examples`, `ai_model_versions`: chỉ tạo khi bật nhánh tự huấn luyện.

SQL đầy đủ nằm tại Mục 19. Không tạo thêm `ai_command_sessions`, `ai_command_messages`, `owner_ai_history` hoặc `admin_ai_history` vì sẽ trùng dữ liệu.

---

## 12. API Backend Node.js

Quy ước:

- `/api/owner/ai/*`: trợ lý Owner ngoài vận hành.
- `/api/admin/ai/*`: trợ lý Admin và quản trị AI.
- API chat tạo ActionPlan nhưng không tự thực thi write action.
- API confirm mới được gọi Action Registry.
- API nghiệp vụ hiện có được gọi qua service/handler Backend, không đưa URL tùy ý cho Gemini.
- Ma trận endpoint đầy đủ nằm tại Mục 20 và 21.

### Trạng thái ActionPlan

```text
parsed
needs_clarification
awaiting_confirmation
executing
succeeded
failed
expired
cancelled
blocked
```

---

## 13. Kế hoạch triển khai theo phase

### OA0 - Action catalog và security foundation

**Độ khó:** Cao
**Ước lượng:** 4-6 ngày công

- Liệt kê toàn bộ intent.
- Map intent với API/service hiện có.
- Phân risk level.
- Xây Action Registry.
- Xây Policy Engine.
- Chuẩn ActionPlan.
- Audit, idempotency và expiration.
- Khai báo route Owner bị cấm.
- Không mount AI bubble ở Front Office/booking/payment.
- Backend test giả mạo route/context.

**Hoàn thành khi:**

- Có thể gọi action handler bằng payload cấu trúc trong test.
- Owner không truy cập được dữ liệu owner khác.
- Owner không truy cập được bất kỳ action `owner_operations`.
- High/critical action không chạy khi chưa xác nhận.

### OA1 - Trợ lý Owner ngoài vận hành

**Độ khó:** Trung bình - Cao
**Ước lượng:** 4-6 ngày công

- Kết nối Gemini.
- Gửi context trang theo allowlist.
- Giải thích Dashboard và báo cáo tổng hợp.
- Tóm tắt voucher, review, commission và logs.
- Điều hướng tới trang Owner được phép.
- Soạn bản nháp phản hồi review/voucher.
- Không truy cập Front Office, booking hoặc payment.

**Hoàn thành khi:**

- AI bubble không xuất hiện trong route cấm.
- Backend chặn 100% tool vận hành của Owner.
- AI mở đúng trang quản trị được phép.

### OA2 - Hành động Owner ngoài vận hành

**Độ khó:** Cao
**Ước lượng:** 4-7 ngày công

- Voucher draft.
- Review reply draft và đăng sau xác nhận.
- Các thao tác quản lý không thuộc location/service CRUD.
- Preview và confirmation.
- Transaction và idempotency.
- Audit chi tiết.

**Hoàn thành khi:**

- Không có action ghi dữ liệu chạy ngay sau bước parse.
- Nhấn xác nhận hai lần không tạo tác động lặp.
- AI không thể tạo/sửa/xóa location hoặc service.
- AI không thể gọi endpoint vận hành.

### OA3 - Admin controlled actions

**Độ khó:** Rất cao
**Ước lượng:** 6-10 ngày công

- Read-only analytics trước.
- High-risk actions triển khai từng intent.
- Typed confirmation/re-auth.
- Permission chi tiết.
- Reason bắt buộc.
- Có feature flag tắt riêng từng action.

**Hoàn thành khi:**

- Mọi action Admin truy vết được actor, input, preview và kết quả.
- Critical action có test permission và confirmation.

### OA4 - Quản lý prompt, action và chất lượng

**Độ khó:** Cao
**Ước lượng:** 3-5 ngày công

- Feedback hữu ích/không hữu ích.
- Prompt version.
- Action enable/disable.
- Bộ câu hỏi evaluation.
- So sánh kết quả khi đổi model/prompt.
- Rollback cấu hình.
- Gemini health dashboard.

**Hoàn thành khi:**

- Có thể quay lại prompt/model configuration trước.
- Có metrics theo action và role.
- Không thể bật action Owner thuộc danh sách cấm.

### OA5 - Text generation tùy chọn

**Độ khó:** Trung bình nếu dùng template, cao nếu dùng LLM
**Ước lượng:** 2-6 ngày công

- Reply review draft.
- Nội dung voucher draft.
- Thông báo cho khách.
- Template trước, LLM sau.
- Nội dung luôn cần Owner/Admin duyệt.

---

## 14. UI yêu cầu

### Command panel

- Composer.
- Lịch sử lệnh.
- Confidence không cần hiển thị kỹ thuật mặc định.
- Clarification form khi thiếu entity.
- Action preview rõ dữ liệu trước/sau.
- Nút xác nhận/hủy.
- Kết quả và link mở màn hình liên quan.

### AI management dashboard Admin

- Lịch sử hội thoại/action.
- Lọc theo role, action và kết quả.
- Prompt version.
- Model configuration.
- Action allowlist.
- Evaluation results.
- Activate và rollback cấu hình.

Không dùng chat UI để che giấu form quan trọng. AI có thể soạn voucher draft, nhưng Owner phải xem form và xác nhận. AI Owner không được điền form location/service.

---

## 15. Kiểm thử bắt buộc

### Hiểu ngôn ngữ và context

- Tiếng Việt có dấu/không dấu.
- Viết tắt.
- Sai chính tả.
- Nhiều entity cùng tên.
- Câu ngoài phạm vi.
- Hai intent trong một câu.
- Câu phủ định.
- Context route bị giả mạo.
- Context chứa entity không hiển thị.

### Security

- Owner cố thao tác location người khác.
- Owner yêu cầu AI mở Front Office.
- Owner yêu cầu duyệt booking hoặc xem phòng/bàn.
- Owner yêu cầu tạo/sửa/xóa location/service.
- User sửa command ID.
- Replay request confirm.
- Expired plan.
- Model trả intent không nằm trong allowlist.
- Prompt chứa SQL hoặc yêu cầu bỏ qua quyền.

### Business

- Entity không tồn tại.
- Voucher thiếu điều kiện.
- Transaction rollback khi handler lỗi.
- Confirm hai lần.
- Concurrent update.
- Frontend không mount bubble nhưng API bị gọi thủ công.

### Prompt/model configuration

- Evaluation questions cố định.
- So sánh cấu hình mới/cũ.
- Tool selection accuracy.
- Policy violation tests.
- Rollback.

---

## 16. Rủi ro chính

| Rủi ro | Cách xử lý |
|---|---|
| Gemini hiểu sai | Tool allowlist + preview + confirmation |
| Entity mơ hồ | DB resolver và clarification |
| Action chạy lặp | Idempotency key |
| Owner vượt quyền | Scope lấy từ token, không tin entity actor |
| AI Owner vào vận hành | Chặn UI, route policy và action policy |
| Prompt/model mới kém hơn | Version, evaluation và rollback |
| Gemini lỗi | Timeout và UI fallback |
| Rollback nguy hiểm | Chỉ hỗ trợ rollback riêng từng action |

---

## 17. Thứ tự triển khai đề xuất

1. Hoàn thành AI User foundation để tái sử dụng Gemini provider, logging và feature flag.
2. OA0 route/action security.
3. OA1 Owner ngoài vận hành.
4. Admin read-only.
5. OA2 Owner action ngoài vận hành.
6. OA3 Admin full action có kiểm soát.
7. OA4 prompt/action quality management.

Không nên triển khai ngay “khóa tài khoản”, “duyệt hàng loạt”, “xóa”, “thanh toán” hoặc “rollback” bằng chat trong MVP.

---

## 18. Quyết định công nghệ

| Hạng mục | Quyết định |
|---|---|
| Orchestrator và quyền | Node.js Backend hiện tại |
| Hiểu ngôn ngữ | Gemini API dùng chung provider với AI User |
| Context màn hình | JSON allowlist từ Website |
| Entity MVP | Rule parser + DB resolver |
| Database | MySQL hiện tại |
| Action execution | Action Registry gọi business service hiện có |
| Audit | `ai_action_runs` + `audit_logs` |
| Quản lý chất lượng | Prompt version, evaluation và rollback |
| Owner operations | Cấm tuyệt đối ở UI và Backend |
| Admin | Full action catalog, xác nhận theo risk level |
| Python | Tùy chọn cho guard classifier tự huấn luyện |

---

## 19. Đánh giá database hiện tại

### 19.1. Bảng có thể tái sử dụng

| Bảng | Trạng thái | Mục đích |
|---|---|---|
| `ai_chat_history` | Dùng được một phần | Lưu prompt, response, token, latency và lỗi |
| `audit_logs` | Dùng tốt | Ghi audit cuối cùng của action nghiệp vụ |
| `system_settings` | Có cấu trúc nhưng thiếu seed AI | Feature flag, maintenance, model và policy |
| `users` | Có | Actor, role và trạng thái tài khoản |
| Các bảng nghiệp vụ | Có | Nguồn dữ liệu/action cho Owner/Admin |

### 19.2. Kết luận đủ hay chưa

- **Đủ cho demo hỏi đáp không thực thi:** Có.
- **Đủ cho trợ lý nhìn context và thực hiện action:** Chưa.
- Chưa có conversation scope phân biệt User/Owner/Admin.
- Chưa lưu ActionPlan, bước xác nhận, idempotency và kết quả.
- Chưa có allowlist action trong database.
- Chưa có prompt version và feedback.
- Nếu làm nhánh tự huấn luyện, chưa có training examples và model versions.

### 19.3. Dùng chung schema AI User

Tái sử dụng các thay đổi đã mô tả trong kế hoạch AI User:

- `ai_conversations` với `assistant_scope`.
- Mở rộng `ai_chat_history` có `conversation_id`, `response_type`, `status`.
- `ai_assistant_feedback`.
- Seed `system_settings`.

Phải chạy migration nền trong kế hoạch AI User trước, sau đó mới chạy các bảng Owner/Admin bên dưới. Thứ tự này bảo đảm các khóa ngoại tới `ai_conversations` và `ai_chat_history` được tạo hợp lệ.

Không tạo riêng `owner_ai_history` hoặc `admin_ai_history`.

### 19.4. Tạo `ai_action_runs`

```sql
CREATE TABLE ai_action_runs (
  run_id BIGINT NOT NULL AUTO_INCREMENT,
  command_id CHAR(36) NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  history_id INT DEFAULT NULL,
  actor_user_id INT NOT NULL,
  assistant_scope ENUM('owner','admin') NOT NULL,
  route VARCHAR(255) DEFAULT NULL,
  page_key VARCHAR(100) DEFAULT NULL,
  action_key VARCHAR(150) NOT NULL,
  risk_level ENUM('read','low','medium','high','critical') NOT NULL,
  action_plan JSON NOT NULL,
  status ENUM(
    'parsed','needs_clarification','awaiting_confirmation',
    'executing','succeeded','failed','expired','cancelled','blocked'
  ) NOT NULL,
  confirmation_mode ENUM('none','button','typed_phrase','reauth')
    NOT NULL DEFAULT 'none',
  confirmed_at TIMESTAMP NULL,
  executed_at TIMESTAMP NULL,
  result_json JSON DEFAULT NULL,
  error_code VARCHAR(100) DEFAULT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  model_name VARCHAR(100) DEFAULT NULL,
  prompt_version VARCHAR(50) DEFAULT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id),
  UNIQUE KEY uniq_ai_command_id (command_id),
  UNIQUE KEY uniq_ai_action_idempotency (idempotency_key),
  KEY idx_ai_action_actor_time (actor_user_id, created_at),
  KEY idx_ai_action_scope_status (assistant_scope, status, created_at),
  CONSTRAINT fk_ai_action_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_ai_action_conversation
    FOREIGN KEY (conversation_id)
    REFERENCES ai_conversations(conversation_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ai_action_history
    FOREIGN KEY (history_id)
    REFERENCES ai_chat_history(history_id)
    ON DELETE SET NULL
);
```

### 19.5. Tạo `ai_action_policies`

```sql
CREATE TABLE ai_action_policies (
  action_key VARCHAR(150) NOT NULL,
  role_scope ENUM('owner','admin') NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  risk_level ENUM('read','low','medium','high','critical') NOT NULL,
  requires_confirmation TINYINT(1) NOT NULL DEFAULT 0,
  confirmation_mode ENUM('none','button','typed_phrase','reauth')
    NOT NULL DEFAULT 'none',
  blocked_routes JSON DEFAULT NULL,
  allowed_routes JSON DEFAULT NULL,
  policy_config JSON DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (action_key, role_scope),
  CONSTRAINT fk_ai_policy_admin
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL
);
```

Các action cấm của Owner vẫn phải hard-code deny trong Backend. Bảng policy chỉ được phép làm chặt hơn, không được mở khóa các action cấm tuyệt đối.

### 19.6. Tạo `ai_prompt_versions`

```sql
CREATE TABLE ai_prompt_versions (
  prompt_version VARCHAR(50) NOT NULL,
  assistant_scope ENUM('user','owner','admin') NOT NULL,
  prompt_text MEDIUMTEXT NOT NULL,
  allowed_actions JSON DEFAULT NULL,
  model_name VARCHAR(100) DEFAULT NULL,
  evaluation_result JSON DEFAULT NULL,
  status ENUM('draft','testing','active','archived') NOT NULL DEFAULT 'draft',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP NULL,
  PRIMARY KEY (prompt_version, assistant_scope),
  CONSTRAINT fk_ai_prompt_admin
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL
);
```

### 19.7. Bảng cho nhánh tự huấn luyện tùy chọn

#### `ai_training_examples`

```sql
CREATE TABLE ai_training_examples (
  example_id BIGINT NOT NULL AUTO_INCREMENT,
  text_input TEXT NOT NULL,
  role_scope ENUM('owner','admin') NOT NULL,
  intent_label VARCHAR(150) NOT NULL,
  entities_json JSON DEFAULT NULL,
  source ENUM('seed','feedback','manual','synthetic') NOT NULL,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT DEFAULT NULL,
  dataset_version VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (example_id),
  KEY idx_ai_training_label_status
    (role_scope, intent_label, review_status),
  CONSTRAINT fk_ai_training_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL
);
```

#### `ai_model_versions`

```sql
CREATE TABLE ai_model_versions (
  model_version VARCHAR(50) NOT NULL,
  model_type VARCHAR(100) NOT NULL,
  artifact_path VARCHAR(500) NOT NULL,
  dataset_version VARCHAR(50) NOT NULL,
  metrics_json JSON NOT NULL,
  status ENUM('candidate','active','rejected','archived') NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP NULL,
  PRIMARY KEY (model_version),
  CONSTRAINT fk_ai_model_admin
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL
);
```

### 19.8. Seed settings Owner/Admin

```sql
INSERT IGNORE INTO system_settings
  (setting_key, setting_value, setting_type)
VALUES
  ('ai_owner_enabled', '1', 'text'),
  ('ai_admin_enabled', '1', 'text'),
  ('ai_owner_model', '', 'text'),
  ('ai_admin_model', '', 'text'),
  ('ai_owner_operations_blocked', '1', 'text'),
  ('ai_owner_location_service_crud_blocked', '1', 'text'),
  ('ai_action_confirmation_ttl_seconds', '300', 'text'),
  ('ai_training_guard_enabled', '0', 'text');
```

---

## 20. API AI Owner

### 20.1. API cần tạo

| API | Chức năng | Ghi chú |
|---|---|---|
| `POST /api/owner/ai/chat` | Hỏi đáp theo context màn hình | Từ chối route vận hành |
| `POST /api/owner/ai/conversations` | Tạo cuộc chat mới | Scope cố định là owner |
| `GET /api/owner/ai/conversations` | Danh sách cuộc chat Owner | Chỉ actor hiện tại |
| `GET /api/owner/ai/conversations/:id/messages` | Lịch sử một cuộc chat | Kiểm tra ownership |
| `DELETE /api/owner/ai/conversations/:id` | Xóa/ẩn cuộc chat | Soft delete |
| `POST /api/owner/ai/actions/:commandId/confirm` | Xác nhận action được phép | Idempotency bắt buộc |
| `POST /api/owner/ai/actions/:commandId/cancel` | Hủy ActionPlan | Không chạy handler |
| `GET /api/owner/ai/action-runs` | Lịch sử action của Owner | Không trả dữ liệu owner khác |
| `POST /api/owner/ai/messages/:historyId/feedback` | Đánh giá câu trả lời | Dùng bảng feedback chung |
| `GET /api/owner/ai/capabilities` | Trả route/action được phép | Frontend quyết định mount bubble |
| `GET /api/owner/ai/context/dashboard` | Dữ liệu Dashboard đã tổng hợp | Không trả booking/phòng/bàn chi tiết |

### 20.2. API nghiệp vụ Owner được kết nối

| Chức năng AI | API hiện có | Quyền |
|---|---|---|
| Tóm tắt địa điểm | `GET /api/owner/locations` | Đọc |
| Tóm tắt dịch vụ | `GET /api/owner/locations/:locationId/services` | Đọc |
| Phân tích voucher | `GET /api/owner/vouchers`, `/vouchers/stats` | Đọc |
| Xem lịch sử voucher | `GET /api/owner/vouchers/:id/usage-history` | Đọc |
| Soạn voucher draft | Không gọi API ghi | Trả draft cho form |
| Lưu voucher sau xác nhận | `POST /api/owner/vouchers` | Write có xác nhận |
| Sửa voucher | `PUT /api/owner/vouchers/:id` | Write có xác nhận |
| Xóa voucher | `DELETE /api/owner/vouchers/:id` | High, typed confirmation |
| Tóm tắt review | `GET /api/owner/reviews` | Đọc |
| Đăng reply sau xác nhận | `POST /api/owner/reviews/:id/reply` | Write có xác nhận |
| Ẩn review | `PUT /api/owner/reviews/:id/hide` | Write có xác nhận |
| Báo cáo user review | `POST /api/owner/reviews/:id/report-user` | Write có xác nhận |
| Xóa review | `DELETE /api/owner/reviews/:id` | High, typed confirmation |
| Giải thích commission | `GET /api/owner/commissions` | Đọc |
| Tạo yêu cầu thanh toán commission | `POST /api/owner/commissions/payment-request` | High, re-auth khuyến nghị |
| Đối soát commission thủ công | `POST /api/owner/commissions/reconcile` | High, typed confirmation |
| Giải thích logs | `GET /api/owner/profile/audit-logs` | Đọc |

### 20.3. API Owner AI bị cấm kết nối

```text
/api/owner/bookings*
/api/owner/payments*
/api/owner/checkins*
/api/owner/front-office*
POST/PUT/DELETE /api/owner/locations*
POST/PUT/DELETE /api/owner/services*
/api/owner/bank*
/api/owner/employees*
```

Policy kiểm tra bằng action key và method/path. Không dựa hoàn toàn vào route Frontend do client có thể giả mạo.

---

## 21. API AI Admin

### 21.1. API điều phối cần tạo

| API | Chức năng |
|---|---|
| `POST /api/admin/ai/chat` | Hỏi đáp, tạo ActionPlan |
| `POST /api/admin/ai/conversations` | Tạo cuộc chat Admin |
| `GET /api/admin/ai/conversations` | Danh sách cuộc chat |
| `GET /api/admin/ai/conversations/:id/messages` | Lịch sử |
| `DELETE /api/admin/ai/conversations/:id` | Xóa/ẩn cuộc chat |
| `POST /api/admin/ai/actions/:commandId/confirm` | Xác nhận action |
| `POST /api/admin/ai/actions/:commandId/cancel` | Hủy action |
| `GET /api/admin/ai/actions` | Danh mục action và policy |
| `PUT /api/admin/ai/actions/:actionKey` | Bật/tắt, đổi confirmation |
| `GET /api/admin/ai/action-runs` | Lịch sử thực thi |
| `GET /api/admin/ai/action-runs/:runId` | Chi tiết ActionPlan/kết quả |
| `GET /api/admin/ai/prompt-versions` | Danh sách prompt |
| `POST /api/admin/ai/prompt-versions` | Tạo prompt candidate |
| `POST /api/admin/ai/prompt-versions/:version/activate` | Kích hoạt |
| `POST /api/admin/ai/prompt-versions/:version/rollback` | Quay lại version trước |
| `POST /api/admin/ai/messages/:historyId/feedback` | Feedback |
| `GET /api/admin/ai/capabilities` | Danh mục khả năng đang bật |

### 21.2. API quản lý huấn luyện tùy chọn

| API | Chức năng |
|---|---|
| `GET /api/admin/ai/training/examples` | Danh sách mẫu huấn luyện |
| `POST /api/admin/ai/training/examples` | Thêm mẫu thủ công |
| `PUT /api/admin/ai/training/examples/:id` | Sửa label/entity và duyệt |
| `DELETE /api/admin/ai/training/examples/:id` | Loại mẫu sai |
| `POST /api/admin/ai/training/import` | Import CSV/JSON |
| `GET /api/admin/ai/training/export` | Xuất dataset approved |
| `POST /api/admin/ai/training/run` | Yêu cầu Python train candidate |
| `GET /api/admin/ai/models` | Danh sách model version |
| `GET /api/admin/ai/models/:version/evaluation` | Metrics/confusion matrix |
| `POST /api/admin/ai/models/:version/activate` | Kích hoạt guard model |
| `POST /api/admin/ai/models/:version/rollback` | Quay lại model trước |

Các API này chỉ Admin được gọi. Backend Node.js đọc/ghi database; Python nhận dataset đã được Backend xuất và trả artifact/metrics.

### 21.3. Nhóm API Admin được bọc thành tool

| Nhóm chức năng | API hiện có tiêu biểu | Mức xác nhận |
|---|---|---|
| Dashboard | `GET /api/admin/dashboard/stats` | Không |
| User | `GET/PUT/DELETE /api/admin/users*` | Read: không; write: high/critical |
| Owner | `GET/PUT/DELETE /api/admin/owners*` | Write: high/critical |
| Location | `GET/PUT/DELETE /api/admin/locations*` | Write: high |
| Check-in/history | `/api/admin/checkins*`, history APIs | Write: high |
| Payment | `POST /api/admin/payments/:id/confirm` | Critical |
| Commission | `/api/admin/commissions*` | High/critical |
| Reports | `/api/admin/reports*` | High |
| Reviews | `/api/admin/reviews*` | High |
| Logs | `GET /api/admin/logs` | Không |
| Settings | `GET/PUT /api/admin/settings` | High |
| AI settings | `/api/admin/ai/settings`, logs/history | High cho write |
| SOS | `GET/PUT /api/admin/sos*` | High |
| Owner services | `/api/admin/owner-services*` | High |
| System vouchers | `/api/admin/system-vouchers*` | High |
| Owner vouchers | `/api/admin/owner-vouchers*` | High |
| Push notification | `/api/admin/push-notifications*` | High |

Admin “full chức năng” nghĩa là action catalog có thể bao phủ toàn bộ nhóm trên. Mỗi action vẫn phải viết handler/schema riêng; không có tool “gọi API tùy ý”.

---

## 22. File Backend/Frontend cần tạo hoặc sửa

### Backend

| File/module | Công việc |
|---|---|
| `backend/src/services/ai/geminiProvider.ts` | Dùng chung Gemini provider với AI User |
| `backend/src/services/ai/actionRegistry.ts` | Danh mục action |
| `backend/src/services/ai/policyEngine.ts` | Chặn role/route/action |
| `backend/src/services/ai/contextSanitizer.ts` | Lọc context màn hình |
| `backend/src/services/ai/actionExecutor.ts` | Preview, confirm, idempotency |
| `backend/src/controllers/ownerAiController.ts` | API Owner AI |
| `backend/src/controllers/adminAiController.ts` | API Admin AI |
| `backend/src/routes/ownerAiRoutes.ts` | Route Owner AI |
| `backend/src/routes/adminAiRoutes.ts` | Route Admin AI |
| `backend/src/schemas/aiActionSchemas.ts` | Zod schema cho action |
| Migration AI | Tables/action policies/prompt/training |

### Website

| File/module | Công việc |
|---|---|
| `website/src/api/ownerAiApi.ts` | Chat, history, confirm, feedback |
| `website/src/api/adminAiApi.ts` | Chat, actions, prompt versions |
| `OwnerAiAssistant` | Bubble/panel chỉ mount ở route được phép |
| `AdminAiAssistant` | Panel toàn Dashboard Admin |
| `AiActionPreview` | Hiển thị dữ liệu trước/sau |
| `AiConfirmationDialog` | Button/typed phrase/re-auth |
| Router guard | Ẩn AI Owner trong route cấm |

---

## 23. Thư viện cần cài

### 23.1. Backend Node.js

```bash
cd backend
npm install @google/genai
```

Đã có sẵn và tiếp tục dùng:

```text
zod
mysql2
express
dotenv
jsonwebtoken
uuid
```

Sau khi chuyển provider phải gỡ SDK cũ:

```bash
npm uninstall @google/generative-ai
```

### 23.2. Nhánh tự huấn luyện tùy chọn

Gemini vẫn là trợ lý chính. Model tự huấn luyện chỉ làm **guard classifier**:

- Nhận diện action Owner được phép.
- Nhận diện yêu cầu thuộc vận hành Owner và chặn.
- Nhận diện CRUD location/service Owner và chặn.
- Phân nhóm Admin read/write/critical.
- Không được thực thi action.
- Không kết nối database bằng tài khoản ghi.

#### Tạo service

```powershell
mkdir service
cd service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

#### Cài thư viện huấn luyện và API

```powershell
pip install fastapi "uvicorn[standard]" scikit-learn pandas numpy joblib pydantic pydantic-settings httpx python-dotenv pytest pytest-cov
```

Tùy chọn cho tách từ tiếng Việt:

```powershell
pip install underthesea
```

Không bắt buộc `underthesea` nếu dùng character n-gram TF-IDF.

#### Công dụng từng thư viện

| Thư viện | Công dụng |
|---|---|
| `fastapi` | API nội bộ `/predict`, `/train`, `/evaluate` |
| `uvicorn` | Chạy Python API service |
| `scikit-learn` | TF-IDF, LogisticRegression/LinearSVC, metrics |
| `pandas` | Đọc và kiểm tra dataset |
| `numpy` | Xử lý dữ liệu số |
| `joblib` | Lưu/load model artifact |
| `pydantic` | Validate request/response |
| `pydantic-settings` | Cấu hình environment |
| `httpx` | Python gọi Backend API nội bộ khi cần |
| `python-dotenv` | Đọc `.env` local |
| `pytest`, `pytest-cov` | Test và coverage |
| `underthesea` | Tách từ/chuẩn hóa tiếng Việt tùy chọn |

#### `requirements.txt` đề xuất

```text
fastapi
uvicorn[standard]
scikit-learn
pandas
numpy
joblib
pydantic
pydantic-settings
httpx
python-dotenv
pytest
pytest-cov
underthesea
```

Sau khi cài thành công mới khóa phiên bản:

```powershell
pip freeze > requirements-lock.txt
```

### 23.3. Cấu trúc Python service

```text
service/
  app/
    main.py
    schemas.py
    inference.py
    policy_labels.py
    training/
      train.py
      evaluate.py
      dataset.py
  models/
  datasets/
  tests/
  requirements.txt
  requirements-lock.txt
  .env.example
```

### 23.4. API Python nội bộ

```text
GET  /health
POST /predict
POST /evaluate
POST /train
GET  /models
POST /models/:version/activate
POST /models/:version/rollback
```

Node.js chỉ dùng kết quả classifier như một tín hiệu bổ sung. `Policy Engine` hard-code vẫn là lớp quyết định cuối cùng.

---

## 24. Quy trình huấn luyện tùy chọn

1. Xác định nhãn:
   - `owner_allowed_read`
   - `owner_allowed_draft`
   - `owner_blocked_operations`
   - `owner_blocked_location_service_crud`
   - `owner_blocked_security_finance`
   - `admin_read`
   - `admin_write`
   - `admin_critical`
   - `unknown`
2. Chuẩn bị tối thiểu 50-100 câu/nhãn.
3. Có câu có dấu, không dấu, viết tắt và sai chính tả.
4. Admin duyệt dữ liệu trong `ai_training_examples`.
5. Backend xuất dataset approved sang Python.
6. Train TF-IDF word + character n-gram.
7. So sánh LogisticRegression và LinearSVC.
8. Đánh giá macro F1, precision từng nhãn cấm.
9. Nhãn cấm Owner cần precision/recall rất cao.
10. Lưu artifact và metrics vào `ai_model_versions`.
11. Chỉ activate model candidate khi vượt quality gate.
12. Policy Engine vẫn chặn cứng dù model dự đoán sai.

---

## 25. Kết luận database và API

Database hiện tại **chưa đủ** cho kế hoạch Owner/Admin, nhưng đã có nền tốt:

- Giữ `ai_chat_history`, `audit_logs`, `system_settings`.
- Dùng chung `ai_conversations` và feedback với AI User.
- Bổ sung `ai_action_runs`, `ai_action_policies`, `ai_prompt_versions`.
- Chỉ thêm training/model tables nếu triển khai nhánh tự huấn luyện.

AI Owner là trợ lý quản trị ngoài vận hành; AI Admin là trợ lý toàn hệ thống. Gemini hiểu câu hỏi và context, model tự huấn luyện nếu có chỉ đóng vai trò guard phụ. Quyền thực thi cuối cùng luôn thuộc Backend Node.js.
