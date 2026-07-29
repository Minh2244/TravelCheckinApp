import axios from "axios";

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:3000/api";

const axiosClient = axios.create({ baseURL });
let refreshPromise: Promise<string> | null = null;

const clearAuthAndRedirect = () => {
  [
    "accessToken",
    "refreshToken",
    "user",
    "userMapNearbyRadius",
    "userMapCustomRadiusInput",
    "userMapRoute",
  ].forEach((key) => sessionStorage.removeItem(key));
  if (window.location.pathname !== "/login") window.location.href = "/login";
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = sessionStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("Missing refresh token");
  const response = await axios.post(`${baseURL}/auth/refresh-token`, {
    refreshToken,
  });
  const token = String(response.data?.data?.accessToken || "");
  if (!token) throw new Error("Missing refreshed access token");
  sessionStorage.setItem("accessToken", token);
  return token;
};

axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status as number | undefined;
    const code = error.response?.data?.code as string | undefined;
    const msg = (error.response?.data?.message as string | undefined) || "";
    const url = String(error.config?.url || "");
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/social-login") ||
      url.includes("/auth/refresh-token");

    if (code === "SESSION_REVOKED") {
      window.dispatchEvent(
        new CustomEvent("tc-session-revoked", {
          detail: {
            message:
              msg || "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
          },
        }),
      );
      return Promise.reject(error);
    }

    if (status === 401 && !isAuthEndpoint && !error.config?._retry) {
      error.config._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        error.config.headers = error.config.headers ?? {};
        error.config.headers.Authorization = `Bearer ${token}`;
        return axiosClient.request(error.config);
      } catch (refreshError: any) {
        const refreshStatus = refreshError?.response?.status;
        const refreshCode = refreshError?.response?.data?.code;
        // Chỉ xóa session khi server rõ ràng từ chối refresh token (401, 403) hoặc code báo hiệu revoked
        if (
          refreshStatus === 401 ||
          refreshStatus === 403 ||
          refreshCode === "SESSION_REVOKED"
        ) {
          clearAuthAndRedirect();
        }
        return Promise.reject(error);
      }
    }

    const lockedOrUnapproved =
      status === 403 &&
      (code === "ACCOUNT_LOCKED" ||
        code === "OWNER_NOT_APPROVED" ||
        /owner\s*đang\s*chờ\s*admin\s*duyệt/i.test(msg) ||
        /tài\s*khoản\s*đã\s*bị\s*khóa/i.test(msg));

    if (lockedOrUnapproved && !isAuthEndpoint) clearAuthAndRedirect();
    return Promise.reject(error);
  },
);

export default axiosClient;
