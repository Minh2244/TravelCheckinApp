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
  const params: (string | number)[] = [entityType, entityId];

  if (role) {
    query += ` AND ei.role = ?`;
    params.push(role);
  }

  query += ` ORDER BY ei.is_primary DESC, ei.sort_order ASC`;

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows.map((r: RowDataPacket) => `/api/images/${(r as { id: number }).id}`);
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
  return `/api/images/${(rows[0] as { id: number }).id}`;
}
