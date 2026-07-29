import { confirm } from "./confirm-store";
import { showToast } from "./toast-store";

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], _options?: unknown) {
    const visibleMessage = message ? `${title}: ${message}` : title;

    if (!buttons || buttons.length <= 1) {
      showToast(visibleMessage);
      const action = buttons?.[0]?.onPress;
      if (action) {
        setTimeout(action, 0);
      }
      return;
    }

    const cancelButton = buttons.find((button) => button.style === "cancel");
    const actionButton =
      buttons.find((button) => button.style === "destructive") ||
      buttons.find((button) => button.style !== "cancel") ||
      buttons[0];

    void confirm({
      title,
      message,
      cancelText: cancelButton?.text || "Hủy",
      confirmText: actionButton?.text || "Xác nhận",
      destructive: actionButton?.style === "destructive",
    }).then((accepted) => {
      if (accepted) {
        actionButton?.onPress?.();
      } else {
        cancelButton?.onPress?.();
      }
    });
  },
};
