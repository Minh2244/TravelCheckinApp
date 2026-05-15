import { Request, Response } from "express";
import { pool } from "../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

interface SosBody {
  latitude?: number | null;
  longitude?: number | null;
  location_text?: string | null;
  message?: string | null;
  alert_id?: number | null;
}

export const createSosAlert = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as SosBody;
    const lat = body.latitude ?? null;
    const lng = body.longitude ?? null;

    if (lat == null || lng == null) {
      res.status(400).json({ success: false, message: "Thiếu tọa độ GPS" });
      return;
    }

    const pointText = `POINT(${lng} ${lat})`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO sos_alerts (user_id, location_coordinates, location_text, message)
       VALUES (?, ST_GeomFromText(?), ?, ?)`,
      [userId, pointText, body.location_text ?? null, body.message ?? null],
    );

    res.status(201).json({
      success: true,
      message: "Đã gửi tín hiệu SOS",
      data: { alert_id: result.insertId },
    });
  } catch (error) {
    console.error("Lỗi tạo SOS:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const pingSosAlert = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as SosBody;
    const lat = body.latitude ?? null;
    const lng = body.longitude ?? null;

    if (lat == null || lng == null) {
      res.status(400).json({ success: false, message: "Thiếu tọa độ GPS" });
      return;
    }

    const pointText = `POINT(${lng} ${lat})`;
    const alertId = Number(body.alert_id);

    if (Number.isFinite(alertId)) {
      await pool.query<ResultSetHeader>(
        `UPDATE sos_alerts
         SET location_coordinates = ST_GeomFromText(?),
             location_text = ?,
             message = ?,
             status = IF(status = 'resolved', 'processing', status)
         WHERE alert_id = ? AND user_id = ?`,
        [
          pointText,
          body.location_text ?? null,
          body.message ?? "SOS ping",
          alertId,
          userId,
        ],
      );
      res.json({ success: true, data: { alert_id: alertId } });
      return;
    }

    const [existingRows] = await pool.query<ResultSetHeader & RowDataPacket[]>(
      `SELECT alert_id
       FROM sos_alerts
       WHERE user_id = ? AND status IN ('pending','processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    const existingId = existingRows[0]?.alert_id;
    if (existingId) {
      await pool.query<ResultSetHeader>(
        `UPDATE sos_alerts
         SET location_coordinates = ST_GeomFromText(?),
             location_text = ?,
             message = ?,
             status = 'processing'
         WHERE alert_id = ?`,
        [
          pointText,
          body.location_text ?? null,
          body.message ?? "SOS ping",
          existingId,
        ],
      );
      res.json({ success: true, data: { alert_id: existingId } });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO sos_alerts (user_id, location_coordinates, location_text, message, status)
       VALUES (?, ST_GeomFromText(?), ?, ?, 'processing')`,
      [
        userId,
        pointText,
        body.location_text ?? null,
        body.message ?? "SOS ping",
      ],
    );

    res.json({ success: true, data: { alert_id: result.insertId } });
  } catch (error) {
    console.error("Lỗi ping SOS:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const stopSosAlert = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as SosBody;
    const alertId = Number(body.alert_id);

    if (Number.isFinite(alertId)) {
      await pool.query<ResultSetHeader>(
        `UPDATE sos_alerts
         SET status = 'resolved', resolved_at = NOW()
         WHERE alert_id = ? AND user_id = ?`,
        [alertId, userId],
      );
      res.json({ success: true, data: { alert_id: alertId } });
      return;
    }

    await pool.query<ResultSetHeader>(
      `UPDATE sos_alerts
       SET status = 'resolved', resolved_at = NOW()
       WHERE user_id = ? AND status IN ('pending','processing')`,
      [userId],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Lỗi dừng SOS:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
