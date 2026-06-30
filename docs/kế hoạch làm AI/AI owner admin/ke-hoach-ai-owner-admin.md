# Kế hoạch chi tiết AI cho Owner và Admin

**Cập nhật:** 2026-06-27
**Phạm vi:** Website Dashboard Owner/Admin
**Định hướng:** Trợ lý quản trị tự xây bằng `ai-manager-bot` làm AI service chính; Backend Node.js kiểm soát quyền, lấy dữ liệu thật và thực thi action
**Mức độ tổng thể:** Rất cao
**Điều kiện tiên quyết:** Khóa tuyệt đối AI Owner khỏi cụm vận hành và hoàn thiện permission, confirmation, audit
**Yêu cầu bắt buộc (Strict Requirement):** Bất cứ ai tham gia phát triển và tích hợp AI cho cụm Owner/Admin phải tuân thủ CHÍNH XÁC và NGHIÊM NGẶT 100% theo các quy tắc, phạm vi, và giới hạn đã được vạch ra trong bản kế hoạch này. Tuyệt đối không được vượt quyền hoặc tự ý nới lỏng các ràng buộc bảo mật.

---

## 0. Đính chính định hướng

Kế hoạch này được chỉnh lại theo định hướng mới:

- **Không lấy Gemini làm lõi bắt buộc** cho AI Owner/Admin.
- **`ai-manager-bot` là AI service chính** để hiểu câu hỏi, phân loại ý định, trích xuất entity, tạo câu trả lời và đề xuất `ActionPlan`.
- **Backend Node.js là lớp quyết định cuối cùng**: xác thực, RBAC, policy, lấy dữ liệu MySQL, resolve entity, preview, confirmation, execute action và audit.
- **Website chỉ là giao diện chat/action preview**, không được tự quyết định quyền hoặc tự gọi action nguy hiểm.
- Gemini nếu dùng lại trong tương lai chỉ là **adapter tùy chọn/fallback**, không phải điều kiện để hoàn thành kế hoạch Owner/Admin.

### Vai trò của từng phần

| Thành phần | Vai trò |
|---|---|
| `ai-manager-bot` | AI engine chính: NLU, intent, entity, response, action planning |
| Backend Node.js | Gateway an toàn: auth, permission, context sanitizer, data resolver, action executor |
| MySQL | Nguồn dữ liệu thật, chỉ Backend Node.js truy cập trực tiếp |
| Website Owner/Admin | Chat UI, gửi context đã lọc, hiển thị preview/xác nhận |
| Gemini | Tùy chọn sau này, không phụ thuộc trong bản chính |

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

`ai-manager-bot` không kết nối MySQL bằng tài khoản ghi, không biết database credential sản xuất và không chạy SQL theo nội dung hội thoại. Mọi dữ liệu thật phải đi qua Backend Node.js bằng API/service đã kiểm quyền.

### Độ khó

| Cụm | Độ khó | Nhận xét |
|---|---:|---|
| Read-only command | Trung bình | Ít rủi ro, nên làm đầu tiên |
| Hiểu ngữ cảnh màn hình | Trung bình - Cao | Frontend phải truyền context có kiểm soát |
| Entity extraction | Cao | Tên location, voucher, review và thời gian dễ mơ hồ |
| Write action Owner ngoài vận hành | Cao | Cần allowlist, preview và xác nhận |
| Write action Admin | Rất cao | Phạm vi ảnh hưởng lớn |
| Theo dõi chất lượng intent/action/model | Cao | Cần log, evaluation và rollback model/prompt |
| Tạo câu trả lời review | Cao | `ai-manager-bot` tạo bản nháp, Owner duyệt |

**Ước lượng:** 20-35 ngày công cho phiên bản có kiểm soát; 35-50 ngày công nếu Admin có đầy đủ action ghi dữ liệu.

---

## 2. Phạm vi đúng của hệ thống

### Có trong phạm vi

- Hiểu câu hỏi và câu lệnh tiếng Việt bằng `ai-manager-bot`.
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

### 3.1. `ai-manager-bot` hiểu ngôn ngữ và context

Ví dụ:

```text
"Tóm tắt các đánh giá xấu của địa điểm đang chọn"
=> intent: owner_review_summary
=> current_page: owner_reviews
=> selected_location_id: 5
```

`ai-manager-bot` là bộ phận hiểu ngôn ngữ chính. Phiên bản đầu có thể bắt đầu bằng classifier + rule/entity extractor, sau đó nâng cấp dần thành planner có khả năng tạo `ActionPlan` ổn định.

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

`ai-manager-bot` có thể:

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
       +--> ai-manager-bot (Python/FastAPI)
              |-- hiểu câu hỏi
              |-- phân loại intent/risk
              |-- trích xuất entity
              |-- tạo nội dung/tóm tắt
              |-- đề xuất ActionPlan
```

### Runtime flow

1. Owner nhập: “Tóm tắt review xấu của địa điểm này”.
2. Website gửi text và context của trang review.
3. Node.js kiểm tra route hiện tại có cho AI Owner hoạt động hay không.
4. Node.js gửi sang `ai-manager-bot` text, role, route và context đã lọc.
5. `ai-manager-bot` trả intent/entity/answer hoặc `ActionPlan` đề xuất.
6. Backend kiểm tra lại action theo registry/policy và resolve dữ liệu thật.
7. UI hiển thị:
   - Tóm tắt review.
   - Review liên quan.
   - Đề xuất phản hồi.
8. Owner có thể sửa bản nháp.
9. Nếu Owner chọn đăng phản hồi, Backend yêu cầu xác nhận rồi gọi handler.
10. Ghi `ai_action_runs` và `audit_logs`.
11. Trả kết quả.

---

## 5. Chuẩn ActionPlan

```ts
type ActionPlan = {
  command_id: string;           // UUID v4, do Backend sinh, không tin từ client
  actor: {
    user_id: number;            // Luôn lấy từ JWT, không tin payload
    role: "owner" | "admin";
  };
  intent: string;
  confidence: number;           // 0.0 - 1.0, do ai-manager-bot trả
  risk_level: "read" | "low" | "medium" | "high" | "critical";
  entities: Record<string, unknown>;          // Entity thô từ ai-manager-bot
  resolved_entities: Record<string, unknown>; // Entity đã resolve từ DB (Backend làm)
  summary: string;              // Mô tả ngắn để hiển thị preview cho user
  warnings: string[];           // Cảnh báo để Backend/UI hiển thị trước khi xác nhận
  requires_confirmation: boolean;
  schema: unknown;
  preview: (context: ActionContext) => Promise<ActionPreview>;
  execute?: (context: ActionContext) => Promise<ActionResult>;
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

AI có thể nói "Chức năng này cần Owner tự thao tác" và đưa hướng dẫn chung, nhưng không được mở route bị chặn hoặc gửi dữ liệu màn hình đó tới `ai-manager-bot`.
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

## 9. `ai-manager-bot` và context màn hình

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

### `ai-manager-bot` chỉ được đề xuất tool có sẵn

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
- Lưu action `ai-manager-bot` đã đề xuất và kết quả Backend.
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
- API nghiệp vụ hiện có được gọi qua service/handler Backend, không đưa URL tùy ý cho `ai-manager-bot`.
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

- Kết nối `ai-manager-bot`.
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
- `ai-manager-bot` health dashboard.

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
| `ai-manager-bot` hiểu sai | Tool allowlist + preview + confirmation |
| Entity mơ hồ | DB resolver và luồng hỏi lại khi entity chưa đủ rõ |
| Action chạy lặp | Idempotency key ở Backend kết hợp unique constraint trong DB |
| Owner vượt quyền | Scope lấy từ token, không tin entity actor |
| AI Owner vào vận hành | Chặn UI, route policy và action policy |
| Prompt/model mới kém hơn | Version, evaluation và rollback |
| `ai-manager-bot` timeout/lỗi | Timeout 8s + circuit breaker + graceful degrade |
| `ai-manager-bot` lỗi liên tục | Circuit breaker mở sau 5 lần fail/phút, fallback sang rule-only mode |
| Rollback nguy hiểm | Chỉ hỗ trợ rollback riêng từng action |
| Prompt injection qua context | Whitelist field + giới hạn kích thước payload |
| ActionPlan không hết hạn | TTL bắt buộc do Backend set (xem Mục 5) |
| Re-auth không rõ flow | Chuẩn hóa typed confirmation, re-auth và audit cho action critical |
| Ghi kép audit/action_run | Transaction + idempotency key + unique constraint |

---

## 17. Thứ tự triển khai đề xuất

1. Hoàn thành `ai-manager-bot` foundation cho Owner/Admin: model baseline, API chat/predict, logging và feature flag.
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
| Hiểu ngôn ngữ | `ai-manager-bot` tự xử lý NLU/intent/entity/action planning |
| Context màn hình | JSON allowlist từ Website |
| Entity MVP | Rule parser + DB resolver |
| Database | MySQL hiện tại |
| Action execution | Action Registry gọi business service hiện có |
| Audit | `ai_action_runs` + `audit_logs` |
| Quản lý chất lượng | Prompt version, evaluation và rollback |
| Owner operations | Cấm tuyệt đối ở UI và Backend |
| Admin | Full action catalog, xác nhận theo risk level |
| Python | Nền tảng chính của `ai-manager-bot` |

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
- Vì chọn hướng tự làm AI, bắt buộc có training examples, model versions và quality gates.

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
  KEY idx_ai_action_expires (expires_at, status),  -- Dùng cho cleanup job
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

#### Cleanup job idempotency (lỗi tiềm ẩn #1)

Bảng `ai_action_runs` sẽ phình to nếu không có cleanup. Cần cron job chạy mỗi ngày:

```sql
-- Chạy hàng đêm lúc 2:00 AM
-- Xóa các bản ghi đã kết thúc và hết hạn trên 30 ngày
DELETE FROM ai_action_runs
WHERE status IN ('succeeded','failed','expired','cancelled','blocked')
  AND created_at < NOW() - INTERVAL 30 DAY;

-- Đánh dấu expired các ActionPlan quá hạn nhưng chưa được xác nhận
UPDATE ai_action_runs
SET status = 'expired'
WHERE status = 'awaiting_confirmation'
  AND expires_at < NOW();
```

Thực thi qua cron backend (file `backend/src/cron/`) hoặc MySQL Event Scheduler. Ghi log khi xóa.

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

### 19.7. Bảng cho model tự huấn luyện bắt buộc

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
  ('ai_manager_bot_enabled', '1', 'text');
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
| `POST /api/admin/ai/training/run` | Yêu cầu `ai-manager-bot` train candidate |
| `GET /api/admin/ai/models` | Danh sách model version |
| `GET /api/admin/ai/models/:version/evaluation` | Metrics/confusion matrix |
| `POST /api/admin/ai/models/:version/activate` | Kích hoạt model chính của `ai-manager-bot` |
| `POST /api/admin/ai/models/:version/rollback` | Quay lại model trước |

Các API này chỉ Admin được gọi. Backend Node.js đọc/ghi database; `ai-manager-bot` nhận dataset đã được Backend xuất và trả artifact/metrics.

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
| `backend/src/services/ai/managerBotClient.ts` | Client nội bộ gọi `ai-manager-bot` |
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

Backend không cần cài SDK Gemini cho hướng chính. Backend cần HTTP client/service nội bộ để gọi `ai-manager-bot`, cộng với các thư viện validate/permission đã có.

```bash
cd backend
npm install zod uuid
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

Nếu trước đó đã cài SDK Gemini chỉ để thử nghiệm Owner/Admin thì có thể gỡ khỏi nhánh chính:

```bash
npm uninstall @google/generative-ai
npm uninstall @google/genai
```

### 23.2. `ai-manager-bot` là AI service chính

`ai-manager-bot` là trợ lý chính cho Owner/Admin. Phiên bản đầu cần đi theo hướng thực dụng: classifier + rule-based entity extractor + action planner có cấu trúc. Sau đó mới nâng cấp model nếu cần.

- Nhận diện action Owner/Admin.
- Nhận diện yêu cầu thuộc vận hành Owner và chặn.
- Nhận diện CRUD location/service Owner và chặn.
- Phân nhóm Admin read/write/critical.
- Trích xuất entity cơ bản: location, service, voucher, review, user, khoảng thời gian.
- Tạo câu trả lời/tóm tắt từ dữ liệu đã được Backend cung cấp.
- Đề xuất `ActionPlan` có schema ổn định.
- Không được tự thực thi action.
- Không kết nối database bằng tài khoản ghi.

#### Tạo service

```powershell
cd ai-manager-bot
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
- Training/model tables là bắt buộc vì Owner/Admin chọn hướng tự làm AI bằng `ai-manager-bot`.

AI Owner là trợ lý quản trị ngoài vận hành; AI Admin là trợ lý toàn hệ thống. `ai-manager-bot` hiểu câu hỏi, context, entity và đề xuất action. Quyền thực thi cuối cùng luôn thuộc Backend Node.js.

---

## 26. Đánh giá hiện trạng `ai-manager-bot`

> Ghi chú cập nhật: tại thời điểm kiểm tra workspace hiện tại, folder `ai-manager-bot/` không còn tồn tại trong thư mục dự án. Các mô tả bên dưới là thiết kế/hiện trạng mục tiêu cần khôi phục hoặc scaffold lại, không được hiểu là source hiện đang đầy đủ trong repo.

### 26.1. Khung mục tiêu cần scaffold lại

Khi khôi phục hoặc scaffold lại `ai-manager-bot`, cấu trúc tối thiểu nên hướng tới:

```text
ai-manager-bot/
  app/
    main.py
    inference.py
    schemas.py
    policy_labels.py
    training/
      train.py
      augment.py
  datasets/
  tests/
  requirements.txt
```

Các phần mục tiêu nên có:

- FastAPI service với `/health`, `/predict`, `/predict/batch`, `/train`, `/evaluate`, `/labels`, `/reload`.
- Bộ label policy cho Owner/Admin:
  - `owner_allowed_read`
  - `owner_allowed_draft`
  - `owner_blocked_operations`
  - `owner_blocked_location_service_crud`
  - `owner_blocked_security_finance`
  - `admin_read`
  - `admin_write`
  - `admin_critical`
  - `unknown`
- Dataset seed theo từng label.
- Pipeline train bằng TF-IDF word + character n-gram + LinearSVC calibrated.
- Test inference cơ bản.

### 26.2. Chưa đủ để làm AI chính

Hiện tại `ai-manager-bot` mới đạt mức **khung intent classifier**, chưa đủ làm trợ lý Owner/Admin hoàn chỉnh.

Thiếu bắt buộc:

| Hạng mục | Trạng thái | Cần làm |
|---|---|---|
| Model artifact | Chưa có `models/latest.joblib` | Train model đầu tiên và lưu metadata |
| Encoding dataset | Cần kiểm tra kỹ | Bảo đảm dataset là UTF-8 tiếng Việt thật, không bị mojibake |
| API chat | Chưa có | Thêm `/chat` nhận text/context và trả answer/action |
| Entity extraction | Chưa có | Trích xuất location, service, voucher, review, user, thời gian |
| Action planning | Chưa có | Tạo `ActionPlan` có schema ổn định |
| Backend integration | Chưa có | Node.js gọi nội bộ `ai-manager-bot` qua client riêng |
| Data grounding | Chưa có | Backend cung cấp dữ liệu thật đã lọc cho bot |
| Policy hard-deny | Mới có label | Backend vẫn phải chặn cứng route/action bị cấm |
| Conversation memory | Chưa có | Lưu qua bảng AI chung trong MySQL |
| Feedback/evaluation | Mới có test cơ bản | Thêm bộ benchmark theo role/action |
| Deployment | Chưa có | Cần `.env`, script start, healthcheck, logging |

### 26.3. Kết quả kiểm tra nhanh

- `python -m compileall app`: qua.
- `python -m pytest -q`: đang fail vì chưa có `models/latest.joblib`.
- Dataset có số lượng mẫu khá ổn cho bản đầu, nhưng cần kiểm tra encoding trước khi train.

### 26.4. Roadmap triển khai `ai-manager-bot`

#### Giai đoạn A - Làm chạy được

1. Sửa/kiểm tra encoding dataset.
2. Train model đầu tiên từ `datasets`.
3. Tạo `models/latest.joblib` và `latest_metadata.json`.
4. Sửa test để có mode fallback rõ ràng khi thiếu model.
5. Chạy `/health`, `/predict`, `/evaluate` ổn định.

#### Giai đoạn B - Biến classifier thành AI service

1. Thêm `POST /chat`.
2. Thêm schema:
   - `ChatRequest`
   - `ScreenContext`
   - `BotAnswer`
   - `ActionPlan`
   - `EntityExtractionResult`
3. Thêm entity extractor rule-based cho bản đầu.
4. Thêm response composer để trả lời dựa trên dữ liệu Backend gửi vào.
5. Thêm action planner cho các action read/draft trước.

#### Giai đoạn C - Nối Backend Node.js

1. Tạo `backend/src/services/ai/managerBotClient.ts`.
2. Tạo `contextSanitizer.ts`.
3. Tạo `policyEngine.ts`.
4. Tạo `actionRegistry.ts`.
5. Tạo controller:
   - `ownerAiController.ts`
   - `adminAiController.ts`
6. Backend lấy dữ liệu thật từ service hiện có, sau đó gửi context đã lọc sang `ai-manager-bot`.

#### Giai đoạn D - Owner AI

1. Owner read-only:
   - dashboard summary
   - location summary
   - service summary
   - voucher summary
   - review summary
   - commission explanation
   - logs explanation
2. Owner draft:
   - soạn reply review
   - soạn nội dung voucher
   - soạn thông báo
3. Owner write có xác nhận:
   - đăng reply review
   - lưu voucher draft nếu được cho phép
4. Owner hard-deny:
   - front-office
   - booking
   - payment vận hành
   - POS/phòng/bàn/vé
   - CRUD location/service
   - bank/security/employee

#### Giai đoạn E - Admin AI

1. Admin read toàn hệ thống.
2. Admin write có preview + typed confirmation.
3. Admin critical cần re-auth/OTP hoặc typed phrase.
4. Admin quản lý model:
   - dataset examples
   - train run
   - model versions
   - activate/rollback
   - evaluation dashboard

### 26.5. Kết luận hiện tại

`ai-manager-bot` **ổn để làm nền**, nhưng chưa ổn để xem là AI Owner/Admin hoàn chỉnh. Hướng đúng là tiếp tục phát triển folder này thành service AI chính, còn Backend Node.js giữ quyền quyết định cuối cùng.

---

## 27. Mục riêng: `ai-manager-bot` tự huấn luyện nội bộ

### 27.0. Định nghĩa đúng: AI trợ lý quản trị theo phân quyền

Mục tiêu của `ai-manager-bot` không phải là chatbot nói chuyện chung chung, mà là **trợ lý quản trị thông minh** cho Owner/Admin.

Nguyên tắc sản phẩm đã chốt:

```text
Website có chức năng gì thì AI có thể hỗ trợ chức năng đó theo đúng phân quyền.
Trước khi AI thực hiện thao tác làm thay người dùng, AI phải hỏi lại và chờ user xác nhận OK.
```

Điều này không có nghĩa AI được tự làm mọi thứ ngay lập tức. AI chỉ được thực hiện action khi:

1. Action tồn tại thật trên website/backend.
2. Role hiện tại có quyền làm action đó.
3. Action có trong Action Registry.
4. Backend đã kiểm tra policy.
5. AI đã hiển thị preview hoặc mô tả rõ sẽ làm gì.
6. User xác nhận OK.
7. Backend ghi audit log.

AI cần làm được 3 nhóm việc chính:

#### 1. Phân tích hệ thống và dữ liệu kinh doanh

AI có thể:

- Giải thích chức năng hiện có của dự án theo role.
- Trả lời câu hỏi kiểu:
  - "Trang này dùng để làm gì?"
  - "Owner có những chức năng nào?"
  - "Admin khác Owner ở đâu?"
  - "Luồng đặt bàn hoạt động ra sao?"
- Phân tích doanh thu:
  - doanh thu hôm nay/tuần/tháng.
  - xu hướng tăng/giảm.
  - so sánh theo kỳ trước.
  - địa điểm/dịch vụ/voucher nổi bật.
  - cảnh báo bất thường.
- Phân tích vận hành ở mức tổng hợp được phép:
  - số booking theo trạng thái.
  - số đánh giá xấu/tốt.
  - tỷ lệ hủy.
  - dịch vụ hết hàng/chờ duyệt.
  - owner/location có dấu hiệu rủi ro.

AI chỉ phân tích từ dữ liệu Backend đã lọc quyền. `ai-manager-bot` không tự đọc database trực tiếp.

#### 2. Thực hiện chức năng trên website đúng phân quyền

AI được hỗ trợ thao tác nếu action đó:

- Thuộc role hiện tại.
- Có trong Action Registry.
- Được Backend kiểm quyền lại.
- Có preview trước khi ghi dữ liệu.
- Có xác nhận nếu là write action.
- Nếu thuộc nhóm bắt buộc làm tay, AI chỉ được mở trang/hướng dẫn/checklist, không tự điền hoặc tự xác nhận thay user.

Ví dụ Owner được phép:

- Mở đúng trang báo cáo, voucher, review, commission.
- Tóm tắt dữ liệu địa điểm/dịch vụ/voucher.
- Soạn bản nháp trả lời review.
- Soạn bản nháp nội dung voucher.
- Đăng phản hồi review sau khi Owner xác nhận.
- Tạo/sửa voucher nếu policy cho phép và đã xác nhận.

Ví dụ Admin được phép:

- Phân tích toàn hệ thống.
- Mở đúng trang quản lý user/owner/location/report.
- Soạn quyết định/ghi chú xử lý.
- Duyệt/từ chối/khóa/ẩn theo action catalog sau preview và xác nhận.
- Quản lý dataset/model của `ai-manager-bot`.

#### 3. Thông minh nhưng không vượt ranh giới

AI cần thông minh ở mức:

- Hiểu câu hỏi tự nhiên, viết tắt, sai chính tả.
- Hiểu context màn hình hiện tại.
- Biết user đang hỏi dữ liệu, muốn điều hướng hay muốn thực hiện action.
- Biết hỏi lại khi entity mơ hồ.
- Biết đề xuất bước tiếp theo.
- Biết từ chối khi user yêu cầu vượt quyền.
- Biết giải thích vì sao bị từ chối.

AI không được "thông minh" theo kiểu tự đoán và tự làm bừa. Mọi action đều phải đi qua Backend.

### 27.0.1. Các chức năng bắt buộc làm tay

Những thao tác dưới đây **AI không được tự quyết định hoặc tự xác nhận thay user**. AI vẫn có thể hỗ trợ theo kiểu mở trang, giải thích, tạo checklist, kiểm tra dữ liệu sau khi user nhập, hoặc chuẩn bị bản nháp nếu phù hợp.

| Nhóm | Lý do |
|---|---|
| Chọn vị trí trên bản đồ khi đăng ký địa điểm | Cần người xác nhận tọa độ thực tế |
| Tạo địa điểm mới | Dữ liệu pháp lý/địa chỉ/hình ảnh cần người nhập và chịu trách nhiệm |
| Sửa tọa độ địa điểm | Rủi ro sai check-in/chỉ đường |
| Tạo/sửa/xóa dịch vụ của Owner | Owner phải tự quyết định hàng hóa/phòng/vé/bàn |
| Cấu hình sơ đồ bàn/phòng/khu vận hành | Dễ ảnh hưởng vận hành thực tế |
| Thanh toán tiền/chuyển khoản/xác nhận tiền | Rủi ro tài chính |
| Đổi tài khoản ngân hàng | Rủi ro bảo mật/tài chính |
| Đổi mật khẩu/OTP/phân quyền nhạy cảm | Rủi ro bảo mật |
| Front-office/POS/check-in/check-out | Là nghiệp vụ vận hành trực tiếp |

Với các thao tác này, AI chỉ được:

- Giải thích cách làm.
- Mở đúng trang nếu route được phép.
- Nhắc user tự thao tác.
- Kiểm tra checklist sau khi user đã nhập.

Nếu sau này muốn AI hỗ trợ sâu hơn nhóm này, phải nâng policy lên `critical_manual_assist`:

- Không auto-submit.
- Không auto-confirm.
- User phải tự bấm nút cuối cùng trên form thật.
- Audit log lưu rõ AI chỉ hỗ trợ hướng dẫn.

### 27.0.2. Quy tắc xác nhận trước khi làm

Mọi action AI thực hiện phải đi theo trạng thái:

```text
parse_request
resolve_entities
preview_action
ask_confirmation
execute_after_ok
audit_result
```

Các câu xác nhận hợp lệ:

```text
ok
oke
đồng ý
xác nhận
làm đi
thực hiện đi
duyệt
đúng rồi
```

AI không được xem các câu mơ hồ sau là xác nhận:

```text
ừm
chắc vậy
để xem
có lẽ
thử coi
```

Mẫu phản hồi trước khi làm:

```text
Mình chuẩn bị thực hiện: Ẩn voucher "Giảm 10%".
Ảnh hưởng: voucher sẽ không còn hiển thị cho user mới.
Bạn xác nhận OK để mình làm không?
```

Với action rủi ro cao:

```text
Đây là thao tác rủi ro cao. Vui lòng nhập đúng câu: XÁC NHẬN THỰC HIỆN
```

### 27.0.3. Ma trận quyền làm thay theo loại action

| Loại action | AI được làm? | Điều kiện |
|---|---|---|
| Đọc/phân tích dữ liệu | Có | Đúng role và dữ liệu đã lọc quyền |
| Điều hướng mở trang | Có | Route được phép |
| Soạn bản nháp | Có | User kiểm tra trước khi lưu/đăng |
| Ghi dữ liệu rủi ro thấp | Có | Preview + user OK |
| Ghi dữ liệu rủi ro trung bình | Có | Preview chi tiết + user OK |
| Ghi dữ liệu rủi ro cao | Có giới hạn | Typed confirmation |
| Critical tài chính/bảo mật | Có giới hạn rất chặt | Re-auth/typed phrase/audit |
| Bắt buộc làm tay | Không auto-submit | AI chỉ hướng dẫn/mở trang/checklist |

### 27.0.4. Ví dụ hội thoại mục tiêu

```text
Owner: Tháng này doanh thu sao rồi?
AI: Doanh thu tháng này đạt 18.500.000đ, giảm 12% so với tháng trước. Nguyên nhân chính là đơn đặt bàn giảm ở cuối tuần và voucher A ít được dùng hơn.
Hành động gợi ý: [Xem báo cáo] [Xem voucher] [Tóm tắt review xấu]
```

```text
Owner: Trả lời giúp đánh giá xấu mới nhất.
AI: Mình soạn bản nháp phản hồi cho đánh giá 1 sao mới nhất. Bạn xem lại trước khi đăng nhé.
ActionPlan: owner_review_reply_draft
```

```text
Owner: Tạo dịch vụ cafe sữa 20k cho quán.
AI: Mình không thể tạo dịch vụ thay Owner. Đây là thao tác cần Owner tự nhập để đảm bảo giá, ảnh, đơn vị và trạng thái chính xác. Mình có thể mở trang Dịch vụ và nhắc checklist cần điền.
```

```text
Admin: Owner nào có doanh thu giảm mạnh tuần này?
AI: Có 3 owner giảm trên 30% so với tuần trước. Mình xếp theo mức giảm và số đơn bị hủy để bạn kiểm tra.
```

```text
Admin: Khóa user này.
AI: Đây là action critical. Mình sẽ hiển thị preview tài khoản, lý do khóa và yêu cầu xác nhận bảo mật trước khi thực hiện.
```

### 27.1. Kết luận khả thi

Mục tiêu **không phụ thuộc Gemini/OpenAI/API ngoài** là khả thi nếu định nghĩa đúng:

- Khả thi cao: tự huấn luyện AI nội bộ để phân loại intent, nhận diện phạm vi bị cấm, trích entity, tạo `ActionPlan`, chọn handler và trả lời theo template/dữ liệu Backend cung cấp.
- Khả thi trung bình: tự tạo câu trả lời tiếng Việt tự nhiên bằng template thông minh, câu mẫu, dữ liệu thống kê và các đoạn giải thích đã kiểm soát.
- Khó và không nên hứa ở MVP: tự huấn luyện một LLM hội thoại tổng quát ngang Gemini/ChatGPT từ đầu. Việc này cần dataset rất lớn, GPU mạnh, hạ tầng MLOps và thời gian dài.

Vì vậy hướng đúng cho Owner/Admin là:

```text
ai-manager-bot = AI tự huấn luyện nội bộ cho nghiệp vụ quản trị
không phải chatbot tổng quát tự do
```

Bot cần giỏi nhất ở:

- Hiểu câu lệnh quản trị.
- Biết Owner/Admin được làm gì.
- Chặn đúng phạm vi cấm.
- Tạo kế hoạch hành động có cấu trúc.
- Giải thích dữ liệu thật do Backend đưa vào.
- Soạn bản nháp an toàn.

### 27.2. Phạm vi `ai-manager-bot` tự làm

`ai-manager-bot` là một Python/FastAPI service riêng trong repo:

```text
ai-manager-bot/
  app/
    main.py
    schemas.py
    inference.py
    text_normalizer.py
    intent_classifier.py
    entity_extractor.py
    response_composer.py
    action_planner.py
    policy_labels.py
    training/
      dataset.py
      train.py
      evaluate.py
      augment.py
  datasets/
    owner_admin_seed.csv
    owner_admin_eval.csv
  models/
    latest.joblib
    latest_metadata.json
  tests/
  requirements.txt
  .env.example
```

### 27.3. Không dựa vào gì bên ngoài nghĩa là gì

Trong bản chính:

- Không gọi Gemini.
- Không gọi OpenAI.
- Không gọi model cloud.
- Không gửi dữ liệu quản trị ra ngoài.
- Không cần Internet khi runtime đang chạy.

Nhưng vẫn được dùng thư viện open-source để train local:

- `scikit-learn`
- `pandas`
- `numpy`
- `joblib`
- `fastapi`
- `uvicorn`
- `pydantic`
- `pytest`

Đây không phải phụ thuộc AI ngoài; đây là tool local để xây model nội bộ.

### 27.4. Model nội bộ nên dùng theo giai đoạn

#### Giai đoạn 1: Rule + ML classifier

Mục tiêu:

- Chạy nhẹ.
- Dễ kiểm soát.
- Dễ test.
- Không cần GPU.

Model:

```text
TF-IDF word n-gram + char n-gram
LinearSVC hoặc LogisticRegression
CalibratedClassifierCV để có confidence
```

Dùng cho:

- Intent classification.
- Policy classification.
- Phân biệt Owner allowed/blocked.
- Phân biệt Admin read/write/critical.

#### Giai đoạn 2: Entity extractor rule-based

Trích:

- location name/id.
- service name/id.
- voucher name/id.
- review id.
- user id/email/phone nếu Admin hỏi.
- khoảng thời gian: hôm nay, tuần này, tháng này, 7 ngày qua.
- trạng thái: chờ duyệt, đã duyệt, bị hủy, đang mở.

MVP không cần NER deep learning. Rule + resolver Backend đủ an toàn hơn.

#### Giai đoạn 3: Response composer

Không dùng LLM cloud để viết câu. Tự dựng câu bằng:

- Template tiếng Việt.
- Slot filling.
- Dữ liệu thật Backend gửi.
- Tone config: ngắn gọn, lịch sự, quản trị.

Ví dụ:

```text
Theo dữ liệu hiện tại, địa điểm {location_name} có {bad_review_count} đánh giá xấu trong {range}.
Các vấn đề lặp lại nhiều nhất là {top_issues}.
Mình đề xuất Owner phản hồi theo hướng xin lỗi, xác nhận vấn đề và mời khách liên hệ lại.
```

#### Giai đoạn 4: Action planner

Bot trả `ActionPlan` có schema, không tự chạy API:

```json
{
  "intent": "owner_review_summary",
  "confidence": 0.91,
  "risk_level": "read",
  "entities": {
    "location_hint": "Cafe Trung Nguyên",
    "time_range": "last_30_days"
  },
  "requires_confirmation": false,
  "answer_plan": "summarize_bad_reviews"
}
```

Backend mới là bên:

- Resolve entity.
- Lấy dữ liệu thật.
- Kiểm quyền.
- Execute action.

### 27.5. Dataset cần chuẩn bị

Tối thiểu cần các nhóm nhãn:

```text
owner_allowed_read
owner_allowed_draft
owner_allowed_write_safe
owner_blocked_operations
owner_blocked_location_service_crud
owner_blocked_security_finance
admin_read
admin_write
admin_critical
small_talk_admin_owner
unknown
```

Số lượng tối thiểu:

| Nhãn | Mẫu tối thiểu MVP | Mẫu tốt hơn |
|---|---:|---:|
| Mỗi nhãn thường | 80-120 câu | 300-500 câu |
| Nhãn bị cấm Owner | 150-250 câu | 500+ câu |
| Admin critical | 150-250 câu | 500+ câu |
| Unknown/out of scope | 100-200 câu | 500+ câu |

Dataset phải có:

- Có dấu.
- Không dấu.
- Sai chính tả.
- Viết tắt.
- Cách nói miền Nam.
- Câu ra lệnh ngắn.
- Câu hỏi dài.
- Câu mơ hồ.
- Câu cố tình vượt quyền.

Ví dụ:

```text
tóm tắt review xấu của quán này
soạn phản hồi cho đánh giá 1 sao
ẩn địa điểm này giúp tôi
tạo dịch vụ mới cho quán
vào front office xác nhận đơn bàn số 3
xem doanh thu tháng này
khóa tài khoản user này
duyệt dịch vụ đang chờ
```

### 27.6. Quality gate bắt buộc

Không activate model nếu chưa đạt:

| Metric | Ngưỡng MVP |
|---|---:|
| Macro F1 toàn bộ | >= 0.85 |
| Recall nhãn Owner bị cấm | >= 0.97 |
| Precision nhãn Owner bị cấm | >= 0.95 |
| Recall Admin critical | >= 0.95 |
| Unknown detection | >= 0.80 |

Nguyên tắc:

- Nếu confidence thấp hơn ngưỡng, bot phải hỏi lại hoặc trả `unknown`.
- Nếu model đoán allowed nhưng rule/policy Backend thấy route/action bị cấm, Backend vẫn chặn.
- Model không bao giờ là lớp bảo mật cuối cùng.

### 27.7. API nội bộ của `ai-manager-bot`

```text
GET  /health
POST /predict
POST /chat
POST /extract-entities
POST /plan-action
POST /evaluate
POST /train
GET  /models
POST /models/:version/activate
POST /models/:version/rollback
```

`/chat` không được tự đọc database. Request phải là context đã lọc:

```json
{
  "role": "owner",
  "route": "/owner/reviews",
  "text": "tóm tắt review xấu của địa điểm này",
  "screen_context": {
    "page_key": "owner_reviews",
    "selected_location_id": 1,
    "filters": {
      "rating": 1
    }
  },
  "available_actions": [
    "owner_review_summary",
    "owner_review_reply_draft"
  ]
}
```

Response:

```json
{
  "intent": "owner_review_summary",
  "confidence": 0.93,
  "risk_level": "read",
  "entities": {
    "selected_location_id": 1,
    "rating": 1
  },
  "answer": "Mình sẽ tóm tắt các đánh giá xấu của địa điểm đang chọn.",
  "action_plan": {
    "action_key": "owner_review_summary",
    "requires_confirmation": false
  },
  "warnings": []
}
```

### 27.8. Backend vẫn bắt buộc có Policy Engine

Dù `ai-manager-bot` tự huấn luyện tốt, Backend Node.js vẫn phải chặn cứng:

- Owner route vận hành.
- Owner booking/payment/front-office/POS.
- Owner CRUD location/service.
- Owner bank/security/employee.
- SQL tự do.
- API path tùy ý.
- Action không có trong registry.

Không được để Python bot quyết định quyền cuối cùng.

### 27.9. Cần chỉnh so với kế hoạch cũ

Nên chỉnh 3 điểm:

1. Đổi cách gọi từ “AI tự làm không dựa vào gì cả” thành:

```text
AI tự huấn luyện nội bộ, không phụ thuộc model/API cloud, nhưng vẫn dùng thư viện open-source local và dữ liệu do hệ thống cung cấp.
```

2. Tách rõ `ai-manager-bot` không phải LLM tổng quát:

```text
MVP là classifier + entity extractor + template response + action planner.
LLM local nếu có chỉ là phase nâng cao.
```

3. Xóa mọi giả định rằng `ai-manager-bot` đang có source đầy đủ nếu folder chưa tồn tại. Cần scaffold lại folder trước khi triển khai.

### 27.10. Roadmap riêng cho `ai-manager-bot`

#### AMB-0: Scaffold lại service

- Tạo folder.
- Tạo FastAPI app.
- Tạo schemas.
- Tạo dataset seed.
- Tạo test cơ bản.

#### AMB-1: Train classifier đầu tiên

- Chuẩn hóa text.
- TF-IDF word + char n-gram.
- Train LinearSVC/LogisticRegression.
- Lưu `models/latest.joblib`.
- Lưu metrics.

#### AMB-2: Chat/action planner

- `/chat`
- `/plan-action`
- Entity extractor.
- Response composer.
- ActionPlan schema.

#### AMB-3: Nối Backend Node.js

- `managerBotClient.ts`
- `policyEngine.ts`
- `contextSanitizer.ts`
- `actionRegistry.ts`
- Owner/Admin AI controllers.

#### AMB-4: Dashboard huấn luyện cho Admin

- Thêm/sửa/xóa training examples.
- Import/export dataset.
- Train candidate.
- Xem confusion matrix.
- Activate/rollback model.

#### AMB-5: Nâng cấp local LLM tùy chọn

Chỉ làm nếu có máy đủ mạnh và dataset đủ tốt. Local LLM chỉ được dùng để soạn câu/draft, không quyết định quyền.
