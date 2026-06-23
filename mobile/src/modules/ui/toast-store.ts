import { create } from "zustand";

type ToastState = {
  message: string | null;
  visible: boolean;
  show: (message: string, durationMs?: number) => void;
  hide: () => void;
};

let activeTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  visible: false,
  show: (message, durationMs = 2200) => {
    if (activeTimer) {
      clearTimeout(activeTimer);
    }

    set({
      message,
      visible: true,
    });

    activeTimer = setTimeout(() => {
      set({
        visible: false,
        message: null,
      });
      activeTimer = null;
    }, durationMs);
  },
  hide: () => {
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }

    set({
      visible: false,
      message: null,
    });
  },
}));

export function showToast(message: string, durationMs?: number) {
  useToastStore.getState().show(message, durationMs);
}

export function hideToast() {
  useToastStore.getState().hide();
}
