import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { env } from "../../lib/env";
import type { SocialSession } from "./types";

WebBrowser.maybeCompleteAuthSession();

function readQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseGoogleAuthResultUrl(url: string): SocialSession {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const errorMessage = readQueryValue(params.error);

  if (errorMessage) {
    throw new Error(safeDecode(errorMessage));
  }

  const accessToken = readQueryValue(params.accessToken);
  const refreshToken = readQueryValue(params.refreshToken);
  const rawUser = readQueryValue(params.user);

  if (!accessToken || !refreshToken || !rawUser) {
    throw new Error("Google đã trả về thiếu dữ liệu đăng nhập.");
  }

  const decodedUser = JSON.parse(safeDecode(rawUser)) as SocialSession["user"];

  return {
    accessToken,
    refreshToken,
    user: decodedUser,
  };
}

export async function beginGoogleSignIn(): Promise<SocialSession> {
  if (!env.googleClientId) {
    throw new Error("Thiếu cấu hình Google Client ID cho ứng dụng mobile.");
  }

  const redirectUri = makeRedirectUri({
    scheme: "travelcheckin",
    path: "auth/callback",
  });

  const authUrl = `${env.apiBaseUrl}/auth/google/mobile?returnTo=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Bạn đã đóng phiên đăng nhập Google.");
  }

  if (result.type !== "success") {
    throw new Error("Không thể hoàn tất đăng nhập Google.");
  }

  return parseGoogleAuthResultUrl(result.url);
}
