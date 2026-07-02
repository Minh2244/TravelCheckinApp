# AI Manager Bot

## 0. Lệnh nhanh dễ chạy

Máy hiện tại mình đã kiểm tra:

- Python: `3.11.5`
- pip: `25.2`
- GPU: có NVIDIA RTX 3050, `nvidia-smi` đã nhận
- Thư viện nền: đã có `fastapi`, `uvicorn`, `pydantic`, `pytest`, `numpy`, `scikit-learn`, `joblib`
- Còn thiếu: `torch`

### 0.1. Nếu chưa có môi trường `.venv`

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-ml.txt
```

### 0.2. Cài PyTorch để train bằng GPU

Chỉ cần chạy lệnh này nếu `torch` chưa có:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Kiểm tra GPU có vào được PyTorch không:

```powershell
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
```

### 0.3. Train bằng GPU trước

Lệnh này ưu tiên an toàn cho RTX 3050 4GB, giảm nguy cơ lỗi gần cuối lúc train:

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot\tools\train_intent_model.py --device cuda --epochs 8 --batch-size 32 --hidden-dim 128
```

### 0.4. Nếu GPU lỗi thì train bằng CPU

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot\tools\train_intent_model.py --device cpu --epochs 8 --batch-size 64 --hidden-dim 128
```

### 0.5. Test sau khi train

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot\tools\predict_intent_model.py "hom nay doanh thu quan tang hay giam"
python -m unittest discover -s ai-manager-bot\tests -p "test_*.py"
```

Nếu train bằng GPU hay bị lỗi khoảng 90%, thử giảm tiếp batch:

```powershell
python ai-manager-bot\tools\train_intent_model.py --device cuda --epochs 8 --batch-size 16 --hidden-dim 128
```

---

Đây là service AI riêng cho Owner/Admin của TravelCheckinApp.

Mục tiêu giai đoạn đầu:

- Chạy độc lập trong thư mục `ai-manager-bot`.
- Chưa nối Backend chính.
- Chưa gọi MySQL thật khi bot đang suy luận.
- Chưa gọi API nghiệp vụ thật.
- Chưa tự thực thi action.
- Chỉ phân loại ý định, hiểu câu hỏi, tạo câu trả lời nháp và trả `ActionPlan` an toàn.

Khi bot ổn, Backend chính mới gọi bot qua `managerBotClient`. Bot chỉ “nghĩ và đề xuất”, Backend chính vẫn là nơi kiểm quyền, lấy dữ liệu thật, preview, xác nhận và thực thi.

---

## 1. Chức năng hiện có

MVP hiện đã có:

- Phân loại intent theo `owner` và `admin`.
- Chặn route/action cấm của Owner.
- Nhận diện action `read`, `draft`, `write`, `critical`, `blocked`.
- Trích xuất entity cơ bản.
- Tạo câu trả lời từ mock context.
- Tạo `ActionPlan` có cấu trúc.
- Unit test bằng fixture JSON.
- Chuẩn hóa tiếng Việt đời thường: `ko`, `hong`, `hok`, `dc`, `gium`, `doang thu`, giọng miền Nam.
- Sinh dataset synthetic lớn cho Owner/Admin.
- Export dataset thành SQL để lưu vào MySQL.
- Script train intent model bằng CPU hoặc GPU CUDA.

---

## 2. Cấu trúc thư mục

```text
ai-manager-bot/
  app/                         # Logic xử lý bot/API
  database/                    # Migration và seed SQL
  datasets/                    # Bộ dữ liệu seed/sinh tự động
  models/                      # Model sau khi train
  tests/                       # Unit tests
  tools/                       # Script sinh dữ liệu/train/dự đoán/export SQL
  requirements.txt             # Thư viện chạy API
  requirements-ml.txt          # Thư viện train ML cơ bản
```

---

## 3. Cài môi trường

Chạy từ PowerShell:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-ml.txt
```

Nếu PowerShell in tiếng Việt bị lỗi encoding:

```powershell
$env:PYTHONIOENCODING="utf-8"
```

---

## 4. Cài GPU PyTorch CUDA

Nếu máy có NVIDIA GPU và muốn train bằng GPU, cài PyTorch CUDA 12.1:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Kiểm tra GPU:

```powershell
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
```

Nếu kết quả là `True` và hiện tên GPU thì train bằng `--device cuda` được.

Nếu chưa nhận GPU thì vẫn có thể train CPU bằng `--device cpu`.

---

## 5. Chạy test

Chạy từ thư mục gốc dự án:

```powershell
cd E:\TravelCheckinApp
python -m unittest discover -s ai-manager-bot/tests -p "test_*.py"
python -m compileall ai-manager-bot/app ai-manager-bot/tools
```

Kết quả mong muốn:

```text
Ran 9 tests
OK
```

---

## 6. Chạy API bot độc lập

Cài môi trường xong thì chạy:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 7001
```

Endpoint hiện có:

```text
GET  /health
GET  /suggestions
POST /predict
POST /chat
POST /plan-action
POST /evaluate
```

Bot API này chỉ dùng để test độc lập. Chưa nối Backend chính ở giai đoạn này.

Test guided prompt:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/suggestions?role=owner&route=/owner/dashboard' -Method Get
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/suggestions?role=owner&route=/owner/front-office/restaurant' -Method Get
```

---

## 7. Kiểm tra database đã đủ chưa

Dump hiện tại `TravelCheckinApp.sql` đã có các bảng AI nền:

- `ai_conversations`
- `ai_chat_history`
- `ai_assistant_feedback`

Nhưng để tự huấn luyện Owner/Admin AI thì cần thêm các bảng:

- `ai_action_runs`
- `ai_action_policies`
- `ai_prompt_versions`
- `ai_training_examples`
- `ai_model_versions`
- `ai_prompt_suggestions`
- `ai_prompt_impressions`

Các bảng này nằm trong:

```text
ai-manager-bot/database/001_ai_manager_bot_tables.sql
```

---

## 8. Nạp migration AI Manager Bot vào MySQL

Chạy từ thư mục gốc:

```powershell
cd E:\TravelCheckinApp
Get-Content ai-manager-bot\database\001_ai_manager_bot_tables.sql | & "D:\app\My SQL Sever\bin\mysql.exe" -u root -p TravelCheckinApp
```

Sau khi nhập mật khẩu MySQL, migration sẽ tạo các bảng còn thiếu.

Nếu máy bạn đã thêm MySQL vào PATH, có thể dùng lệnh ngắn:

```powershell
mysql -u root -p TravelCheckinApp < ai-manager-bot\database\001_ai_manager_bot_tables.sql
```

---

## 9. Sinh dataset lớn

Dataset được sinh local, không copy comment riêng tư trên mạng xã hội. Nội dung là synthetic, có thêm tiếng Việt đời thường, viết tắt, lỗi chính tả và giọng miền Nam.

Chạy:

```powershell
cd E:\TravelCheckinApp
$env:PYTHONIOENCODING="utf-8"
python ai-manager-bot/tools/build_synthetic_dataset.py --per-intent 3500
```

Output:

```text
ai-manager-bot/datasets/generated/owner_admin_synthetic_large.jsonl
```

Với `--per-intent 3500`, dataset khoảng:

```text
38.500 mẫu
mỗi intent trên 20.000 từ
```

---

## 10. Export dataset thành SQL

Sau khi sinh dataset:

```powershell
cd E:\TravelCheckinApp
$env:PYTHONIOENCODING="utf-8"
python ai-manager-bot/tools/export_training_examples_sql.py
```

Output:

```text
ai-manager-bot/database/seed_ai_training_examples.sql
```

---

## 11. Nạp dữ liệu huấn luyện vào MySQL

Chạy:

```powershell
cd E:\TravelCheckinApp
Get-Content ai-manager-bot\database\seed_ai_training_examples.sql | & "D:\app\My SQL Sever\bin\mysql.exe" -u root -p TravelCheckinApp
```

Nếu MySQL có trong PATH:

```powershell
mysql -u root -p TravelCheckinApp < ai-manager-bot\database\seed_ai_training_examples.sql
```

Lưu ý:

- Phải chạy migration ở bước 8 trước.
- Seed hiện tại khoảng `38.500` dòng.
- Dữ liệu được lưu vào bảng `ai_training_examples`.

---

## 12. Train model bằng GPU

Đảm bảo đã cài PyTorch CUDA và kiểm tra GPU thành công.

Chạy:

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot/tools/train_intent_model.py --device cuda --epochs 8
```

Model sau khi train sẽ nằm ở:

```text
ai-manager-bot/models/owner_admin_intent_v1/
  model.pt
  metadata.json
```

---

## 13. Train model bằng CPU

Nếu GPU chưa dùng được:

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot/tools/train_intent_model.py --device cpu --epochs 8
```

CPU chậm hơn GPU nhưng vẫn dùng được để kiểm thử.

---

## 14. Test model sau khi train

Ví dụ test câu sai chính tả/giọng miền Nam:

```powershell
cd E:\TravelCheckinApp
python ai-manager-bot/tools/predict_intent_model.py --text "doang thu thang nay giam hong coi gium tui"
```

Ví dụ khác:

```powershell
python ai-manager-bot/tools/predict_intent_model.py --text "them dv cafe sua 20k vo quan gium tui nha"
python ai-manager-bot/tools/predict_intent_model.py --text "admin khoa tk user nay dc hong"
python ai-manager-bot/tools/predict_intent_model.py --text "khach chui 1 sao soan cau tra loi hen"
```

---

## 15. Quy trình chạy đầy đủ từ đầu

Nếu muốn chạy một mạch:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-ml.txt
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

```powershell
cd E:\TravelCheckinApp
python -m unittest discover -s ai-manager-bot/tests -p "test_*.py"
python ai-manager-bot/tools/build_synthetic_dataset.py --per-intent 3500
python ai-manager-bot/tools/export_training_examples_sql.py
Get-Content ai-manager-bot\database\001_ai_manager_bot_tables.sql | & "D:\app\My SQL Sever\bin\mysql.exe" -u root -p TravelCheckinApp
Get-Content ai-manager-bot\database\seed_ai_training_examples.sql | & "D:\app\My SQL Sever\bin\mysql.exe" -u root -p TravelCheckinApp
python ai-manager-bot/tools/train_intent_model.py --device cuda --epochs 8
python ai-manager-bot/tools/predict_intent_model.py --text "doang thu thang nay giam hong coi gium tui"
```

Nếu chưa có GPU:

```powershell
python ai-manager-bot/tools/train_intent_model.py --device cpu --epochs 8
```

---

## 16. Quy tắc tích hợp Backend sau này

Chưa nối service này vào Backend chính cho tới khi:

- Unit test pass.
- Model phân loại đúng intent cơ bản.
- Owner route/action cấm bị chặn đúng.
- Admin critical action luôn cần xác nhận.
- Response schema ổn định.
- Backend chính có `managerBotClient`.
- Backend chính có `policyEngine`.
- Backend chính có `contextSanitizer`.
- Backend chính có `actionRegistry`.

Khi tích hợp thật:

```text
ai-manager-bot chỉ suy luận và đề xuất.
Backend Node.js kiểm quyền, lấy dữ liệu thật và thực thi.
```

Bot không được:

- Tự ghi MySQL production.
- Tự gọi API nghiệp vụ để sửa dữ liệu.
- Tự execute action.
- Tự vượt quyền Owner/Admin.
- Tự chạy SQL từ nội dung chat.
