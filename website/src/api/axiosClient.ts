// website/src/api/axiosClient.ts
import axios from "axios";

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:3000/api";

const axiosClient = axios.create({
  baseURL,
});

// Interceptor để tự động gắn token vào header
axiosClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");
    if (token) {
      // Axios types allow headers to be undefined
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization =
        `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Interceptor để xử lý lỗi response
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status as number | undefined;
    const code = error.response?.data?.code as string | undefined;
    const msg = (error.response?.data?.message as string | undefined) || "";

    if (code === "SESSION_REVOKED") {
      window.dispatchEvent(
        new CustomEvent("tc-session-revoked", {
          detail: {
            message: msg || "Tài khoản đang được đăng nhập tại nơi khác",
          },
        }),
      );
      return Promise.reject(error);
    }

    const shouldForceLogout =
      status === 401 ||
      (status === 403 &&
        (code === "ACCOUNT_LOCKED" ||
          code === "OWNER_NOT_APPROVED" ||
          /owner\s*đang\s*chờ\s*admin\s*duyệt/i.test(msg) ||
          /tài\s*khoản\s*đã\s*bị\s*khóa/i.test(msg)));

    if (shouldForceLogout) {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
