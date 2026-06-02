import { Request, Response } from "express";
import { messaging } from "../config/firebase";

const userTopic = (userId: number) => `user_${userId}`;

const topicsForRole = (role: string | undefined | null) => {
  // Quy ước đồng bộ với DB: push_notifications.target_audience = all_users|all_owners|specific_user
  // Không lưu token vào DB (vì schema TravelCheckinApp.sql không có push_device_tokens).
  if (role === "owner" || role === "employee") return ["all_owners"];
  return ["all_users"];
};

export const registerDeviceToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const { token, platform, device_id, device_info } = req.body as {
      token?: string;
      platform?: "android" | "ios" | "web";
      device_id?: string;
      device_info?: string | null;
    };

    if (!token || typeof token !== "string" || token.trim().length < 10) {
      res.status(400).json({ success: false, message: "Token không hợp lệ" });
      return;
    }

    if (!platform || !["android", "ios", "web"].includes(platform)) {
      res
        .status(400)
        .json({ success: false, message: "platform không hợp lệ" });
      return;
    }

    if (!device_id || typeof device_id !== "string" || device_id.length < 3) {
      res
        .status(400)
        .json({ success: false, message: "device_id không hợp lệ" });
      return;
    }

    const role = req.userRole;
    const topics = [...topicsForRole(role), userTopic(userId)];
    for (const topic of topics) {
      try {
        await messaging.subscribeToTopic([token.trim()], topic);
      } catch {
        // best-effort: không chặn đăng nhập nếu subscribe lỗi
      }
    }

    res.status(201).json({
      success: true,
      message: "Đã đăng ký token (topic-based)",
      data: { platform, device_id, topics },
    });
  } catch (error: unknown) {
    console.error("Lỗi registerDeviceToken:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const removeDeviceToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const deviceId = req.params.deviceId;
    const body = req.body as { token?: string };
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    // Vì endpoint cũ dùng deviceId, schema DB lại không có bảng lưu token.
    // Giữ backward-compatible: nếu không có token thì coi như no-op.
    if (!token) {
      res.json({
        success: true,
        message: "Đã gỡ token (no-op vì backend không lưu token trong DB).",
        data: { device_id: deviceId ?? null },
      });
      return;
    }

    const role = req.userRole;
    const topics = [...topicsForRole(role), userTopic(userId)];
    for (const topic of topics) {
      try {
        await messaging.unsubscribeFromTopic([token], topic);
      } catch {
        // best-effort
      }
    }

    res.json({
      success: true,
      message: "Đã gỡ token (topic-based)",
      data: { device_id: deviceId ?? null, topics },
    });
  } catch (error: unknown) {
    console.error("Lỗi removeDeviceToken:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
