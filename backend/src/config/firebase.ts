import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * Khởi tạo Firebase Admin SDK.
 * Lý do: Push Notification (FCM) cần Admin SDK để gửi tới Topic.
 */
const initializeFirebaseAdmin = (): void => {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), "firebase-service-account.json");

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      "Không tìm thấy firebase-service-account.json. Vui lòng đặt file ở root backend hoặc cấu hình FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  const raw = fs.readFileSync(serviceAccountPath, "utf8");
  const serviceAccount = JSON.parse(raw) as ServiceAccount;

  initializeApp({
    credential: cert(serviceAccount),
  });
};

initializeFirebaseAdmin();

export const messaging = getMessaging();
