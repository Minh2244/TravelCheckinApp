import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

import { confirm } from "../modules/ui/confirm-store";
import { showToast } from "../modules/ui/toast-store";

function hasPhotoSaveAccess(permission: MediaLibrary.PermissionResponse) {
  return (
    permission.granted ||
    permission.accessPrivileges === "all" ||
    permission.accessPrivileges === "limited"
  );
}

function isExpoGoMediaLibraryRestriction(error: unknown) {
  const message = String(error instanceof Error ? error.message : error);
  return (
    message.includes("Expo Go") &&
    message.includes("media library")
  );
}

async function shareTicketImage(uri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return false;
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Lưu vé QR",
    mimeType: "image/png",
    UTI: "public.png",
  });
  return true;
}

export async function ensureTicketSavePermission() {
  let currentPermission: MediaLibrary.PermissionResponse;
  try {
    currentPermission = await MediaLibrary.getPermissionsAsync(true, ["photo"]);
  } catch (error) {
    if (isExpoGoMediaLibraryRestriction(error)) {
      showToast("Expo Go không hỗ trợ lưu trực tiếp, sẽ mở bảng chia sẻ vé QR.");
      return true;
    }
    throw error;
  }

  if (hasPhotoSaveAccess(currentPermission)) {
    return true;
  }

  if (!currentPermission.canAskAgain) {
    showToast("Bạn cần mở Cài đặt để cấp quyền lưu ảnh.");
    return false;
  }

  const accepted = await confirm({
    title: "Quyền lưu ảnh",
    message: "Ứng dụng cần quyền lưu ảnh để tải vé QR về điện thoại.",
    cancelText: "Để sau",
    confirmText: "OK",
  });

  if (!accepted) {
    return false;
  }

  let requestedPermission: MediaLibrary.PermissionResponse;
  try {
    requestedPermission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  } catch (error) {
    if (isExpoGoMediaLibraryRestriction(error)) {
      showToast("Expo Go không hỗ trợ lưu trực tiếp, sẽ mở bảng chia sẻ vé QR.");
      return true;
    }
    throw error;
  }

  if (hasPhotoSaveAccess(requestedPermission)) {
    return true;
  }

  showToast(
    requestedPermission.canAskAgain
      ? "Chưa thể lưu vé vì bạn chưa cấp quyền thư viện ảnh."
      : "Bạn cần mở Cài đặt để cấp quyền lưu ảnh.",
  );
  return false;
}

export async function saveTicketImageToLibrary(uri: string) {
  try {
    await MediaLibrary.createAssetAsync(uri);
    return "saved" as const;
  } catch (error) {
    const didShare = await shareTicketImage(uri);
    if (didShare) {
      return "shared" as const;
    }
    throw error;
  }
}
