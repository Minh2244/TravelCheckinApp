## Công nghệ

- Python 3.10
- FastAPI
- PyTorch / Scikit-learn
- NLP + Computer Vision
- Docker-ready

## Các AI chính

1. AI Chatbot (RAG + NLP)
2. AI Gợi ý địa điểm
3. AI Phát hiện gian lận check-in
4. AI Kiểm duyệt nội dung
5. AI Nhận diện hình ảnh
6. AI Phân tích & dự đoán hành vi người dùng

# AI Service Specification

## Mục tiêu

Triển khai hệ thống AI độc lập nhằm:

- Hỗ trợ người dùng
- Phân tích hành vi
- Phát hiện gian lận
- Gợi ý thông minh
- Hỗ trợ quản trị

## Nguyên tắc thiết kế

- AI không tạo dữ liệu không tồn tại
- Ưu tiên dữ liệu thật
- Có fallback khi thiếu dữ liệu
- Có thể mở rộng theo microservice

## Danh sách AI

### 1. AI Chatbot (CORE AI)

- NLP + LLM
- RAG truy vấn database
- Hiểu ngữ cảnh người dùng
- Gợi ý hành động

### 2. AI Gợi ý địa điểm

- Collaborative Filtering
- Content-based
- Vector similarity

### 3. AI Phát hiện gian lận check-in

- Anomaly Detection
- Isolation Forest
- Rule-based kết hợp ML

### 4. AI Kiểm duyệt nội dung

- Text classification
- Phát hiện spam, toxic

### 5. AI Nhận diện hình ảnh

- CNN / Vision Transformer
- So sánh embedding ảnh
- Phát hiện nội dung nhạy cảm

### 6. AI Phân tích & dự đoán hành vi

- Time-series forecasting
- Clustering
- Churn prediction

## Giao tiếp hệ thống

AI Services giao tiếp với Backend thông qua REST API.
Mobile và Website không gọi trực tiếp AI nhằm đảm bảo bảo mật và khả năng mở rộng.

## Fallback

Nếu dữ liệu không tồn tại:

- Gợi ý tương tự
- Hỏi lại người dùng
- Đề xuất bổ sung dữ liệu

Trong trường hợp yêu cầu của người dùng không khớp với dữ liệu hiện có trong hệ thống, AI Chatbot sẽ áp dụng cơ chế fallback bao gồm: gợi ý các địa điểm tương tự dựa trên độ tương đồng, đặt câu hỏi làm rõ nhu cầu, hoặc đề xuất người dùng bổ sung địa điểm mới. AI không tạo ra dữ liệu không tồn tại nhằm đảm bảo độ tin cậy của hệ thống.

## Triển khai cây cấu trúc

services/
│
├── README.md
├── service.md
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
├── .env
│
├── common/ # Dùng chung cho tất cả AI
│ ├── **init**.py
│ ├── config.py # Load env, config hệ thống
│ ├── logger.py # Logging tập trung
│ ├── database.py # Kết nối Backend API / DB
│ ├── embeddings.py # Text/Image Embedding
│ ├── preprocessing.py # Làm sạch dữ liệu
│ ├── validation.py # Validate input
│ └── utils.py
│
├── api_gateway/ # FastAPI entry point
│ ├── **init**.py
│ ├── main.py # Khởi động FastAPI
│ ├── dependencies.py # Auth / rate limit
│ └── routers/
│ ├── **init**.py
│ ├── chatbot.py # API chatbot
│ ├── recommendation.py # API gợi ý địa điểm
│ ├── fraud.py # API phát hiện gian lận
│ ├── moderation.py # API kiểm duyệt
│ ├── vision.py # API xử lý ảnh
│ └── analytics.py # API phân tích hành vi
│
├── models/ # Model đã train
│ ├── chatbot/
│ │ ├── llm/
│ │ ├── vector_store/
│ │ └── config.json
│ │
│ ├── recommendation/
│ │ ├── cf_model.pkl
│ │ ├── content_model.pkl
│ │ └── embeddings.faiss
│ │
│ ├── fraud_detection/
│ │ ├── isolation_forest.pkl
│ │ └── rules.json
│ │
│ ├── moderation/
│ │ ├── text_classifier.pkl
│ │ └── label_map.json
│ │
│ ├── vision/
│ │ ├── image_classifier.pt
│ │ ├── nsfw_detector.pt
│ │ └── image_embeddings.faiss
│ │
│ └── analytics/
│ ├── churn_model.pkl
│ ├── clustering.pkl
│ └── forecasting.pkl
│
├── training/ # Huấn luyện model
│ ├── chatbot/
│ │ ├── build_rag.py
│ │ └── train_chatbot.py
│ │
│ ├── recommendation/
│ │ ├── prepare_data.py
│ │ └── train_recommend.py
│ │
│ ├── fraud/
│ │ ├── generate_features.py
│ │ └── train_fraud.py
│ │
│ ├── moderation/
│ │ ├── prepare_text.py
│ │ └── train_moderation.py
│ │
│ ├── vision/
│ │ ├── prepare_images.py
│ │ └── train_vision.py
│ │
│ └── analytics/
│ ├── feature_engineering.py
│ └── train_behavior.py
│
├── inference/ # Chạy model (predict)
│ ├── chatbot/
│ │ ├── **init**.py
│ │ ├── rag_engine.py
│ │ └── predict.py
│ │
│ ├── recommendation/
│ │ ├── **init**.py
│ │ └── predict.py
│ │
│ ├── fraud/
│ │ ├── **init**.py
│ │ └── predict.py
│ │
│ ├── moderation/
│ │ ├── **init**.py
│ │ └── predict.py
│ │
│ ├── vision/
│ │ ├── **init**.py
│ │ └── predict.py
│ │
│ └── analytics/
│ ├── **init**.py
│ └── predict.py
│
├── data/
│ ├── raw/ # Dữ liệu thật từ backend
│ │ ├── users.csv
│ │ ├── locations.csv
│ │ ├── checkins.csv
│ │ ├── reviews.csv
│ │ └── images/
│ │
│ ├── processed/ # Dữ liệu đã xử lý
│ │ ├── features.csv
│ │ ├── text_clean.csv
│ │ └── image_features.npy
│ │
│ └── synthetic/ # Dữ liệu giả lập
│ ├── synthetic_users.csv
│ ├── synthetic_checkins.csv
│ ├── synthetic_reviews.csv
│ └── synthetic_images/
│
└── scripts/ # Script tiện ích
├── fetch_from_backend.py # Lấy data từ backend
├── generate_synthetic.py # Sinh dữ liệu ảo
├── rebuild_models.sh
└── health_check.py
