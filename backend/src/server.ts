// backend/src/server.ts
import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { checkDatabaseConnection, pool } from "./config/database";
import { messaging } from "./config/firebase";
import authRoutes from "./routes/authRoutes";
import locationRoutes from "./routes/locationRoutes";
import adminRoutes from "./routes/adminRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import pushRoutes from "./routes/pushRoutes";
import userRoutes from "./routes/userRoutes";
import aiRoutes from "./routes/aiRoutes";
import sosRoutes from "./routes/sosRoutes";
import ownerRoutes from "./routes/ownerRoutes";
import geoRoutes from "./routes/geoRoutes";
import { addSseClient, publishToUser, removeSseClient } from "./utils/realtime";
import { ensureBookingTableReservationsSchema } from "./utils/tableReservations";
import { initSocketHub } from "./utils/socketHub";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const userTopic = (userId: number) => `user_${userId}`;

app.use(cors());
app.use(express.json());

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

app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/geo", geoRoutes);

// Realtime events (SSE)
// Note: EventSource can't send Authorization headers, so token is provided via query.
// This is acceptable for local/dev; consider switching to cookie auth or WebSocket in production.
app.get("/api/events", async (req, res) => {
  try {
    const tokenParam = req.query.token;
    const token =
      typeof tokenParam === "string"
        ? tokenParam
        : Array.isArray(tokenParam)
          ? String(tokenParam[0] ?? "")
          : "";

    if (!token) {
      res.status(401).json({ success: false, message: "Thiếu token" });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    ) as { userId?: number; role?: string };
    const userId = Number(decoded.userId);
    if (!Number.isFinite(userId)) {
      res.status(401).json({ success: false, message: "Token không hợp lệ" });
      return;
    }

    // Block locked accounts
    const [rows] = await pool.query(
      `SELECT user_id, status FROM users WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    const row = (rows as any[])?.[0] as
      | { user_id: number; status: string }
      | undefined;
    if (!row) {
      res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });
      return;
    }
    if (String(row.status) === "locked") {
      res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    addSseClient(userId, res);
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        // ignore
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeSseClient(userId, res);
    });
  } catch {
    res.status(401).json({ success: false, message: "Token không hợp lệ" });
  }
});

// Kiểm tra server sống hay chết
app.get("/", (req, res) => {
  res.send("🚀 Smart Travel & Check-in API is Running!");
});

// Gợi ý: Sau này bạn sẽ thêm các route khác ở đây, ví dụ:
// app.use("/api/users", userRoutes);
// app.use("/api/payments", paymentRoutes);

const startServer = async () => {
  try {
    await checkDatabaseConnection();
    await ensureBookingTableReservationsSchema();

    let lastAutoCancelAndExpireAt = new Date(0);

    const autoCancelAndExpireBookings = async () => {
      const rangeStart = lastAutoCancelAndExpireAt;
      try {
        // 1) Auto-cancel late arrivals (> 1 hour) for room/table bookings
        await pool.query(
          `UPDATE bookings b
           JOIN services s ON s.service_id = b.service_id
           SET b.status = 'cancelled',
               b.cancelled_at = NOW(),
               b.cancelled_by = NULL,
               b.notes = CONCAT(
                 COALESCE(b.notes, ''),
                 CASE WHEN b.notes IS NULL OR b.notes = '' THEN '' ELSE '\n' END,
                 '[SYSTEM] Auto-cancel: trễ hơn 1 tiếng'
               )
           WHERE b.status IN ('pending','confirmed')
             AND s.service_type IN ('room','table')
             AND (
               s.service_type <> 'room'
               OR NOT EXISTS (
                 SELECT 1
                 FROM hotel_stays hs
                 WHERE hs.booking_id = b.booking_id
                   AND hs.status IN ('inhouse','checked_out')
               )
             )
             AND b.check_in_date <= (NOW() - INTERVAL 1 HOUR)`,
        );

        await pool.query(
          `UPDATE booking_table_reservations r
           JOIN bookings b ON b.booking_id = r.booking_id
           JOIN services s ON s.service_id = b.service_id
           SET r.status = 'no_show',
               r.actual_end_time = NOW(),
               r.updated_at = CURRENT_TIMESTAMP
           WHERE r.status = 'active'
             AND s.service_type = 'table'
             AND b.status = 'cancelled'
             AND b.cancelled_by IS NULL
             AND b.check_in_date <= (NOW() - INTERVAL 1 HOUR)`,
        );

        // PMS sync: cancel hotel stays for auto-cancelled room bookings
        await pool.query(
          `UPDATE hotel_stays hs
           JOIN bookings b ON b.booking_id = hs.booking_id
           JOIN services s ON s.service_id = b.service_id
           JOIN locations l ON l.location_id = b.location_id
           SET hs.status = 'cancelled',
               hs.checkout_time = NOW(),
               hs.closed_by = NULL,
               hs.notes = CONCAT(
                 COALESCE(hs.notes, ''),
                 CASE WHEN hs.notes IS NULL OR hs.notes = '' THEN '' ELSE '\n' END,
                 '[SYSTEM] Auto-cancel: trễ hơn 1 tiếng'
               )
           WHERE b.status = 'cancelled'
             AND b.cancelled_by IS NULL
             AND s.service_type = 'room'
             AND l.location_type IN ('hotel','resort')
             AND hs.status = 'reserved'
             AND b.check_in_date <= (NOW() - INTERVAL 1 HOUR)`,
        );

        // Release rooms that no longer have active stays
        await pool.query(
          `UPDATE hotel_rooms r
           LEFT JOIN hotel_stays hs
             ON hs.room_id = r.room_id AND hs.status IN ('reserved','inhouse')
           SET r.status = 'vacant'
           WHERE r.status = 'reserved'
             AND hs.stay_id IS NULL`,
        );

        // Release POS tables for table bookings that were auto-cancelled and not checked in.
        await pool.query(
          `UPDATE pos_tables t
           JOIN booking_table_reservations r ON r.table_id = t.table_id
           JOIN bookings b ON b.booking_id = r.booking_id
           JOIN services s ON s.service_id = b.service_id
           SET t.status = 'free'
           WHERE t.status = 'reserved'
             AND r.status IN ('cancelled','no_show')
             AND b.status = 'cancelled'
             AND b.cancelled_by IS NULL
             AND s.service_type = 'table'
             AND b.check_in_date <= (NOW() - INTERVAL 1 HOUR)`,
        );

        // Cancel linked POS preorder orders (if any)
        await pool.query(
          `UPDATE pos_orders o
           JOIN bookings b ON b.pos_order_id = o.order_id
           JOIN services s ON s.service_id = b.service_id
           SET o.status = 'cancelled'
           WHERE o.status = 'open'
             AND b.status = 'cancelled'
             AND b.cancelled_by IS NULL
             AND s.service_type = 'table'
             AND b.check_in_date <= (NOW() - INTERVAL 1 HOUR)`,
        );
      } catch (err) {
        console.error("❌ Auto-cancel late bookings error:", err);
      }

      try {
        // 2) Auto-expire ticket bookings at closing time (stored in check_out_date)
        const [rows] = await pool.query(
          `SELECT b.booking_id
           FROM bookings b
           JOIN services s ON s.service_id = b.service_id
           WHERE b.status IN ('pending','confirmed')
             AND s.service_type = 'ticket'
             AND b.check_out_date IS NOT NULL
             AND b.check_out_date <= NOW()
           ORDER BY b.check_out_date ASC
           LIMIT 500`,
        );

        const ids = Array.isArray(rows)
          ? (rows as any[])
              .map((r) => Number((r as any).booking_id))
              .filter((x) => Number.isFinite(x))
          : [];

        if (ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");

          await pool.query(
            `UPDATE bookings
             SET status = 'cancelled',
                 cancelled_at = NOW(),
                 cancelled_by = NULL,
                 notes = CONCAT(
                   COALESCE(notes, ''),
                   CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE '\n' END,
                   '[SYSTEM] Ticket expired: hết hạn khi đóng cửa'
                 )
             WHERE booking_id IN (${placeholders})
               AND status IN ('pending','confirmed')`,
            ids,
          );

          await pool.query(
            `UPDATE booking_tickets
             SET status = 'void'
             WHERE booking_id IN (${placeholders})
               AND status = 'unused'`,
            ids,
          );
        }
      } catch (err) {
        console.error("❌ Auto-expire ticket bookings error:", err);
      }

      // Publish best-effort realtime events so user-side UI can clear notices.
      try {
        const rangeEnd = new Date();

        const [rows] = await pool.query(
          `SELECT booking_id, user_id, location_id
           FROM bookings
           WHERE status = 'cancelled'
             AND cancelled_by IS NULL
             AND cancelled_at IS NOT NULL
             AND cancelled_at > ?
             AND cancelled_at <= ?
             AND user_id IS NOT NULL
             AND (
               notes LIKE '%[SYSTEM] Auto-cancel:%'
               OR notes LIKE '%[SYSTEM] Ticket expired:%'
             )
           ORDER BY cancelled_at ASC
           LIMIT 2000`,
          [rangeStart, rangeEnd],
        );

        for (const r of rows as any[]) {
          const bookingId = Number(r.booking_id);
          const userId = Number(r.user_id);
          const locationId = Number(r.location_id);
          if (
            !Number.isFinite(bookingId) ||
            !Number.isFinite(userId) ||
            !Number.isFinite(locationId)
          ) {
            continue;
          }

          publishToUser(userId, {
            type: "booking_expired",
            booking_id: bookingId,
            location_id: locationId,
          });
        }

        lastAutoCancelAndExpireAt = rangeEnd;
      } catch (err) {
        console.error("❌ Publish booking_expired realtime error:", err);
      }
    };

    const sendBookingReminders = async () => {
      const reminders = [
        { type: "checkin", hoursBefore: 6, column: "check_in_date" },
        { type: "checkout", hoursBefore: 3, column: "check_out_date" },
      ] as const;

      for (const cfg of reminders) {
        try {
          const [rows] = await pool.query(
            `SELECT b.booking_id, b.user_id, b.${cfg.column} as target_time,
                    l.location_name, l.address
             FROM bookings b
             JOIN locations l ON b.location_id = l.location_id
             WHERE b.status IN ('pending','confirmed')
               AND b.${cfg.column} IS NOT NULL
               AND b.${cfg.column} BETWEEN NOW() AND (NOW() + INTERVAL ? HOUR)`,
            [cfg.hoursBefore],
          );

          for (const row of rows as any[]) {
            const bookingId = Number(row.booking_id);
            const userId = Number(row.user_id);
            if (!Number.isFinite(bookingId) || !Number.isFinite(userId))
              continue;

            const tag = `[booking:${bookingId}][${cfg.type}]`;
            const [sentRows] = await pool.query(
              `SELECT notification_id
               FROM push_notifications
               WHERE target_user_id = ? AND body LIKE ?
               LIMIT 1`,
              [userId, `%${tag}%`],
            );

            if (Array.isArray(sentRows) && sentRows.length > 0) continue;

            const title = "Nhắc lịch trình";
            const whenText = cfg.type === "checkin" ? "check-in" : "check-out";
            const body = `${tag} Bạn có lịch ${whenText} sắp tới tại ${row.location_name}.`;

            await pool.query(
              `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
               VALUES (?, ?, 'specific_user', ?, NULL)`,
              [title, body, userId],
            );

            try {
              // Không dùng bảng push_device_tokens (không có trong schema SQL).
              // Quy ước: client subscribe topic user_{userId}.
              await messaging.send({
                topic: userTopic(userId),
                notification: {
                  title,
                  body: `${whenText} sắp tới tại ${row.location_name}`,
                },
                data: {
                  type: "booking_reminder",
                  booking_id: String(bookingId),
                },
              });
            } catch {
              // ignore push errors or missing table
            }
          }
        } catch (err) {
          console.error("❌ Booking reminder error:", err);
        }
      }
    };

    // Auto-expire background schedules (best-effort)
    let bgScheduleMissingLogged = false;
    setInterval(async () => {
      try {
        await pool.query(
          `UPDATE background_schedules
           SET is_active = 0, updated_at = NOW()
           WHERE is_active = 1 AND end_date <= NOW()`,
        );
      } catch (err) {
        const e = err as { code?: string };
        if (e?.code === "ER_NO_SUCH_TABLE") {
          if (!bgScheduleMissingLogged) {
            bgScheduleMissingLogged = true;
            console.warn(
              "⚠️ background_schedules chưa tồn tại trong DB; bỏ qua auto-expire (hãy chạy migration/import schema mới).",
            );
          }
          return;
        }
        console.error("❌ Auto-expire schedules error:", err);
      }
    }, 60 * 1000);

    // Auto-expire vouchers (best-effort)
    setInterval(
      async () => {
        try {
          await pool.query(
            `UPDATE vouchers
           SET status = 'expired'
           WHERE status <> 'expired' AND end_date < NOW()`,
          );
        } catch (err) {
          console.error("❌ Auto-expire vouchers error:", err);
        }
      },
      10 * 60 * 1000,
    );

    // Booking reminders (best-effort)
    setInterval(sendBookingReminders, 30 * 60 * 1000);

    // Auto-cancel late bookings + auto-expire tickets (best-effort)
    setInterval(autoCancelAndExpireBookings, 60 * 1000);

    const httpServer = createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
      },
    });
    initSocketHub(io);

    httpServer.listen(PORT, () => {
      console.log(`📡 Server đang chạy tại: http://localhost:${PORT}`);
      console.log(`🔗 API Locations: http://localhost:${PORT}/api/locations`);
    });
  } catch (error) {
    console.error("❌ Lỗi khởi động:", error);
  }
};

startServer();
