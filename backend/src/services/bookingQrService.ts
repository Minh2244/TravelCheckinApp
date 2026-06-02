import crypto from "crypto";

interface QrPayload {
  booking_id: number;
  location_id: number;
  service_type: string;
  secure_token: string;
}

const getSecret = (): string => {
  return process.env.JWT_SECRET || "your-secret-key-for-qr-verification-2026";
};

/**
 * Sinh chữ ký bảo mật HMAC-SHA256
 */
const generateSignature = (bookingId: number, locationId: number, serviceType: string): string => {
  const message = `${bookingId}:${locationId}:${serviceType}`;
  return crypto
    .createHmac("sha256", getSecret())
    .update(message)
    .digest("hex");
};

/**
 * Tạo payload mã QR có kèm chữ ký số bảo mật
 */
export const generateSecureQrPayload = (
  bookingId: number,
  locationId: number,
  serviceType: string
): string => {
  const signature = generateSignature(bookingId, locationId, serviceType);
  const payload: QrPayload = {
    booking_id: bookingId,
    location_id: locationId,
    service_type: serviceType,
    secure_token: signature,
  };
  return JSON.stringify(payload);
};

/**
 * Xác thực mã QR và kiểm tra chéo địa điểm (Cross-Location prevention)
 */
export const verifySecureQrPayload = (
  qrString: string,
  currentStaffLocationId: number
): { bookingId: number; locationId: number; serviceType: string } => {
  let payload: QrPayload;
  try {
    payload = JSON.parse(qrString.trim()) as QrPayload;
  } catch {
    throw new Error("Mã QR không đúng định dạng hoặc không hợp lệ!");
  }

  const { booking_id, location_id, service_type, secure_token } = payload;

  if (
    !Number.isFinite(booking_id) ||
    !Number.isFinite(location_id) ||
    !service_type ||
    !secure_token
  ) {
    throw new Error("Mã QR chứa thông tin không đầy đủ!");
  }

  // 1) Kiểm tra tính hợp lệ của chữ ký số (ngăn giả mạo)
  const expectedSignature = generateSignature(booking_id, location_id, service_type);
  if (secure_token !== expectedSignature) {
    throw new Error("Mã QR bảo mật đã bị thay đổi hoặc giả mạo!");
  }

  // 2) Ngăn chặn quét chéo chi nhánh / địa điểm (Cross-Location Security Check)
  if (Number(location_id) !== Number(currentStaffLocationId)) {
    throw new Error("Mã đặt chỗ này thuộc về địa điểm khác. Vui lòng quét đúng nơi!");
  }

  return {
    bookingId: Number(booking_id),
    locationId: Number(location_id),
    serviceType: String(service_type),
  };
};
