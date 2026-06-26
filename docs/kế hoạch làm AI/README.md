# Tiêu chuẩn và Kiến trúc Tích hợp AI (Gemini API)

Tài liệu này quy định các nguyên tắc cốt lõi khi phát triển bất kỳ tính năng AI nào trong dự án Travel Check-in App. Mọi tính năng AI (cho User, Owner, hay Admin) đều phải đọc và tuân thủ chặt chẽ hướng dẫn này để đảm bảo tính đồng nhất, dễ bảo trì và mở rộng.

## 1. Cấu trúc thư mục (Clean Architecture)

Logic xử lý AI được quy hoạch thành 2 phần độc lập:
1. **AI dành cho User (Customer Assistant):** Tích hợp trực tiếp vào thư mục `backend/src/services/ai-services/`.
2. **AI dành cho Owner/Admin (Manager Bot):** Tách riêng thành một microservice tại thư mục gốc `ai-manager-bot/` để thuận tiện cho việc huấn luyện (training) model sau này.

```text
TravelCheckinApp/
├── backend/
│   └── src/services/
│         └── ai-services/
│              └── customer-assistant/       <-- Dành cho API gọi từ App Mobile/Website của khách
│                   ├── chat.service.ts      <-- Chứa logic cốt lõi điều phối vòng đời chat, gọi thư viện Gemini
│                   ├── tools.ts             <-- Chứa các function (Function Calling) để AI tự gọi (vd: lấy data từ DB)
│                   └── prompt.builder.ts    <-- Nơi tập trung toàn bộ System Prompts và định nghĩa JSON Schema
│
└── ai-manager-bot/                          <-- Microservice độc lập dành cho Web Dashboard của Owner/Admin
     ├── app/
     │   ├── services/
     │   │   ├── analytics.py                <-- Logic để AI đọc/hiểu data thống kê từ MySQL và tư vấn kinh doanh
     │   │   └── report.py                   <-- Logic để AI tóm tắt các đánh giá (reviews) của khách hàng
     │   └── models/                         <-- Chứa scripts huấn luyện (training) hoặc fine-tuning mô hình AI
     └── main.py                             <-- Entry point của Microservice
```

*Lưu ý: Không viết logic xử lý prompt hay gọi Gemini trực tiếp trong Controllers. Controller chỉ làm nhiệm vụ tiếp nhận Request, chuyển cho đúng `chat.service.ts` hoặc các module trong `ai-services` xử lý, rồi trả kết quả về.*

## 2. Nguyên tắc hoạt động cốt lõi

1. **Database là nguồn sự thật tuyệt đối (Source of Truth):** Trí tuệ nhân tạo (AI) tuyệt đối không được tự tạo ra (hallucinate) tên địa điểm, địa chỉ, hoặc giá cả không tồn tại trong hệ thống. Luồng chuẩn: Backend lấy context thực tế (candidates) từ MySQL thông qua `tools.ts` -> Cung cấp cho AI -> AI tư vấn và lựa chọn từ danh sách đó.
2. **Thư viện SDK:** Bắt buộc sử dụng SDK mới nhất của Google là `@google/genai`, tận dụng tính năng `Structured Outputs` (ép AI trả về cấu trúc JSON chuẩn xác). Tuyệt đối không sử dụng SDK cũ `@google/generative-ai`.
3. **Phân tách trách nhiệm (SOLID):**
   - Không được nhồi nhét text prompt, định nghĩa hàm, và logic xử lý API vào chung một file. Phân tách rõ ràng vào 3 file `chat.service`, `tools`, `prompt.builder`.

## 3. Quản lý Database & Lưu trữ
Các tính năng AI phải tận dụng 3 bảng đã có sẵn trong cơ sở dữ liệu để đồng bộ luồng dữ liệu chung:
- `ai_conversations`: Quản lý danh sách các cuộc hội thoại (giúp User/Admin duy trì ngữ cảnh đa lượt).
- `ai_chat_history`: Lưu trữ từng tin nhắn, thời gian phản hồi, tokens đã dùng, trạng thái và các dữ liệu đi kèm (lưu dạng JSON trong cột `metadata`).
- `ai_assistant_feedback`: Thu thập phản hồi (hữu ích/không hữu ích) để cải thiện hệ thống sau này.

## 4. Triển khai Giao diện (Frontend & Mobile)
- **Website:** Tận dụng và tích hợp thẳng tính năng AI vào các UI có sẵn (VD: Bong bóng chat góc màn hình, Dashboard). Không vẽ thêm trang rườm rà nếu không thực sự cần thiết.
- **Mobile App:** Ưu tiên hoàn thiện phần lõi ở Backend và Website trước. Triển khai lên Mobile ở giai đoạn sau cùng để dùng chung chuẩn API.
