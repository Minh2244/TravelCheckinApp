# Image Storage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace filesystem-based image storage (`backend/uploads/`) with MySQL LONGBLOB storage, serving images via `/api/images/:id`.

**Architecture:** Three new tables (`image_categories`, `images`, `entity_images`) centralize all image storage. A new `saveImageToDB()` utility compresses images with `sharp` and stores binary data in MySQL. All 12 existing upload endpoints are modified to use the new utility. Frontend requires zero changes because `resolveBackendUrl()` already handles relative paths like `/api/images/42`.

**Tech Stack:** Node.js, Express 5, TypeScript, MySQL (mysql2), sharp (image compression), Multer (existing, memoryStorage)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/src/controllers/imageController.ts` | GET/DELETE `/api/images/:id`, GET metadata |
| `backend/src/routes/imageRoutes.ts` | Express router for image endpoints |

### Modified Files
| File | Responsibility |
|------|---------------|
| `backend/src/utils/uploadImage.ts` | Replace `saveUploadedImageToUploads` with `saveImageToDB` |
| `backend/src/server.ts` | Remove static serving, register image routes |
| `backend/src/controllers/userController.ts` | Update 4 upload handlers |
| `backend/src/controllers/adminController.ts` | Update 3 upload handlers |
| `backend/src/controllers/ownerController.ts` | Update 5 upload handlers + add cover-image endpoints |
| `backend/src/routes/ownerRoutes.ts` | Add cover-image routes |

---

## Task 1: Install sharp dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install sharp**

```bash
cd E:\TravelCheckinApp\backend && npm install sharp
```

Expected: `sharp` added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify sharp works**

```bash
cd E:\TravelCheckinApp\backend && node -e "const sharp = require('sharp'); console.log('sharp version:', sharp.versions.sharp);"
```

Expected: Prints sharp version without errors.

- [ ] **Step 3: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/package.json backend/package-lock.json && git commit -m "deps: add sharp for image compression"
```

---

## Task 2: Create database tables and seed data

**Files:**
- Modify: `TravelCheckinApp.sql` (append new tables)

- [ ] **Step 1: Create the 3 tables**

Run this SQL in MySQL (via mysql CLI, Workbench, or the backend's database connection):

```sql
-- Table 1: image_categories
CREATE TABLE IF NOT EXISTS image_categories (
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

-- Table 2: images
CREATE TABLE IF NOT EXISTS images (
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

-- Table 3: entity_images
CREATE TABLE IF NOT EXISTS entity_images (
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

- [ ] **Step 2: Seed image_categories**

```sql
INSERT INTO image_categories (name, description, max_width, max_height, quality) VALUES
('avatar_user', 'Avatar người dùng', 400, 400, 80),
('avatar_admin', 'Avatar admin', 400, 400, 80),
('avatar_owner', 'Avatar chủ doanh nghiệp', 400, 400, 80),
('location_image', 'Ảnh địa điểm', 1200, 1200, 75),
('service_image', 'Ảnh dịch vụ', 1000, 1000, 75),
('review_image', 'Ảnh đánh giá', 1000, 1000, 70),
('review_reply_image', 'Ảnh phản hồi đánh giá', 800, 800, 70),
('diary_image', 'Ảnh nhật ký', 1200, 1200, 75),
('checkin_photo', 'Ảnh check-in', 1000, 1000, 75),
('user_background', 'Ảnh bìa người dùng', 1920, 1080, 80),
('admin_background', 'Ảnh bìa admin', 1920, 1080, 80),
('system_setting', 'Ảnh hệ thống (login bg)', 1920, 1080, 80);
```

- [ ] **Step 3: Verify tables exist**

```sql
SHOW TABLES LIKE 'image%';
SELECT COUNT(*) AS category_count FROM image_categories;
```

Expected: 3 tables listed, 12 categories.

- [ ] **Step 4: Commit**

```bash
cd E:\TravelCheckinApp && git add TravelCheckinApp.sql && git commit -m "db: add image_categories, images, entity_images tables with seed data"
```

---

## Task 3: Rewrite `uploadImage.ts` — new `saveImageToDB` utility

**Files:**
- Modify: `backend/src/utils/uploadImage.ts` (full rewrite)

- [ ] **Step 1: Replace the entire file content**

Replace the entire content of `backend/src/utils/uploadImage.ts` with:

```typescript
// backend/src/utils/uploadImage.ts
import sharp from "sharp";
import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type ImageCategory = {
  id: number;
  name: string;
  max_width: number;
  max_height: number;
  quality: number;
  max_file_size: number;
};

type SaveImageResult = {
  imageId: number;
  url: string;
  width: number;
  height: number;
  fileSize: number;
};

/**
 * Save an uploaded image to the database with compression.
 * Replaces the old saveUploadedImageToUploads() that wrote to filesystem.
 */
export async function saveImageToDB(
  file: Express.Multer.File,
  categoryName: string,
  userId?: number,
  userRole?: "user" | "owner" | "admin",
): Promise<SaveImageResult> {
  // 1. Validate MIME type
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    throw new Error("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
  }

  // 2. Get category settings
  const [catRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM image_categories WHERE name = ?",
    [categoryName],
  );
  if (catRows.length === 0) {
    throw new Error(`Không tìm thấy danh mục ảnh: ${categoryName}`);
  }
  const category = catRows[0] as ImageCategory;

  // 3. Resize + compress with sharp
  const resized = sharp(file.buffer).resize(category.max_width, category.max_height, {
    fit: "inside",
    withoutEnlargement: true,
  });

  let output: Buffer;
  if (file.mimetype === "image/png") {
    output = await resized.png({ quality: category.quality }).toBuffer();
  } else if (file.mimetype === "image/webp") {
    output = await resized.webp({ quality: category.quality }).toBuffer();
  } else {
    // Default to JPEG
    output = await resized.jpeg({ quality: category.quality }).toBuffer();
  }

  // 4. Get metadata
  const metadata = await sharp(output).metadata();

  // 5. INSERT into images table
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO images (category_id, original_name, mime_type, file_size, width, height, data, uploaded_by, uploaded_by_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category.id,
      file.originalname || "unknown.jpg",
      file.mimetype,
      output.length,
      metadata.width || null,
      metadata.height || null,
      output,
      userId || null,
      userRole || "user",
    ],
  );

  const imageId = result.insertId;

  return {
    imageId,
    url: `/api/images/${imageId}`,
    width: metadata.width || 0,
    height: metadata.height || 0,
    fileSize: output.length,
  };
}

/**
 * Link an image to an entity (location, service, user, etc.)
 * Used after saveImageToDB to create the entity_images junction record.
 */
export async function linkImageToEntity(
  imageId: number,
  entityType: string,
  entityId: number,
  role: string,
  sortOrder: number = 0,
  isPrimary: boolean = false,
): Promise<void> {
  await pool.query(
    `INSERT INTO entity_images (image_id, entity_type, entity_id, role, sort_order, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_primary = VALUES(is_primary)`,
    [imageId, entityType, entityId, role, sortOrder, isPrimary ? 1 : 0],
  );
}

/**
 * Remove old entity_images links before replacing (e.g., before setting new avatar)
 */
export async function removeEntityImages(
  entityType: string,
  entityId: number,
  role: string,
): Promise<void> {
  await pool.query(
    "DELETE FROM entity_images WHERE entity_type = ? AND entity_id = ? AND role = ?",
    [entityType, entityId, role],
  );
}

/**
 * Get image URLs for an entity (returns array of /api/images/:id URLs)
 */
export async function getEntityImageUrls(
  entityType: string,
  entityId: number,
  role?: string,
): Promise<string[]> {
  let query = `SELECT i.id FROM images i JOIN entity_images ei ON ei.image_id = i.id WHERE ei.entity_type = ? AND ei.entity_id = ? AND i.is_active = 1`;
  const params: any[] = [entityType, entityId];

  if (role) {
    query += ` AND ei.role = ?`;
    params.push(role);
  }

  query += ` ORDER BY ei.is_primary DESC, ei.sort_order ASC`;

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows.map((r: any) => `/api/images/${r.id}`);
}

/**
 * Get the primary (cover) image URL for an entity
 */
export async function getPrimaryImageUrl(
  entityType: string,
  entityId: number,
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.id FROM images i
     JOIN entity_images ei ON ei.image_id = i.id
     WHERE ei.entity_type = ? AND ei.entity_id = ? AND ei.is_primary = 1 AND i.is_active = 1
     LIMIT 1`,
    [entityType, entityId],
  );
  if (rows.length === 0) return null;
  return `/api/images/${(rows[0] as any).id}`;
}

// Keep the old function temporarily for backward compatibility during migration
// Will be removed in Task 10
export const saveUploadedImageToUploads = async ({
  file,
  folder,
  fileNamePrefix,
}: {
  file: Express.Multer.File;
  folder: string;
  fileNamePrefix: string;
}): Promise<{ urlPath: string; fileName: string }> => {
  throw new Error("saveUploadedImageToUploads is deprecated. Use saveImageToDB instead.");
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:\TravelCheckinApp\backend && npx tsc --noEmit src/utils/uploadImage.ts 2>&1 | head -20
```

Expected: No errors (or only errors from missing types that are resolved when the full project compiles).

- [ ] **Step 3: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/utils/uploadImage.ts && git commit -m "feat: rewrite uploadImage.ts with saveImageToDB for MySQL BLOB storage"
```

---

## Task 4: Create image controller and routes

**Files:**
- Create: `backend/src/controllers/imageController.ts`
- Create: `backend/src/routes/imageRoutes.ts`

- [ ] **Step 1: Create `backend/src/controllers/imageController.ts`**

```typescript
// backend/src/controllers/imageController.ts
import { Request, Response } from "express";
import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/images/:id
 * Serve image binary from database
 */
export const serveImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageId = Number(req.params.id);
    if (!Number.isFinite(imageId) || imageId <= 0) {
      res.status(400).json({ error: "Invalid image ID" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT data, mime_type FROM images WHERE id = ? AND is_active = 1",
      [imageId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const img = rows[0] as { data: Buffer; mime_type: string };
    res.setHeader("Content-Type", img.mime_type);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", img.data.length);
    res.send(img.data);
  } catch (error) {
    console.error("Lỗi serve ảnh:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/images/:id/metadata
 * Get image metadata without binary data
 */
export const getImageMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageId = Number(req.params.id);
    if (!Number.isFinite(imageId) || imageId <= 0) {
      res.status(400).json({ error: "Invalid image ID" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, original_name, mime_type, file_size, width, height,
              uploaded_by, uploaded_by_role, alt_text, is_active, created_at
       FROM images WHERE id = ?`,
      [imageId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Lỗi lấy metadata ảnh:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/images/:id
 * Soft delete an image (set is_active = 0)
 */
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageId = Number(req.params.id);
    if (!Number.isFinite(imageId) || imageId <= 0) {
      res.status(400).json({ error: "Invalid image ID" });
      return;
    }

    const [result] = await pool.query(
      "UPDATE images SET is_active = 0, updated_at = NOW() WHERE id = ?",
      [imageId],
    );

    const affected = (result as any).affectedRows;
    if (affected === 0) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.json({ success: true, message: "Đã xóa ảnh" });
  } catch (error) {
    console.error("Lỗi xóa ảnh:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
```

- [ ] **Step 2: Create `backend/src/routes/imageRoutes.ts`**

```typescript
// backend/src/routes/imageRoutes.ts
import { Router } from "express";
import { serveImage, getImageMetadata, deleteImage } from "../controllers/imageController";

const router = Router();

router.get("/:id", serveImage);
router.get("/:id/metadata", getImageMetadata);
router.delete("/:id", deleteImage);

export default router;
```

- [ ] **Step 3: Register routes in `server.ts`**

Add this import after the existing route imports (around line 27):

```typescript
import imageRoutes from "./routes/imageRoutes";
```

Add this route registration after the existing routes (around line 65, before the SSE endpoint):

```typescript
app.use("/api/images", imageRoutes);
```

- [ ] **Step 4: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/controllers/imageController.ts backend/src/routes/imageRoutes.ts backend/src/server.ts && git commit -m "feat: add image serve/metadata/delete API endpoints"
```

---

## Task 5: Remove filesystem static serving from `server.ts`

**Files:**
- Modify: `backend/src/server.ts` (lines 40-53)

- [ ] **Step 1: Remove the upload directory creation and static serving**

In `backend/src/server.ts`, remove lines 40-53 (the entire block that creates upload directories and serves static files):

```typescript
// DELETE THIS BLOCK:
// Serve uploaded files (avatars/backgrounds) from backend/uploads
const uploadRoot = path.resolve(__dirname, "..", "uploads");
for (const dir of [
  uploadRoot,
  path.join(uploadRoot, "avatars"),
  path.join(uploadRoot, "backgrounds"),
  path.join(uploadRoot, "locations"),
  path.join(uploadRoot, "services"),
  path.join(uploadRoot, "reviews"),
  path.join(uploadRoot, "checkins"),
]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
app.use("/uploads", express.static(uploadRoot));
```

Also remove the `import fs from "fs"` if it's no longer used elsewhere in the file. Check first:

```bash
cd E:\TravelCheckinApp\backend && grep -n "fs\." src/server.ts
```

If `fs` is only used for the upload directory block, remove the import too.

- [ ] **Step 2: Verify the server starts**

```bash
cd E:\TravelCheckinApp\backend && npx ts-node src/server.ts &
sleep 3
curl -s http://localhost:3000/api/images/999999 | head -5
# Should return 404 JSON, not crash
kill %1 2>/dev/null
```

Expected: Server starts without errors. `GET /api/images/999999` returns `{"error":"Image not found"}`.

- [ ] **Step 3: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/server.ts && git commit -m "refactor: remove filesystem static serving from server.ts"
```

---

## Task 6: Modify `userController.ts` — 4 upload handlers

**Files:**
- Modify: `backend/src/controllers/userController.ts`

- [ ] **Step 1: Update imports at the top of userController.ts**

Find the existing import of `saveUploadedImageToUploads` and replace it:

```typescript
// OLD:
import { saveUploadedImageToUploads } from "../utils/uploadImage";

// NEW:
import { saveImageToDB, linkImageToEntity, removeEntityImages } from "../utils/uploadImage";
```

- [ ] **Step 2: Rewrite `uploadUserAvatar` (lines 2331-2375)**

Replace the entire function with:

```typescript
export const uploadUserAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "avatar_user", userId, "user");

    // Remove old avatar link, add new one
    await removeEntityImages("user", userId, "avatar");
    await linkImageToEntity(result.imageId, "user", userId, "avatar", 0, true);

    // Update users table for backward compatibility
    await pool.query(
      `UPDATE users
       SET avatar_path = ?, avatar_source = 'upload', avatar_url = ?, avatar_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND role = 'user'`,
      [result.url, result.url, userId],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      data: { avatar_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload avatar user:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message: err?.message || "Không thể lưu ảnh đại diện.",
    });
  }
};
```

- [ ] **Step 3: Rewrite `uploadUserBackground` (lines 2271-2329)**

Replace the entire function with:

```typescript
export const uploadUserBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "user_background", userId, "user");

    await removeEntityImages("user", userId, "background");
    await linkImageToEntity(result.imageId, "user", userId, "background", 0, true);

    await pool.query(
      `UPDATE users
       SET background_path = ?, background_source = 'upload', background_url = ?,
           background_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND role = 'user'`,
      [result.url, result.url, userId],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh nền",
      data: { background_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload background user:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message: err?.message || "Không thể lưu ảnh nền.",
    });
  }
};
```

- [ ] **Step 4: Rewrite `uploadUserReviewImage` (lines 1181-1206)**

Replace the entire function with:

```typescript
export const uploadUserReviewImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "review_image", userId, "user");

    res.json({ success: true, data: { image_url: result.url } });
  } catch (error) {
    console.error("Lỗi upload ảnh review:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
```

- [ ] **Step 5: Rewrite `createUserCheckinWithPhoto` — only the image upload part (line ~837)**

Find this line in `createUserCheckinWithPhoto`:

```typescript
    // Save photo
    const { urlPath } = await saveUploadedImageToUploads({
      file,
      folder: "checkins",
      fileNamePrefix: `checkin-${userId}`,
    });
```

Replace it with:

```typescript
    // Save photo to database
    const imgResult = await saveImageToDB(file, "checkin_photo", userId, "user");
    const urlPath = imgResult.url;
```

Everything else in `createUserCheckinWithPhoto` stays the same — it already uses `urlPath` for the rest of the logic.

- [ ] **Step 6: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/controllers/userController.ts && git commit -m "feat: migrate user upload handlers to saveImageToDB"
```

---

## Task 7: Modify `adminController.ts` — 3 upload handlers

**Files:**
- Modify: `backend/src/controllers/adminController.ts`

- [ ] **Step 1: Update imports at the top of adminController.ts**

Find the existing import of `saveUploadedImageToUploads` and replace it:

```typescript
// OLD:
import { saveUploadedImageToUploads } from "../utils/uploadImage";

// NEW:
import { saveImageToDB, linkImageToEntity, removeEntityImages } from "../utils/uploadImage";
```

- [ ] **Step 2: Rewrite `uploadAdminAvatar` (lines 829-888)**

Replace the entire function with:

```typescript
export const uploadAdminAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "avatar_admin", adminId, "admin");

    await removeEntityImages("admin", adminId, "avatar");
    await linkImageToEntity(result.imageId, "admin", adminId, "avatar", 0, true);

    await pool.query(
      `UPDATE users SET avatar_path = ?, avatar_source = 'upload', avatar_url = ?, updated_at = NOW()
       WHERE user_id = ? AND role = 'admin'`,
      [result.url, result.url, adminId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPLOAD_ADMIN_AVATAR",
        JSON.stringify({
          mimetype: file.mimetype,
          size: file.size,
          image_id: result.imageId,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      data: { avatar_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload avatar admin:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message: err?.message || "Không thể lưu ảnh đại diện.",
    });
  }
};
```

- [ ] **Step 3: Rewrite `uploadAdminBackground` (lines 890-955)**

Replace the entire function with:

```typescript
export const uploadAdminBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "admin_background", adminId, "admin");

    await removeEntityImages("admin", adminId, "background");
    await linkImageToEntity(result.imageId, "admin", adminId, "background", 0, true);

    await pool.query(
      `UPDATE users
       SET background_path = ?, background_source = 'upload', background_url = ?,
           background_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND role = 'admin'`,
      [result.url, result.url, adminId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPLOAD_ADMIN_BACKGROUND",
        JSON.stringify({
          mimetype: file.mimetype,
          size: file.size,
          image_id: result.imageId,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh nền admin",
      data: { background_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload background admin:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message: err?.message || "Không thể lưu ảnh nền.",
    });
  }
};
```

- [ ] **Step 4: Rewrite `uploadBackgroundImage` (lines 1972-2030)**

Replace the entire function with:

```typescript
export const uploadBackgroundImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const body = req.body as { type?: string; apply?: string | boolean };
    const type = String(body.type || "app");
    if (!"app,login".includes(type)) {
      res.status(400).json({ success: false, message: "type không hợp lệ" });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "system_setting", adminId, "admin");

    // Link to system_setting entity
    await linkImageToEntity(result.imageId, "system_setting", 0, "setting", 0, true);

    const key = type === "app" ? "app_background_url" : "login_background_url";

    const applySetting =
      body.apply === undefined || body.apply === null
        ? true
        : String(body.apply) !== "0" &&
          String(body.apply).toLowerCase() !== "false";

    if (applySetting) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_value_file, setting_type)
         VALUES (?, ?, ?, 'image')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_value_file = VALUES(setting_value_file), setting_type = 'image'`,
        [key, result.url, result.url],
      );
    }

    res.json({
      success: true,
      message: "Đã upload ảnh nền",
      data: { image_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
```

- [ ] **Step 5: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/controllers/adminController.ts && git commit -m "feat: migrate admin upload handlers to saveImageToDB"
```

---

## Task 8: Modify `ownerController.ts` — 5 upload handlers + cover-image endpoints

**Files:**
- Modify: `backend/src/controllers/ownerController.ts`
- Modify: `backend/src/routes/ownerRoutes.ts`

- [ ] **Step 1: Update imports at the top of ownerController.ts**

Find the existing import of `saveUploadedImageToUploads` and replace it:

```typescript
// OLD:
import { saveUploadedImageToUploads } from "../utils/uploadImage";

// NEW:
import { saveImageToDB, linkImageToEntity, removeEntityImages, getEntityImageUrls } from "../utils/uploadImage";
```

- [ ] **Step 2: Rewrite `uploadOwnerAvatar` (lines 2343-2390)**

Replace the entire function with:

```typescript
export const uploadOwnerAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file avatar" });
      return;
    }

    const result = await saveImageToDB(file, "avatar_owner", auth.userId, "owner");

    await removeEntityImages("owner", auth.userId, "avatar");
    await linkImageToEntity(result.imageId, "owner", auth.userId, "avatar", 0, true);

    await pool.query(
      `UPDATE users
       SET avatar_url = ?, avatar_path = ?, avatar_source = 'upload', avatar_updated_at = NOW()
       WHERE user_id = ?`,
      [result.url, result.url, auth.userId],
    );

    await logAudit(auth.userId, "UPLOAD_OWNER_AVATAR", {
      mimetype: file.mimetype,
      size: file.size,
      image_id: result.imageId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload avatar thành công",
      data: { avatar_url: result.url },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};
```

- [ ] **Step 3: Rewrite `uploadOwnerBackground` (lines 2392-2443)**

Replace the entire function with:

```typescript
export const uploadOwnerBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file ảnh nền" });
      return;
    }

    const result = await saveImageToDB(file, "user_background", auth.userId, "owner");

    await removeEntityImages("owner", auth.userId, "background");
    await linkImageToEntity(result.imageId, "owner", auth.userId, "background", 0, true);

    await pool.query(
      `UPDATE users
       SET background_path = ?, background_source = 'upload', background_url = ?,
           background_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ?`,
      [result.url, result.url, auth.userId],
    );

    await logAudit(auth.userId, "UPLOAD_OWNER_BACKGROUND", {
      mimetype: file.mimetype,
      size: file.size,
      image_id: result.imageId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload ảnh nền thành công",
      data: { background_url: result.url },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};
```

- [ ] **Step 4: Rewrite `uploadOwnerServiceImage` (lines 2445-2485)**

Replace the entire function with:

```typescript
export const uploadOwnerServiceImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "service_image", auth.userId, "owner");

    await logAudit(auth.userId, "UPLOAD_OWNER_SERVICE_IMAGE", {
      mimetype: file.mimetype,
      size: file.size,
      image_id: result.imageId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload ảnh dịch vụ thành công",
      data: { url: result.url },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};
```

- [ ] **Step 5: Rewrite `createOwnerLocation` — image upload portion (lines 3011-3048)**

Find this block in `createOwnerLocation`:

```typescript
    const images: string[] = [];
    for (const file of uploadedFiles) {
      const { urlPath } = await saveUploadedImageToUploads({
        file,
        folder: "locations",
        fileNamePrefix: `location-${auth.userId}`,
      });
      if (urlPath) images.push(urlPath);
    }
```

Replace with:

```typescript
    const images: string[] = [];
    const imageIds: number[] = [];
    for (const file of uploadedFiles) {
      const result = await saveImageToDB(file, "location_image", auth.userId, "owner");
      images.push(result.url);
      imageIds.push(result.imageId);
    }
```

Then find the `INSERT INTO locations` query. After it (after the `const [result] = await pool.query<ResultSetHeader>(...)` line), add the entity_images linking:

```typescript
    const locationId = result.insertId;

    // Link images to location entity
    for (let i = 0; i < imageIds.length; i++) {
      await linkImageToEntity(
        imageIds[i],
        "location",
        locationId,
        "gallery",
        i,
        i === 0, // first image is primary
      );
    }
```

Also update the `data` in the response to include image URLs:

```typescript
    res.status(201).json({
      success: true,
      message: "Tạo địa điểm thành công (đang chờ duyệt)",
      data: { location_id: locationId, images },
    });
```

- [ ] **Step 6: Rewrite `updateOwnerLocation` — image upload portion (lines 3148-3192)**

Find this block in `updateOwnerLocation`:

```typescript
    if (uploadedFiles.length > 0) {
      const uploadedPaths: string[] = [];
      for (const file of uploadedFiles) {
        const { urlPath } = await saveUploadedImageToUploads({
          file,
          folder: "locations",
          fileNamePrefix: `location-${ownerId}`,
        });
        if (urlPath) uploadedPaths.push(urlPath);
      }
      body.images = [...existingImages, ...uploadedPaths];
    } else if (existingImages.length > 0) {
      body.images = existingImages;
    }
```

Replace with:

```typescript
    if (uploadedFiles.length > 0) {
      const uploadedPaths: string[] = [];
      const uploadedIds: number[] = [];
      for (const file of uploadedFiles) {
        const result = await saveImageToDB(file, "location_image", auth.userId, "owner");
        uploadedPaths.push(result.url);
        uploadedIds.push(result.imageId);
      }

      // Link new images to location
      const existingCount = existingImages.length;
      for (let i = 0; i < uploadedIds.length; i++) {
        await linkImageToEntity(
          uploadedIds[i],
          "location",
          locationId,
          "gallery",
          existingCount + i,
          false,
        );
      }

      body.images = [...existingImages, ...uploadedPaths];
    } else if (existingImages.length > 0) {
      body.images = existingImages;
    }
```

- [ ] **Step 7: Add `setLocationCoverImage` function to ownerController.ts**

Add this new function at the end of the file (before the closing):

```typescript
/**
 * PUT /api/owner/locations/:locationId/cover-image
 * Change the cover/primary image for a location
 */
export const setLocationCoverImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const locationId = Number(req.params.locationId);
    const { image_id } = req.body as { image_id?: number };

    if (!image_id) {
      res.status(400).json({ success: false, message: "Thiếu image_id" });
      return;
    }

    // Verify image belongs to this location
    const [exists] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM entity_images WHERE image_id = ? AND entity_type = 'location' AND entity_id = ?`,
      [image_id, locationId],
    );
    if (exists.length === 0) {
      res.status(404).json({ success: false, message: "Ảnh không thuộc địa điểm này" });
      return;
    }

    // Remove primary from all gallery images of this location
    await pool.query(
      `UPDATE entity_images SET is_primary = 0 WHERE entity_type = 'location' AND entity_id = ? AND role = 'gallery'`,
      [locationId],
    );

    // Set new cover image
    await pool.query(
      `UPDATE entity_images SET is_primary = 1, sort_order = 0 WHERE image_id = ? AND entity_type = 'location' AND entity_id = ?`,
      [image_id, locationId],
    );

    // Re-sort other images
    await pool.query(
      `UPDATE entity_images SET sort_order = sort_order + 1
       WHERE entity_type = 'location' AND entity_id = ? AND image_id != ? AND role = 'gallery'`,
      [locationId, image_id],
    );

    res.json({ success: true, message: "Đã đổi ảnh bìa" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

/**
 * PUT /api/owner/services/:serviceId/cover-image
 * Change the cover/primary image for a service
 */
export const setServiceCoverImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const serviceId = Number(req.params.serviceId);
    const { image_id } = req.body as { image_id?: number };

    if (!image_id) {
      res.status(400).json({ success: false, message: "Thiếu image_id" });
      return;
    }

    const [exists] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM entity_images WHERE image_id = ? AND entity_type = 'service' AND entity_id = ?`,
      [image_id, serviceId],
    );
    if (exists.length === 0) {
      res.status(404).json({ success: false, message: "Ảnh không thuộc dịch vụ này" });
      return;
    }

    await pool.query(
      `UPDATE entity_images SET is_primary = 0 WHERE entity_type = 'service' AND entity_id = ? AND role = 'gallery'`,
      [serviceId],
    );

    await pool.query(
      `UPDATE entity_images SET is_primary = 1, sort_order = 0 WHERE image_id = ? AND entity_type = 'service' AND entity_id = ?`,
      [image_id, serviceId],
    );

    await pool.query(
      `UPDATE entity_images SET sort_order = sort_order + 1
       WHERE entity_type = 'service' AND entity_id = ? AND image_id != ? AND role = 'gallery'`,
      [serviceId, image_id],
    );

    res.json({ success: true, message: "Đã đổi ảnh bìa dịch vụ" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};
```

- [ ] **Step 8: Add cover-image routes to `ownerRoutes.ts`**

Add these imports at the top of `backend/src/routes/ownerRoutes.ts`:

```typescript
import { setLocationCoverImage, setServiceCoverImage } from "../controllers/ownerController";
```

Add these routes (after the existing location routes, around line 155):

```typescript
// Cover image endpoints
router.put("/locations/:locationId/cover-image", upload.none(), setLocationCoverImage);
router.put("/services/:serviceId/cover-image", upload.none(), setServiceCoverImage);
```

- [ ] **Step 9: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/controllers/ownerController.ts backend/src/routes/ownerRoutes.ts && git commit -m "feat: migrate owner upload handlers to saveImageToDB + add cover-image endpoints"
```

---

## Task 9: Update location/service API responses to use new image URLs

**Files:**
- Modify: `backend/src/controllers/locationController.ts` (if location queries return `images` and `first_image`)

- [ ] **Step 1: Find where location data is returned**

```bash
cd E:\TravelCheckinApp\backend && grep -n "first_image\|\.images" src/controllers/locationController.ts | head -20
```

Identify the functions that return `images` and `first_image` fields. These need to be updated to query from `entity_images` + `images` tables instead of the JSON column.

- [ ] **Step 2: Add a helper to get location images**

Add this helper function at the top of `locationController.ts` (after imports):

```typescript
import { getEntityImageUrls, getPrimaryImageUrl } from "../utils/uploadImage";

/**
 * Get location images from entity_images table, falling back to JSON column
 */
async function getLocationImages(locationId: number): Promise<{ images: string[]; first_image: string | null }> {
  const images = await getEntityImageUrls("location", locationId, "gallery");
  if (images.length > 0) {
    const primary = await getPrimaryImageUrl("location", locationId);
    return { images, first_image: primary || images[0] };
  }
  return { images: [], first_image: null };
}
```

- [ ] **Step 3: Update location query responses**

For each function that returns location data, after fetching the location row, override `images` and `first_image`:

```typescript
// After fetching location from DB:
const location = rows[0];

// Override images with URLs from entity_images table
const imgData = await getLocationImages(location.location_id);
if (imgData.images.length > 0) {
  location.images = imgData.images;
  location.first_image = imgData.first_image;
}
```

Apply this pattern to: `getLocationById`, `getAllLocations`, `searchLocations`, and any other function that returns location data with images.

- [ ] **Step 4: Do the same for services**

If there's a `serviceController.ts` or services are returned from `ownerController.ts`, add similar logic for `getEntityImageUrls("service", serviceId, "gallery")`.

- [ ] **Step 5: Commit**

```bash
cd E:\TravelCheckinApp && git add backend/src/controllers/locationController.ts && git commit -m "feat: update location/service API responses to use entity_images URLs"
```

---

## Task 10: Remove old upload code and uploads directory

**Files:**
- Modify: `backend/src/utils/uploadImage.ts` (remove old function)
- Delete: `backend/uploads/` directory

- [ ] **Step 1: Remove the deprecated `saveUploadedImageToUploads` function**

In `backend/src/utils/uploadImage.ts`, remove the temporary backward-compat function at the bottom (the one that throws "deprecated" error). It should already be gone since we rewrote the file in Task 3, but verify:

```bash
cd E:\TravelCheckinApp\backend && grep -n "saveUploadedImageToUploads" src/utils/uploadImage.ts
```

Expected: No matches.

- [ ] **Step 2: Verify no remaining references to old function**

```bash
cd E:\TravelCheckinApp\backend && grep -rn "saveUploadedImageToUploads" src/
```

Expected: No matches. If there are matches, those files need to be updated.

- [ ] **Step 3: Delete the uploads directory**

```bash
rm -rf E:\TravelCheckinApp\backend\uploads
```

- [ ] **Step 4: Verify no remaining references to `/uploads/` path**

```bash
cd E:\TravelCheckinApp\backend && grep -rn "/uploads/" src/ --include="*.ts"
```

Expected: No matches (except possibly in comments).

- [ ] **Step 5: Commit**

```bash
cd E:\TravelCheckinApp && git add -A && git commit -m "cleanup: remove old filesystem upload code and uploads directory"
```

---

## Task 11: Verification — Test the complete flow

- [ ] **Step 1: Start the backend server**

```bash
cd E:\TravelCheckinApp\backend && npm run dev
```

Expected: Server starts without errors.

- [ ] **Step 2: Test image upload via API**

Use curl or Postman to test an upload (requires a valid JWT token):

```bash
# Upload a test avatar (replace TOKEN with a valid JWT)
curl -X POST http://localhost:3000/api/user/profile/avatar \
  -H "Authorization: Bearer TOKEN" \
  -F "avatar=@test-image.jpg"
```

Expected response:
```json
{
  "success": true,
  "message": "Đã cập nhật ảnh đại diện",
  "data": { "avatar_url": "/api/images/1" }
}
```

- [ ] **Step 3: Test image serve**

```bash
curl -o test-output.jpg http://localhost:3000/api/images/1
file test-output.jpg
```

Expected: `test-output.jpg: JPEG image data, ...`

- [ ] **Step 4: Test image metadata**

```bash
curl http://localhost:3000/api/images/1/metadata
```

Expected:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "mime_type": "image/jpeg",
    "file_size": 12345,
    "width": 400,
    "height": 400,
    ...
  }
}
```

- [ ] **Step 5: Test on website**

1. Open website, navigate to User Profile
2. Upload a new avatar
3. Verify avatar displays correctly (URL should be `http://localhost:3000/api/images/1`)
4. Navigate to Owner → Locations → Create new location with images
5. Verify gallery displays correctly

- [ ] **Step 6: Test cover image change**

```bash
curl -X PUT http://localhost:3000/api/owner/locations/1/cover-image \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image_id": 2}'
```

Expected: `{"success": true, "message": "Đã đổi ảnh bìa"}`

- [ ] **Step 7: Final commit with all verification**

```bash
cd E:\TravelCheckinApp && git add -A && git commit -m "verify: image storage redesign complete and tested"
```
