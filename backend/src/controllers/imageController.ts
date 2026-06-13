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

    const affected = (result as { affectedRows: number }).affectedRows;
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
