import { create } from "zustand";

import { configureApiAuthBridge } from "../../lib/api";
import {
  clearStoredSession,
} from "../../lib/storage";
import { authApi } from "./auth.api";
import type { AuthUser, SocialSession } from "./types";

type AuthStatus = "guest" | "authenticated";

type AuthState = {
  hydrated: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  notice: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ warning?: string }>;
  finishGoogleSignIn: (session: SocialSession) => Promise<void>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
  setNotice: (message: string | null) => void;
};

async function applySession({
  accessToken,
  refreshToken,
  user,
}: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  if (user.role !== "user") {
    await clearStoredSession();
    throw new Error("Ứng dụng mobile hiện chỉ mở cho tài khoản người dùng.");
  }

  useAuthStore.setState({
    status: "authenticated",
    user,
    accessToken,
    refreshToken,
    notice: null,
  });
}

async function clearSession(reason?: string) {
  await clearStoredSession();
  useAuthStore.setState({
    status: "guest",
    user: null,
    accessToken: null,
    refreshToken: null,
    hydrated: true,
    notice: reason ?? "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.",
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  status: "guest",
  user: null,
  accessToken: null,
  refreshToken: null,
  notice: null,
  bootstrap: async () => {
    await clearStoredSession();
    set({
      hydrated: true,
      status: "guest",
      user: null,
      accessToken: null,
      refreshToken: null,
      notice: null,
    });
  },
  signIn: async (email, password) => {
    const response = await authApi.login({
      email: email.trim(),
      password,
    });

    await applySession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: response.data.user,
    });

    return {
      warning: response.warning,
    };
  },
  finishGoogleSignIn: async (session) => {
    await applySession(session);
  },
  signOut: async () => {
    try {
      if (get().accessToken) {
        await authApi.logout();
      }
    } catch {
      // Ignore server logout failure and continue clearing local session.
    } finally {
      await clearStoredSession();
      set({
        status: "guest",
        user: null,
        accessToken: null,
        refreshToken: null,
        notice: null,
      });
    }
  },
  clearNotice: () => set({ notice: null }),
  setNotice: (message) => set({ notice: message }),
}));

configureApiAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onAccessTokenRefreshed: async (accessToken: string) => {
    const state = useAuthStore.getState();

    if (!state.refreshToken || !state.user) {
      await clearSession();
      return;
    }

    useAuthStore.setState({
      accessToken,
      status: "authenticated",
    });
  },
  onSessionExpired: async (reason?: string) => {
    await clearSession(reason);
  },
});
