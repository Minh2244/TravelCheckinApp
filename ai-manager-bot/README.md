# 🤖 AI Manager Bot — Nhật Ký Của Một Con Bot Biết Nghĩ

> *"Tui không phải ChatGPT, tui là con bot được đào tạo riêng để phục vụ hệ thống du lịch này."*

Đây là bộ não AI phục vụ cho **Admin** và **Owner** trong hệ thống TravelCheckinApp — một microservice Python chạy song song cùng Backend Node.js.

---

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Kiến Trúc Hệ Thống AI](#kiến-trúc-hệ-thống-ai)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Các API Endpoint](#các-api-endpoint)
- [Luồng Xử Lý Thông Minh](#luồng-xử-lý-thông-minh)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Biến Môi Trường](#biến-môi-trường)

---

## Tổng Quan

| Thông tin | Chi tiết |
|-----------|----------|
| **Ngôn ngữ** | Python 3.x |
| **Framework** | FastAPI + Uvicorn |
| **LLM Provider** | Google Gemini (AI) + OpenAI GPT (fallback) |
| **Database** | MySQL (kết nối trực tiếp để lấy ngữ cảnh) |
| **Cổng mặc định** | `8090` |
| **Khởi động cùng** | Backend Node.js (qua `concurrently`) |

Bot này không dùng ChatGPT thẳng cho user — nó **phân tích intent**, **lấy dữ liệu thực từ DB**, rồi mới trả lời thông minh theo ngữ cảnh của từng vai trò.

---

## Kiến Trúc Hệ Thống AI

```
User / Owner / Admin
        │
        ▼
  [Backend Node.js :3000]
        │  forward request
        ▼
  [AI Manager Bot :8090]  ◄─── FastAPI / Uvicorn
        │
        ├── Intent Service       ← Phân tích ý định người dùng (Gemini)
        ├── Action Registry      ← Đăng ký danh sách hành động hợp lệ
        ├── Action Planner       ← Lập kế hoạch hành động từ intent
        ├── NLP Fallback         ← Rule-based khi LLM không chắc chắn
        ├── Prompt Suggestions   ← Gợi ý câu hỏi theo role & route
        └── LLM Layer            ← Giao tiếp với Google Gemini / OpenAI
```

---

## Cấu Trúc Thư Mục

```
ai-manager-bot/
├── app/
│   ├── main.py                  # Entry point FastAPI — định nghĩa tất cả route
│   ├── intent_service.py        # Tim não của bot — phân tích intent + gọi Gemini
│   ├── action_registry.py       # Danh sách tất cả action được phép theo role
│   ├── action_planner.py        # Lập plan từ intent đã phân tích
│   ├── evaluator.py             # Đánh giá độ chính xác của bot (test cases)
│   ├── inference.py             # Điều phối: predict + process payload
│   ├── llm_layer.py             # Wrapper gọi LLM (Gemini / OpenAI)
│   ├── nlp_fallback.py          # Fallback rule-based khi LLM không chắc
│   ├── prompt_suggestions.py    # Sinh gợi ý câu hỏi theo context
│   ├── schemas.py               # Pydantic models — validate request/response
│   ├── settings.py              # Đọc cấu hình từ .env
│   ├── text_normalizer.py       # Chuẩn hóa văn bản tiếng Việt
│   ├── vietnamese_lexicon.py    # Từ điển tiếng Việt chuyên ngành du lịch
│   ├── vietnamese_stopwords.txt # Danh sách stopwords tiếng Việt (~20KB)
│   └── prompts/                 # System prompts theo từng role
├── database/                    # Script kết nối + query MySQL
├── datasets/                    # Dữ liệu huấn luyện intent
├── models/                      # Model ML đã train (intent classifier)
├── tests/                       # Pytest test cases
├── tools/
│   ├── train_intent_model.py        # Train model phân loại intent
│   ├── predict_intent_model.py      # Test predict thử
│   ├── build_synthetic_dataset.py   # Sinh dữ liệu tổng hợp
│   └── export_training_examples_sql.py # Export từ DB
├── requirements.txt             # Thư viện Python cần thiết
└── .env.example                 # Mẫu biến môi trường
```

---

## Các API Endpoint

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/health` | Kiểm tra trạng thái bot, LLM provider đang dùng |
| `POST` | `/predict` | Dự đoán intent từ payload văn bản |
| `POST` | `/chat` | Chat đầy đủ — phân tích + trả lời có ngữ cảnh |
| `GET` | `/suggestions` | Lấy gợi ý câu hỏi theo `role` và `route` |
| `POST` | `/plan-action` | Phân tích intent + trả về kế hoạch hành động |
| `POST` | `/evaluate` | Chạy test cases đánh giá độ chính xác |
| `GET` | `/evaluate/default` | Chạy bộ test cases mặc định |

---

## Luồng Xử Lý Thông Minh

```
1. Nhận tin nhắn từ người dùng (Admin/Owner)
         │
2. Chuẩn hóa văn bản tiếng Việt (text_normalizer)
         │
3. Gọi Gemini để phân tích intent
         │ (thất bại / không chắc)
         ├──────────────────────────────────►
         │                                  │
4. intent_service xử lý              NLP Fallback (rule-based)
         │
5. Lấy ngữ cảnh từ Node.js backend (/api/internal/ai/context)
         │
6. Kiểm tra action_registry — hành động có được phép không?
         │
7. action_planner tạo ra kế hoạch hành động
         │
8. LLM Layer gọi Gemini sinh câu trả lời cuối
         │
9. Trả về response có cấu trúc (intent, label, allowed, action_plan)
```

---

## Cài Đặt & Chạy

```bash
# Tạo môi trường ảo
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate

# Cài thư viện
pip install -r requirements.txt

# Chạy riêng lẻ
uvicorn app.main:app --host 127.0.0.1 --port 8090 --reload
```

> **Hoặc chạy cùng backend** (khuyến nghị):
> ```bash
> cd backend && npm run dev
> ```
> Lệnh này tự động khởi động cả Node.js và Python bot song song.

---

## Biến Môi Trường

Tạo file `.env` từ `.env.example`:

```env
# LLM Provider
LLM_PROVIDER=gemini          # hoặc openai
OPENAI_API_KEY=sk-...        # nếu dùng OpenAI
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=...           # nếu dùng Gemini

# MySQL — để bot lấy ngữ cảnh dữ liệu thực
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=travel_checkin
```

---

## Ghi Chú Kỹ Thuật

> [!NOTE]
> Bot hỗ trợ xử lý **tiếng Việt có dấu và không dấu** nhờ `text_normalizer.py` và `vietnamese_lexicon.py`. Người dùng có thể gõ "lich su don hang" hay "lịch sử đơn hàng" đều hiểu đúng.

> [!TIP]
> Dùng endpoint `/evaluate/default` để kiểm tra nhanh độ chính xác của bot sau khi thay đổi prompt hoặc cập nhật model.

> [!IMPORTANT]
> Bot phải được chạy **sau khi** Backend Node.js đã khởi động vì nó cần gọi về `/api/internal/ai/context` để lấy dữ liệu ngữ cảnh thực tế.

---

*Được xây dựng như một phần của luận văn tốt nghiệp — Đại học Tây Đô* 🎓
