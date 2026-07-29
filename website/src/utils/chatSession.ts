/**
 * Chat session baseline cleanup utilities.
 *
 * Khi đăng xuất, xóa mốc baseline để lần đăng nhập sau component chat
 * đặt mốc mới và không hiển thị lại lịch sử cũ.
 */

export const clearUserChatBaselines = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith("chat_baseline_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
};

export const clearOwnerChatBaselines = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith("owner_chat_baseline_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
};

export const clearAiChatBaseline = (): void => {
  sessionStorage.removeItem("ai_chat_baseline");
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith("ai_chat_baseline_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
};

export const clearAllChatBaselines = (): void => {
  clearUserChatBaselines();
  clearOwnerChatBaselines();
  clearAiChatBaseline();
};
