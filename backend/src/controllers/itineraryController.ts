import { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

interface ItineraryItemInput {
  day_number: number;
  sort_order?: number;
  location_id?: number | null;
  custom_name?: string | null;
  custom_address?: string | null;
  time?: string | null;
  note?: string | null;
  estimated_cost?: number | null;
}

interface CreateItineraryBody {
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  items?: ItineraryItemInput[];
}

// ============================================================
// GET /api/user/itineraries — Danh sách lịch trình
// ============================================================
export async function getUserItineraries(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        i.itinerary_id,
        i.title,
        i.description,
        i.start_date,
        i.end_date,
        i.created_at,
        COUNT(ii.item_id) AS total_items,
        COALESCE(SUM(ii.estimated_cost), 0) AS total_estimated_cost,
        SUM(CASE WHEN ii.visited_at IS NOT NULL THEN 1 ELSE 0 END) AS visited_count
      FROM itineraries i
      LEFT JOIN itinerary_items ii ON ii.itinerary_id = i.itinerary_id
      WHERE i.user_id = ?
      GROUP BY i.itinerary_id
      ORDER BY i.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error("getUserItineraries error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================================================
// GET /api/user/itineraries/:itineraryId — Chi tiết lịch trình
// ============================================================
export async function getUserItineraryDetail(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const itineraryId = Number(req.params.itineraryId);

    // Lấy lịch trình
    const [itineraryRows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM itineraries WHERE itinerary_id = ? AND user_id = ?`,
      [itineraryId, userId]
    );
    if (itineraryRows.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy lịch trình" });
      return;
    }

    // Lấy items kèm thông tin location (nếu có)
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        ii.item_id,
        ii.day_number,
        ii.sort_order,
        ii.location_id,
        ii.custom_name,
        ii.custom_address,
        ii.time,
        ii.note,
        ii.estimated_cost,
        ii.visited_at,
        l.location_name,
        l.address AS location_address,
        l.latitude AS location_lat,
        l.longitude AS location_lng,
        l.rating AS location_rating
      FROM itinerary_items ii
      LEFT JOIN locations l ON l.location_id = ii.location_id
      WHERE ii.itinerary_id = ?
      ORDER BY ii.day_number ASC, ii.sort_order ASC`,
      [itineraryId]
    );

    const items = itemRows;

    const itinerary = {
      ...itineraryRows[0],
      items,
    };

    res.json({ success: true, data: itinerary });
  } catch (err: any) {
    console.error("getUserItineraryDetail error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================================================
// POST /api/user/itineraries — Tạo lịch trình mới
// ============================================================
export async function createUserItinerary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const { title, description, start_date, end_date, items } = req.body as CreateItineraryBody;

    // Validation
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: "Tên lịch trình không được để trống" });
      return;
    }
    if (!start_date || !end_date) {
      res.status(400).json({ success: false, message: "Ngày bắt đầu và kết thúc không được để trống" });
      return;
    }
    if (new Date(start_date) > new Date(end_date)) {
      res.status(400).json({ success: false, message: "Ngày kết thúc phải sau ngày bắt đầu" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Insert itinerary
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO itineraries (user_id, title, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
        [userId, title.trim(), description?.trim() || null, start_date, end_date]
      );
      const itineraryId = result.insertId;

      // Insert items
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          // Validate: phải có location_id hoặc custom_name
          if (!item.location_id && !item.custom_name?.trim()) {
            await conn.rollback();
            res.status(400).json({
              success: false,
              message: `Item thứ ${i + 1} phải có địa điểm hệ thống hoặc tên tùy chỉnh`,
            });
            return;
          }
          await conn.execute(
            `INSERT INTO itinerary_items (itinerary_id, day_number, sort_order, location_id, custom_name, custom_address, time, note, estimated_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itineraryId,
              item.day_number,
              item.sort_order ?? i,
              item.location_id || null,
              item.custom_name?.trim() || null,
              item.custom_address?.trim() || null,
              item.time?.trim() || null,
              item.note?.trim() || null,
              item.estimated_cost ?? null,
            ]
          );
        }
      }

      await conn.commit();

      // Trả về lịch trình vừa tạo
      const [itineraryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM itineraries WHERE itinerary_id = ?`,
        [itineraryId]
      );
      const [itemRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
          ii.*,
          l.location_name,
          l.address AS location_address
        FROM itinerary_items ii
        LEFT JOIN locations l ON l.location_id = ii.location_id
        WHERE ii.itinerary_id = ?
        ORDER BY ii.day_number ASC, ii.sort_order ASC`,
        [itineraryId]
      );

      res.status(201).json({
        success: true,
        data: {
          ...itineraryRows[0],
          items: itemRows,
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error("createUserItinerary error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================================================
// PUT /api/user/itineraries/:itineraryId — Cập nhật lịch trình
// ============================================================
export async function updateUserItinerary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const itineraryId = Number(req.params.itineraryId);
    const { title, description, start_date, end_date, items } = req.body as CreateItineraryBody;

    // Kiểm tra quyền sở hữu
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT itinerary_id FROM itineraries WHERE itinerary_id = ? AND user_id = ?`,
      [itineraryId, userId]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy lịch trình" });
      return;
    }

    // Validation
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: "Tên lịch trình không được để trống" });
      return;
    }
    if (!start_date || !end_date) {
      res.status(400).json({ success: false, message: "Ngày bắt đầu và kết thúc không được để trống" });
      return;
    }
    if (new Date(start_date) > new Date(end_date)) {
      res.status(400).json({ success: false, message: "Ngày kết thúc phải sau ngày bắt đầu" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Cập nhật itinerary
      await conn.execute(
        `UPDATE itineraries SET title = ?, description = ?, start_date = ?, end_date = ? WHERE itinerary_id = ?`,
        [title.trim(), description?.trim() || null, start_date, end_date, itineraryId]
      );

      // Xóa hết items cũ, insert lại items mới (đơn giản hơn diff)
      await conn.execute(`DELETE FROM itinerary_items WHERE itinerary_id = ?`, [itineraryId]);

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.location_id && !item.custom_name?.trim()) {
            await conn.rollback();
            res.status(400).json({
              success: false,
              message: `Item thứ ${i + 1} phải có địa điểm hệ thống hoặc tên tùy chỉnh`,
            });
            return;
          }
          await conn.execute(
            `INSERT INTO itinerary_items (itinerary_id, day_number, sort_order, location_id, custom_name, custom_address, time, note, estimated_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itineraryId,
              item.day_number,
              item.sort_order ?? i,
              item.location_id || null,
              item.custom_name?.trim() || null,
              item.custom_address?.trim() || null,
              item.time?.trim() || null,
              item.note?.trim() || null,
              item.estimated_cost ?? null,
            ]
          );
        }
      }

      await conn.commit();

      // Trả về lịch trình sau cập nhật
      const [itineraryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM itineraries WHERE itinerary_id = ?`,
        [itineraryId]
      );
      const [itemRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
          ii.*,
          l.location_name,
          l.address AS location_address
        FROM itinerary_items ii
        LEFT JOIN locations l ON l.location_id = ii.location_id
        WHERE ii.itinerary_id = ?
        ORDER BY ii.day_number ASC, ii.sort_order ASC`,
        [itineraryId]
      );

      res.json({
        success: true,
        data: {
          ...itineraryRows[0],
          items: itemRows,
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error("updateUserItinerary error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================================================
// DELETE /api/user/itineraries/:itineraryId — Xóa lịch trình
// ============================================================
export async function deleteUserItinerary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const itineraryId = Number(req.params.itineraryId);

    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT itinerary_id FROM itineraries WHERE itinerary_id = ? AND user_id = ?`,
      [itineraryId, userId]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy lịch trình" });
      return;
    }

    // CASCADE sẽ tự xóa items
    await pool.execute(`DELETE FROM itineraries WHERE itinerary_id = ?`, [itineraryId]);

    res.json({ success: true, message: "Đã xóa lịch trình" });
  } catch (err: any) {
    console.error("deleteUserItinerary error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================================================
// PATCH /api/user/itineraries/:itineraryId/items/:itemId/visit — Đánh dấu đã đến
// ============================================================
export async function toggleItemVisited(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const itineraryId = Number(req.params.itineraryId);
    const itemId = Number(req.params.itemId);

    // Kiểm tra quyền sở hữu
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT i.itinerary_id FROM itineraries i WHERE i.itinerary_id = ? AND i.user_id = ?`,
      [itineraryId, userId]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy lịch trình" });
      return;
    }

    // Kiểm tra item tồn tại
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      `SELECT item_id, visited_at FROM itinerary_items WHERE item_id = ? AND itinerary_id = ?`,
      [itemId, itineraryId]
    );
    if (itemRows.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy mục trong lịch trình" });
      return;
    }

    // Toggle: nếu đã visited → unvisited, nếu chưa → visited
    const currentVisited = itemRows[0].visited_at;
    if (currentVisited) {
      await pool.execute(`UPDATE itinerary_items SET visited_at = NULL WHERE item_id = ?`, [itemId]);
      res.json({ success: true, data: { item_id: itemId, visited_at: null } });
    } else {
      await pool.execute(`UPDATE itinerary_items SET visited_at = NOW() WHERE item_id = ?`, [itemId]);
      const [updated] = await pool.execute<RowDataPacket[]>(
        `SELECT visited_at FROM itinerary_items WHERE item_id = ?`,
        [itemId]
      );
      res.json({ success: true, data: { item_id: itemId, visited_at: updated[0].visited_at } });
    }
  } catch (err: any) {
    console.error("toggleItemVisited error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}
