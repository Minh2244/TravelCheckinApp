import * as SecureStore from "expo-secure-store";

import type { AuthUser } from "../modules/auth/types";

const STORAGE_KEYS = {
  accessToken: "travel_checkin_access_token",
  refreshToken: "travel_checkin_refresh_token",
  user: "travel_checkin_user",
} as const;

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export async function persistSession(session: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.accessToken, session.accessToken),
    SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, session.refreshToken),
    SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(session.user)),
  ]);
}

export async function persistAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, accessToken);
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.getItemAsync(STORAGE_KEYS.user),
  ]);

  if (!accessToken || !refreshToken || !userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson) as AuthUser;
    return { accessToken, refreshToken, user };
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.user),
  ]);
}
