# Thiết kế lại hệ thống lưu trữ hình ảnh — TravelCheckinApp

**Ngày:** 2026-06-11  
**Mục tiêu:** Chuyển toàn bộ hình ảnh từ lưu file trên ổ cứng (`backend/uploads/`) sang lưu binary trong MySQL. Tạo bảng `images` + `image_categories` tập trung. Xóa thư mục `uploads/`.

---

## 1. Tình trạng hiện tại

### 1.1 Cách lưu trữ cũ

- Ảnh upload qua Multer (`memoryStorage`) → ghi buffer ra `backend/uploads/{folder}/`
- DB chỉ lưu **đường dẫn string** (e.g. `/uploads/avatars/avatar-4-123456-abc.jpg`)
- Serve ảnh qua `express.static("/uploads")` trong `server.ts` (lines 41-53)
- 2 pattern lưu trong DB:
  - **JSON array:** `locations.images`, `services.images`, `reviews.images`, `review_replies.images`, `user_diary.images`
  - **Dedicated columns:** `users.avatar_path`/`avatar_url`/`avatar_source`, `users.background_path`/`background_url`/`background_source`
- Ảnh bìa location = phần tử đầu tiên trong mảng JSON (`first_image` generated column lấy `$[0]`)
- Chỉ có `location_chat_messages.image_data` là lưu base64 trực tiếp trong DB

### 1.2 Các endpoint upload hiện tại

| # | Endpoint | Controller:Line | Folder |
|---|----------|----------------|--------|
| 1 | `POST /api/user/profile/avatar` | userController:2331 | avatars/ |
| 2 | `POST /api/user/profile/background` | userController:2271 | backgrounds/ |
| 3 | `POST /api/user/checkins/photo` | userController:812 | checkins/ |
| 4 | `POST /api/user/reviews/upload` | userController:1181 | reviews/ |
| 5 | `POST /api/admin/profile/avatar` | adminController:829 | avatars/ |
| 6 | `POST /api/admin/profile/background` | adminController:890 | backgrounds/ |
| 7 | `POST /api/admin/backgrounds/upload` | adminController:1972 | (system) |
| 8 | `POST /api/owner/profile/avatar` | ownerController:2343 | avatars/ |
| 9 | `POST /api/owner/profile/background` | ownerController:2392 | backgrounds/ |
| 10 | `POST /api/owner/services/upload-image` | ownerController:2445 | services/ |
| 11 | `POST /api/owner/locations` | ownerController:~3000 | locations/ |
| 12 | `PUT /api/owner/locations/:id` | ownerController:~3150 | locations/ |

### 1.3 Cách frontend hiển thị ảnh

- **Website:** `resolveBackendUrl(path)` trong `website/src/utils/resolveBackendUrl.ts` — prepend backend origin vào relative path. Dùng ở 35+ files.
- **Mobile:** Tương tự, dùng `API_BASE_URL + path`
- URL hiện tại: `http://localhost:3000/uploads/avatars/avatar-4-xxx.jpg`
- URL mới sẽ là: `http://localhost:3000/api/images/42`

---

## 2. Thiết kế mới — 3 bảng database

### 2.1 Bảng `image_categories`

```sql
CREATE TABLE image_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  max_width INT DEFAULT 1200,
  max_height INT DEFAULT 1200,
  quality INT DEFAULT 80,
  max_file_size INT DEFAULT 5242880,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Seed data:**

| id | name | description | max_width | max_height | quality |
|----|------|-------------|-----------|------------|---------|
| 1 | avatar_user | Avatar người dùng | 400 | 400 | 80 |
| 2 | avatar_admin | Avatar admin | 400 | 400 | 80 |
| 3 | avatar_owner | Avatar chủ doanh nghiệp | 400 | 400 | 80 |
| 4 | location_image | Ảnh địa điểm | 1200 | 1200 | 75 |
| 5 | service_image | Ảnh dịch vụ | 1000 | 1000 | 75 |
| 6 | review_image | Ảnh đánh giá | 1000 | 1000 | 70 |
| 7 | review_reply_image | Ảnh phản hồi đánh giá | 800 | 800 | 70 |
| 8 | diary_image | Ảnh nhật ký | 1200 | 1200 | 75 |
| 9 | checkin_photo | Ảnh check-in | 1000 | 1000 | 75 |
| 10 | user_background | Ảnh bìa người dùng | 1920 | 1080 | 80 |
| 11 | admin_background | Ảnh bìa admin | 1920 | 1080 | 80 |
| 12 | system_setting | Ảnh hệ thống (login bg) | 1920 | 1080 | 80 |

### 2.2 Bảng `images`

```sql
CREATE TABLE images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  width INT,
  height INT,
  data LONGBLOB NOT NULL,
  uploaded_by INT,
  uploaded_by_role ENUM('user','owner','admin') DEFAULT 'user',
  alt_text VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES image_categories(id),
  INDEX idx_category (category_id),
  INDEX idx_uploaded_by (uploaded_by, uploaded_by_role),
  INDEX idx_active (is_active),
  INDEX idx_created (created_at)
);
```

### 2.3 Bảng `entity_images` (junction)

```sql
CREATE TABLE entity_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0,
  is_primary TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  UNIQUE KEY uk_entity_image (entity_type, entity_id, image_id, role),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_image (image_id),
  INDEX idx_primary (entity_type, entity_id, is_primary)
);
```

### 2.4 Mối quan hệ Foreign Key

```
image_categories (1) ────< (N) images (N) >──── (1) users (uploaded_by)
                            │
                            │ image_id FK
                            ▼
                       entity_images
                            │
                            │ entity_type + entity_id (polymorphic)
                            ▼
                  user | location | service | review |
                  review_reply | diary | checkin | system_setting
```

### 2.5 entity_type + role mapping

| entity_type | role | Ví dụ |
|-------------|------|-------|
| user | avatar | Avatar user #5 |
| user | background | Ảnh bìa user #5 |
| admin | avatar | Avatar admin #1 |
| owner | avatar | Avatar owner #4 |
| location | gallery | Ảnh gallery location #10 |
| location | primary | Ảnh bìa location #10 (is_primary=1) |
| service | gallery | Ảnh dịch vụ #20 |
| service | primary | Ảnh bìa dịch vụ #20 |
| review | attachment | Ảnh review #100 |
| review_reply | attachment | Ảnh reply #50 |
| diary | attachment | Ảnh nhật ký #30 |
| checkin | photo | Ảnh check-in #15 |
| system_setting | setting | Ảnh login background |

---

## 3. Backend — Upload utility mới

### 3.1 File: `backend/src/utils/uploadImage.ts`

**Xóa:** `saveUploadedImageToUploads()` (ghi file ra disk)

**Thay bằng:** `saveImageToDB(file, categoryName, userId, userRole) → { imageId, url, width, height, fileSize }`

```typescript
async function saveImageToDB(
  file: Express.Multer.File,
  categoryName: string,
  userId?: number,
  userRole?: 'user' | 'owner' | 'admin'
): Promise<{ imageId: number; url: string; width: number; height: number; fileSize: number }> {
  // 1. Lấy category settings từ DB
  const category = await db.query('SELECT * FROM image_categories WHERE name = ?', [categoryName]);

  // 2. Validate MIME type (JPEG, PNG, WebP)
  // 3. Resize bằng sharp (max_width, max_height từ category)
  const resized = sharp(file.buffer).resize(category.max_width, category.max_height, { fit: 'inside' });

  // 4. Compress (quality từ category)
  let output: Buffer;
  if (file.mimetype === 'image/png') {
    output = await resized.png({ quality: category.quality }).toBuffer();
  } else if (file.mimetype === 'image/webp') {
    output = await resized.webp({ quality: category.quality }).toBuffer();
  } else {
    output = await resized.jpeg({ quality: category.quality }).toBuffer();
  }

  // 5. Lấy metadata
  const metadata = await sharp(output).metadata();

  // 6. INSERT INTO images
  const result = await db.query(
    `INSERT INTO images (category_id, original_name, mime_type, file_size, width, height, data, uploaded_by, uploaded_by_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category.id, file.originalname, file.mimetype, output.length, metadata.width, metadata.height, output, userId, userRole]
  );

  return {
    imageId: result.insertId,
    url: `/api/images/${result.insertId}`,
    width: metadata.width,
    height: metadata.height,
    fileSize: output.length
  };
}
```

### 3.2 File: `backend/src/server.ts`

**Xóa:**
- `express.static("/uploads")` (lines 41-53)
- Code tạo thư mục uploads (lines 41-53)

**Thay bằng:** Route serve ảnh từ DB

```typescript
// Serve image from database
app.get('/api/images/:id', async (req, res) => {
  const [rows] = await db.query(
    'SELECT data, mime_type FROM images WHERE id = ? AND is_active = 1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Image not found' });

  const img = rows[0];
  res.setHeader('Content-Type', img.mime_type);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 ngày
  res.setHeader('Content-Length', img.data.length);
  res.send(img.data);
});
```

### 3.3 API mới cần thêm

| Endpoint | Method | Chức năng |
|----------|--------|-----------|
| `/api/images/:id` | GET | Serve ảnh binary từ DB |
| `/api/images/:id` | DELETE | Soft delete ảnh (is_active=0) |
| `/api/images/:id/metadata` | GET | Lấy metadata (không lấy binary) |
| `/api/owner/locations/:id/cover-image` | PUT | Đổi ảnh bìa location |
| `/api/owner/services/:id/cover-image` | PUT | Đổi ảnh bìa service |

---

## 4. Backend — Sửa các controller upload

### 4.1 Nguyên tắc chung

Mỗi endpoint upload cũ giữ nguyên URL, chỉ đổi logic bên trong:

**Cũ:**
```typescript
const result = saveUploadedImageToUploads(file, 'avatars', 'avatar');
// result.urlPath = "/uploads/avatars/avatar-4-xxx.jpg"
await db.query('UPDATE users SET avatar_path = ?, avatar_source = "upload" WHERE id = ?', [result.urlPath, userId]);
```

**Mới:**
```typescript
const result = await saveImageToDB(file, 'avatar_user', userId, 'user');
// result.url = "/api/images/42"
// 1. Xóa avatar cũ (nếu có)
await db.query(`DELETE FROM entity_images WHERE entity_type = 'user' AND entity_id = ? AND role = 'avatar'`, [userId]);
// 2. Gán avatar mới
await db.query(`INSERT INTO entity_images (image_id, entity_type, entity_id, role, is_primary) VALUES (?, 'user', ?, 'avatar', 1)`, [result.imageId, userId]);
// 3. Cập nhật avatar_url cho backward compatibility
await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [result.url, userId]);
```

### 4.2 Bảng sửa đổi chi tiết

| # | Endpoint | Controller | Category name | entity_type | role |
|---|----------|------------|---------------|-------------|------|
| 1 | `POST /api/user/profile/avatar` | userController:2331 | avatar_user | user | avatar |
| 2 | `POST /api/user/profile/background` | userController:2271 | user_background | user | background |
| 3 | `POST /api/user/checkins/photo` | userController:812 | checkin_photo | checkin | photo |
| 4 | `POST /api/user/reviews/upload` | userController:1181 | review_image | review | attachment |
| 5 | `POST /api/admin/profile/avatar` | adminController:829 | avatar_admin | admin | avatar |
| 6 | `POST /api/admin/profile/background` | adminController:890 | admin_background | admin | background |
| 7 | `POST /api/admin/backgrounds/upload` | adminController:1972 | system_setting | system_setting | setting |
| 8 | `POST /api/owner/profile/avatar` | ownerController:2343 | avatar_owner | owner | avatar |
| 9 | `POST /api/owner/profile/background` | ownerController:2392 | user_background | owner | background |
| 10 | `POST /api/owner/services/upload-image` | ownerController:2445 | service_image | service | gallery |
| 11 | `POST /api/owner/locations` | ownerController:~3000 | location_image | location | gallery/primary |
| 12 | `PUT /api/owner/locations/:id` | ownerController:~3150 | location_image | location | gallery/primary |

### 4.3 Đổi ảnh bìa (cover image)

**Endpoint mới:** `PUT /api/owner/locations/:locationId/cover-image`

```typescript
// Request: { "image_id": 42 }
async function setCoverImage(req, res) {
  const { locationId } = req.params;
  const { image_id } = req.body;

  // 1. Verify image belongs to this location
  const [exists] = await db.query(
    `SELECT id FROM entity_images WHERE image_id = ? AND entity_type = 'location' AND entity_id = ?`,
    [image_id, locationId]
  );
  if (!exists.length) return res.status(404).json({ error: 'Image not found for this location' });

  // 2. Bỏ is_primary cũ
  await db.query(
    `UPDATE entity_images SET is_primary = 0 WHERE entity_type = 'location' AND entity_id = ? AND role = 'gallery'`,
    [locationId]
  );

  // 3. Set ảnh mới làm bìa
  await db.query(
    `UPDATE entity_images SET is_primary = 1, sort_order = 0 WHERE image_id = ? AND entity_type = 'location' AND entity_id = ?`,
    [image_id, locationId]
  );

  // 4. Re-sort: ảnh bìa = sort_order 0, các ảnh khác tăng dần
  await db.query(
    `UPDATE entity_images SET sort_order = sort_order + 1
     WHERE entity_type = 'location' AND entity_id = ? AND image_id != ? AND role = 'gallery'`,
    [locationId, image_id]
  );

  return res.json({ success: true });
}
```

**Tương tự cho service:** `PUT /api/owner/services/:serviceId/cover-image`

---

## 5. Frontend — Thay đổi hiển thị ảnh

### 5.1 Website — `resolveBackendUrl.ts`

**Không cần sửa.** Hàm hiện tại đã xử lý đúng:
- Relative path `/api/images/42` → prepend backend origin → `http://localhost:3000/api/images/42`
- Absolute URL (Google avatar) → giữ nguyên

### 5.2 Website — API trả về URL mới

Backend trả về `avatar_url = "/api/images/42"` thay vì `/uploads/avatars/avatar-4-xxx.jpg`. Frontend tự động hiển thị đúng qua `resolveBackendUrl`.

### 5.3 Website — `first_image` và `images` array

**Vấn đề:** Các bảng `locations`, `services` vẫn có cột `images` (JSON array) và `first_image` (generated). Cần cập nhật API response.

**Giải pháp:** Backend query join `entity_images` + `images` để trả về URL array:

```typescript
// Trong locationController - getLocationById
const [imageRows] = await db.query(
  `SELECT i.id, i.mime_type, ei.is_primary, ei.sort_order
   FROM images i
   JOIN entity_images ei ON ei.image_id = i.id
   WHERE ei.entity_type = 'location' AND ei.entity_id = ? AND ei.role IN ('gallery','primary') AND i.is_active = 1
   ORDER BY ei.is_primary DESC, ei.sort_order ASC`,
  [locationId]
);

const images = imageRows.map(row => `/api/images/${row.id}`);
const first_image = imageRows.find(r => r.is_primary)?.id
  ? `/api/images/${imageRows.find(r => r.is_primary).id}`
  : images[0] || null;

// Response giữ nguyên format cũ để frontend không cần sửa
return { ...location, images, first_image };
```

### 5.4 Mobile — Tương tự

Mobile dùng `API_BASE_URL + path`. URL mới `/api/images/42` sẽ tự động đúng vì mobile đã concat base URL.

---

## 6. Migration — Thứ tự thực hiện

**Lưu ý:** Không cần script migration tự động. User sẽ tự upload lại dữ liệu ảnh sau khi hệ thống mới hoạt động.

### 6.1 Thứ tự migration

1. Cài `sharp` dependency: `cd backend && npm install sharp`
2. Tạo 3 bảng mới trong MySQL (chạy SQL CREATE TABLE)
3. Seed 12 dòng vào `image_categories`
4. Viết `saveImageToDB()` trong uploadImage.ts
5. Viết image routes + controller mới (GET/DELETE /api/images/:id)
6. Sửa 12 endpoint upload hiện tại trong 3 controller
7. Sửa API response locations/services/reviews (trả URL từ images table)
8. Thêm cover-image endpoints cho owner
9. Xóa `express.static("/uploads")` trong server.ts
10. Xóa `saveUploadedImageToUploads()` trong uploadImage.ts
11. Xóa thư mục `backend/uploads/`
12. Test toàn bộ (checklist section 11)
13. User upload lại dữ liệu ảnh qua hệ thống mới

---

## 7. Danh sách file cần sửa

### 7.1 Backend — File mới

| File | Mô tả |
|------|-------|
| `backend/src/utils/uploadImage.ts` | Viết lại: `saveImageToDB()` thay `saveUploadedImageToUploads()` |
| `backend/src/routes/imageRoutes.ts` | Route mới: GET/DELETE `/api/images/:id`, GET `/api/images/:id/metadata` |
| `backend/src/controllers/imageController.ts` | Controller mới cho image endpoints |

### 7.2 Backend — File sửa

| File | Thay đổi |
|------|----------|
| `backend/src/server.ts` | Xóa express.static("/uploads"), thêm image route |
| `backend/src/controllers/userController.ts` | Sửa uploadUserAvatar, uploadUserBackground, createUserCheckinWithPhoto, uploadUserReviewImage |
| `backend/src/controllers/adminController.ts` | Sửa uploadAdminAvatar, uploadAdminBackground, uploadBackgroundImage |
| `backend/src/controllers/ownerController.ts` | Sửa uploadOwnerAvatar, uploadOwnerBackground, uploadOwnerServiceImage, createOwnerLocation, updateOwnerLocation. Thêm setCoverImage |
| `backend/src/controllers/authController.ts` | Sửa getEffectiveAvatarUrl() nếu cần |
| `backend/src/routes/ownerRoutes.ts` | Thêm route PUT cover-image |

### 7.3 Frontend — Không cần sửa (hoặc sửa tối thiểu)

- `resolveBackendUrl.ts` — không cần sửa (tự động xử lý URL mới)
- Các file hiển thị ảnh — không cần sửa vì API trả về format cũ (URL string)
- `first_image`, `images` array — backend trả format tương thích

---

## 8. Phòng ngừa lỗi "Upload thành công nhưng không hiển thị"

### 8.1 Nguyên nhân thường gặp

1. **URL không đúng:** Frontend concat sai base URL + path
2. **CORS:** Backend không cho phép truy cập `/uploads/` từ origin khác
3. **Content-Type sai:** Serve ảnh không set đúng `Content-Type` header
4. **Cache cũ:** Browser cache URL cũ, server trả 404
5. **Path không khớp:** DB lưu `/uploads/abc.jpg` nhưng file thực tế ở `/uploads/avatars/abc.jpg`

### 8.2 Giải pháp trong thiết kế mới

1. **URL tuyệt đối:** API trả `/api/images/{id}` → `resolveBackendUrl` prepend origin → URL đúng 100%
2. **Content-Type:** Serve endpoint set `Content-Type` từ `mime_type` trong DB
3. **Cache:** Set `Cache-Control: public, max-age=86400` + có thể thêm ETag
4. **Validation:** Sau khi upload, test ngay bằng cách GET `/api/images/{id}` để verify
5. **Không có path mismatch:** Không còn path string, chỉ có image ID → không thể sai path

---

## 9. Ước tính dung lượng MySQL 1GB

| Loại ảnh | Kích thước TB/ảnh | Số ảnh ước tính | Dung lượng |
|----------|-------------------|----------------|------------|
| Avatar (400x400, q80) | ~30-50KB | 100 users | ~5MB |
| Location gallery (1200x1200, q75) | ~100-200KB | 50 locations × 5 ảnh | ~50MB |
| Service image (1000x1000, q75) | ~80-150KB | 100 services × 3 ảnh | ~45MB |
| Review image (1000x1000, q70) | ~60-120KB | 200 reviews × 2 ảnh | ~48MB |
| Diary image (1200x1200, q75) | ~100-200KB | 100 diary × 3 ảnh | ~60MB |
| Background (1920x1080, q80) | ~200-400KB | 20 backgrounds | ~8MB |
| System setting (1920x1080, q80) | ~200-400KB | 5 images | ~2MB |
| **Tổng** | | | **~218MB** |

Với 1GB MySQL, còn dư ~780MB cho dữ liệu khác và mở rộng. Đủ dùng cho luận văn.

---

## 10. Xử lý các trường hợp đặc biệt

### 10.1 Google/Facebook avatar (external URL)

**Vấn đề:** Khi user đăng nhập bằng Google/Facebook, `avatar_url` chứa URL tuyệt đối (e.g. `https://lh3.googleusercontent.com/...`). Ảnh này KHÔNG upload lên server.

**Giải pháp:**
- KHÔNG lưu external URL vào bảng `images` (ảnh không nằm trên server)
- Giữ nguyên logic hiện tại: `avatar_url` trong bảng `users` chứa external URL
- `resolveBackendUrl()` đã xử lý đúng: absolute URL → giữ nguyên, relative path → prepend backend
- Khi user upload avatar mới (thay avatar Google), mới lưu vào `images` + `entity_images`
- **Ưu tiên:** Hệ thống > Google/Facebook > Initials. Không có nút xóa avatar, không cần logic quay lại Google

**Code flow:**
```typescript
// Khi user đăng nhập Google → avatar_url = "https://lh3.googleusercontent.com/..."
// Frontend: resolveBackendUrl("https://...") → trả nguyên URL → hiển thị đúng

// Khi user upload avatar mới:
// 1. saveImageToDB() → imageId=42, url="/api/images/42"
// 2. INSERT entity_images (image_id=42, entity_type='user', entity_id=5, role='avatar')
// 3. UPDATE users SET avatar_url="/api/images/42" WHERE id=5
// Frontend: resolveBackendUrl("/api/images/42") → "http://localhost:3000/api/images/42" → hiển thị đúng
```

### 10.2 Review image upload (2 bước)

**Hiện tại:** `POST /api/user/reviews/upload` upload ảnh → trả path → frontend gửi path khi tạo review

**Mới:**
```
Bước 1: POST /api/user/reviews/upload (file)
  → saveImageToDB(file, 'review_image', userId, 'user')
  → INSERT entity_images (image_id, entity_type='review', entity_id=NULL, role='attachment')
  → Return { image_id, url }

Bước 2: POST /api/user/reviews (review content + image_ids[])
  → INSERT INTO reviews (content, rating, ...)
  → UPDATE entity_images SET entity_id=reviewId WHERE image_id IN (image_ids[])
```

**Hoặc đơn giản hơn (giữ flow cũ):**
```
Bước 1: POST /api/user/reviews/upload → saveImageToDB → return { url: "/api/images/42" }
Bước 2: POST /api/user/reviews { content, images: ["/api/images/42"] }
  → Backend lưu images array vào reviews.images JSON column (giữ nguyên format cũ)
  → Không cần entity_images cho review (giữ JSON array cho đơn giản)
```

**Quyết định:** Giữ JSON array cho reviews, review_replies, user_diary vì:
- Ít ảnh (1-5 ảnh/review)
- Không cần đổi ảnh bìa hay quản lý phức tạp
- Ít thay đổi code

### 10.3 Location/Service create với nhiều ảnh

**Hiện tại:** `POST /api/owner/locations` upload tối đa 12 ảnh (field `images`)

**Mới:**
```typescript
// Trong createOwnerLocation:
const imageIds = [];
for (const file of req.files['images']) {
  const result = await saveImageToDB(file, 'location_image', ownerId, 'owner');
  imageIds.push(result.imageId);
}

// Gán ảnh đầu tiên làm primary
for (let i = 0; i < imageIds.length; i++) {
  await db.query(
    `INSERT INTO entity_images (image_id, entity_type, entity_id, role, sort_order, is_primary)
     VALUES (?, 'location', ?, 'gallery', ?, ?)`,
    [imageIds[i], locationId, i, i === 0 ? 1 : 0]
  );
}

// Trả về URL array cho frontend
const imageUrls = imageIds.map(id => `/api/images/${id}`);
```

### 10.4 Chat images (base64 trong location_chat_messages)

**Hiện tại:** `location_chat_messages.image_data` lưu base64 LONGTEXT

**Giải pháp:** KHÔNG migrate chat images sang hệ thống mới vì:
- Chat images đã hoạt động ổn với base64
- Socket.IO deliberately không transmit image_data (gửi has_image flag)
- Migration chat images phức tạp (cần thêm entity_type='chat_message')
- Ưu tiên thấp hơn cho luận văn

**Giữ nguyên:** Chat images tiếp tục dùng base64 trong `image_data`. Chỉ migrate images trong uploads/.

### 10.5 Các cột JSON cũ (locations.images, services.images, etc.)

**Sau migration:**
- `locations.images` JSON column → **GIỮ NGUYÊN** nhưng đánh dấu deprecated
- Backend API response sẽ override bằng dữ liệu từ `entity_images` + `images`
- Generated column `locations.first_image` → **XÓA** (không cần nữa, lấy từ entity_images)
- `users.avatar_path`, `users.background_path` → **GIỮ NGUYÊN** cho backward compatibility
- `users.avatar_url` → cập nhật thành `/api/images/{id}` khi upload mới

---

## 11. Kiểm tra hiển ảnh sau migration

### 11.1 Checklist test

| # | Test case | Endpoint kiểm tra | Mong đợi |
|---|-----------|-------------------|----------|
| 1 | Avatar user hiển thị | `GET /api/images/{avatar_id}` | 200, Content-Type: image/jpeg, binary data |
| 2 | Avatar admin hiển thị | Tương tự | 200 |
| 3 | Avatar owner hiển thị | Tương tự | 200 |
| 4 | Location gallery (nhiều ảnh) | `GET /api/locations/:id` | images array chứa `/api/images/...` URLs |
| 5 | Location cover image | `GET /api/locations/:id` | first_image đúng |
| 6 | Service images | `GET /api/services/:id` | images array chứa URLs |
| 7 | Review images | `GET /api/reviews/:id` | images array chứa URLs |
| 8 | User profile page | Website → User Profile | Avatar hiển thị |
| 9 | Admin Users list | Website → Admin Users | Avatar hiển thị trong table |
| 10 | LocationDetail page | Website → Location Detail | Gallery + cover image |
| 11 | UserMap markers | Website → User Map | Marker circle icon |
| 12 | Login background | Website → Login | Background image |
| 13 | Mobile Home screen | Mobile app | Location images |
| 14 | Mobile Profile | Mobile app | Avatar |
| 15 | Đổi ảnh bìa location | `PUT /api/owner/locations/:id/cover-image` | Cover image thay đổi |

### 11.2 Script test nhanh

```bash
# Sau khi migration, test serve ảnh:
curl -o test.jpg http://localhost:3000/api/images/1
file test.jpg  # Should show: JPEG image data

# Test metadata:
curl http://localhost:3000/api/images/1/metadata
# Should return: { id, mime_type, file_size, width, height }
```

---

## 12. Dependencies cần thêm

| Package | Version | Purpose |
|---------|---------|---------|
| `sharp` | ^0.33.x | Resize + compress ảnh trước khi lưu DB |
| `@types/sharp` | ^0.33.x | TypeScript types (dev dependency) |

```bash
cd backend && npm install sharp && npm install -D @types/sharp
```

---

## 13. Tóm tắt thay đổi

### Bảng mới (DB)
- `image_categories` — 12 danh mục ảnh
- `images` — lưu binary data + metadata
- `entity_images` — link ảnh → entity

### API mới (Backend)
- `GET /api/images/:id` — serve ảnh
- `DELETE /api/images/:id` — soft delete
- `GET /api/images/:id/metadata` — metadata only
- `PUT /api/owner/locations/:id/cover-image` — đổi bìa location
- `PUT /api/owner/services/:id/cover-image` — đổi bìa service

### API sửa đổi (Backend)
- 12 endpoint upload hiện tại — đổi logic từ ghi file → lưu DB
- API response locations/services/reviews — trả URL từ images table

### File mới (Backend)
- `backend/src/utils/uploadImage.ts` — viết lại `saveImageToDB()`
- `backend/src/routes/imageRoutes.ts` — routes mới
- `backend/src/controllers/imageController.ts` — controller mới
- `backend/src/scripts/migrateImagesToDB.ts` — migration script

### File sửa (Backend)
- `backend/src/server.ts` — xóa static serving, thêm image route
- `backend/src/controllers/userController.ts` — 4 upload handlers
- `backend/src/controllers/adminController.ts` — 3 upload handlers
- `backend/src/controllers/ownerController.ts` — 5 upload handlers + cover image
- `backend/src/controllers/authController.ts` — avatar URL helper
- `backend/src/routes/ownerRoutes.ts` — cover image routes

### Frontend
- **Không cần sửa** — `resolveBackendUrl()` tự động xử lý URL mới
- API trả format tương thích (URL string)
