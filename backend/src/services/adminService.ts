import { ResultSetHeader } from "mysql2";
import { pool } from "../config/database";
import { messaging } from "../config/firebase";

export type PushNotificationAudience =
  | "all_users"
  | "all_owners"
  | "specific_user";

export interface SendPushNotificationParams {
  title: string;
  body: string;
  targetAudience: PushNotificationAudience;
  sentBy: number;
  targetUserId?: number | null;
  targetPath?: string | null;
}

export interface SendPushNotificationResult {
  notificationId: number;
  fcmSent: boolean;
  fcmMessageId: string | null;
}

const userTopic = (userId: number) => `user_${userId}`;

/**
 * Gửi thông báo đẩy cho hệ thống.
 * Lý do: Admin cần vừa lưu lịch sử vào DB, vừa bắn FCM thật tới Topic.
 */
export const sendPushNotification = async (
  params: SendPushNotificationParams,
): Promise<SendPushNotificationResult> => {
  const { title, body, targetAudience, sentBy, targetUserId, targetPath } =
    params;

  let insertResult: ResultSetHeader;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, target_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        body,
        targetAudience,
        targetUserId ?? null,
        sentBy,
        targetPath ?? null,
      ],
    );
    insertResult = result;
  } catch {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, body, targetAudience, targetUserId ?? null, sentBy],
    );
    insertResult = result;
  }

  const notificationId = insertResult.insertId;

  // DB không có push_device_tokens => chuẩn hoá gửi FCM bằng topic.
  // - all_users/all_owners: gửi theo topic cùng tên
  // - specific_user: gửi theo topic user_{id} (client cần subscribe)
  let topic: string | null = null;
  if (targetAudience === "all_users" || targetAudience === "all_owners") {
    topic = targetAudience;
  } else if (targetAudience === "specific_user" && targetUserId) {
    topic = userTopic(targetUserId);
  }

  if (!topic) {
    return { notificationId, fcmSent: false, fcmMessageId: null };
  }

  try {
    const fcmMessageId = await messaging.send({
      topic,
      notification: {
        title,
        body,
      },
      data: {
        notification_id: String(notificationId),
        target_audience: targetAudience,
        target_user_id: targetUserId != null ? String(targetUserId) : "",
        target_path: targetPath || "",
      },
    });

    return {
      notificationId,
      fcmSent: true,
      fcmMessageId,
    };
  } catch {
    // Không throw để tránh làm hỏng luồng tạo thông báo trong DB.
    return {
      notificationId,
      fcmSent: false,
      fcmMessageId: null,
    };
  }
};
