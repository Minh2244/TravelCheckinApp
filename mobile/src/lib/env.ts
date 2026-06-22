function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  }

  return value;
}

const apiBaseUrl = readRequiredEnv("EXPO_PUBLIC_API_URL").replace(/\/+$/, "");

export const env = {
  apiBaseUrl,
  apiOrigin: new URL(apiBaseUrl).origin,
  googleClientId: readRequiredEnv("EXPO_PUBLIC_GOOGLE_CLIENT_ID"),
  facebookAppId: readRequiredEnv("EXPO_PUBLIC_FACEBOOK_APP_ID"),
};
