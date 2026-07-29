import { create } from "zustand";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  id: number;
  resolve: (value: boolean) => void;
};

type ConfirmState = {
  current: PendingConfirm | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  close: (accepted: boolean) => void;
};

let nextConfirmId = 1;

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      const current = get().current;
      if (current) {
        current.resolve(false);
      }

      set({
        current: {
          ...options,
          id: nextConfirmId++,
          resolve,
        },
      });
    }),
  close: (accepted) => {
    const current = get().current;
    if (!current) return;

    current.resolve(accepted);
    set({ current: null });
  },
}));

export function confirm(options: ConfirmOptions) {
  return useConfirmStore.getState().open(options);
}
