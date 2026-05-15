import { useEffect, useState } from "react";
import { Form, Input, Button, Card, Typography, message, Checkbox } from "antd";
import {
  UserOutlined,
  LockOutlined,
  GoogleOutlined,
  FacebookOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import authApi from "../../api/authApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

const { Title, Text } = Typography;

type ApiErrorLike = {
  response?: { data?: { message?: unknown } };
  message?: unknown;
};

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (typeof err === "object" && err !== null) {
    const maybe = err as ApiErrorLike;
    const msg = maybe.response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    if (typeof maybe.message === "string" && maybe.message.trim())
      return maybe.message;
  }
  return fallback;
};

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackground = async () => {
      try {
        const response = await authApi.getLoginBackground();
        if (response?.success && response.data?.image_url) {
          const raw = response.data.image_url as string;
          const resolved = resolveBackendUrl(raw) || raw;

          // Chỉ set background nếu preload OK để tránh "trắng tinh" khi ảnh lỗi.
          const img = new Image();
          img.onload = () => setBackgroundUrl(resolved);
          img.onerror = () => setBackgroundUrl(null);
          img.src = resolved;
        }
      } catch {
        // Không chặn UI nếu không lấy được ảnh nền
      }
    };

    fetchBackground();
  }, []);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const response = await authApi.login({
        email: values.email,
        password: values.password,
      });

      sessionStorage.setItem("accessToken", response.data.accessToken);
      sessionStorage.setItem("refreshToken", response.data.refreshToken);
      sessionStorage.setItem("user", JSON.stringify(response.data.user));

      console.log(
        "✅ Login success, redirecting to:",
        response.data.redirectUrl,
      );

      message.success(response.message);
      if (response.warning) message.warning(response.warning, 5);

      navigate(response.data.redirectUrl, { replace: true });
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      console.error("❌ Login error:", err);
      message.error(
        e.response?.data?.message || e.message || "Đăng nhập thất bại!",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      message.error("Chưa cấu hình Google Client ID");
      setGoogleLoading(false);
      return;
    }

    const redirectUri = "http://localhost:5173/auth/google/callback";
    const scope = encodeURIComponent("openid email profile");
    const state = Math.random().toString(36).slice(2);

    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${scope}` +
      `&prompt=select_account` +
      `&state=${state}`;

    console.log("🚀 Google OAuth URL:", googleAuthUrl);

    const width = 500;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      googleAuthUrl,
      "Google Login",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      message.error("Popup bị chặn! Cho phép popup rồi thử lại.");
      setGoogleLoading(false);
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        const profile = event.data.profile;

        console.log("✅ Received Google profile:", profile);

        if (!profile.sub || !profile.email || !profile.name) {
          console.error("❌ Profile thiếu dữ liệu:", profile);
          message.error("Không nhận được đầy đủ thông tin từ Google");
          setGoogleLoading(false);
          return;
        }

        try {
          const loginData = {
            provider: "google" as const,
            socialId: profile.sub,
            email: profile.email,
            fullName: profile.name,
            avatarUrl: profile.picture || null,
          };

          console.log("📤 Sending to backend:", loginData);

          const response = await authApi.socialLogin(loginData);

          console.log("✅ Backend response:", response);

          sessionStorage.setItem("accessToken", response.data.accessToken);
          sessionStorage.setItem("refreshToken", response.data.refreshToken);
          sessionStorage.setItem("user", JSON.stringify(response.data.user));

          console.log("💾 Verify sessionStorage:", {
            token: sessionStorage.getItem("accessToken") ? "✅" : "❌",
            user: sessionStorage.getItem("user") ? "✅" : "❌",
            userRole: JSON.parse(sessionStorage.getItem("user") || "{}").role,
          });

          message.success("Đăng nhập Google thành công! 🎉", 2);

          setTimeout(() => {
            console.log("🚀 Redirecting to:", response.data.redirectUrl);
            navigate(response.data.redirectUrl, { replace: true });
          }, 800);
        } catch (err: unknown) {
          console.error("❌ Backend error:", err);
          message.error(
            getApiErrorMessage(err, "Đăng nhập Google thất bại!"),
            5,
          );
        } finally {
          setGoogleLoading(false);
        }
      } else if (event.data?.type === "GOOGLE_AUTH_ERROR") {
        message.error(event.data.error || "Đăng nhập thất bại!");
        setGoogleLoading(false);
      }

      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);

    // ⭐ FIX: Tắt kiểm tra popup.closed để tránh Cross-Origin warning
    // Thay vào đó, dùng timeout tự động tắt loading sau 60 giây
    const timeout = setTimeout(() => {
      setGoogleLoading(false);
      window.removeEventListener("message", handleMessage);
    }, 60000); // 60 giây

    // Cleanup khi nhận được message
    const originalRemoveListener = window.removeEventListener.bind(window);
    window.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      clearTimeout(timeout);
      return originalRemoveListener(type, listener);
    };
  };

  const handleFacebookLogin = () => {
    setFacebookLoading(true);

    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId) {
      message.error("Chưa cấu hình Facebook App ID");
      setFacebookLoading(false);
      return;
    }

    const redirectUri = "http://localhost:5173/auth/facebook/callback";

    const facebookAuthUrl =
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=email,public_profile` +
      `&auth_type=rerequest` +
      `&response_type=token`;

    const width = 500;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      facebookAuthUrl,
      "Facebook Login",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      message.error("Popup bị chặn! Cho phép popup rồi thử lại.");
      setFacebookLoading(false);
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "FACEBOOK_AUTH_SUCCESS") {
        const { email, name, picture, id } = event.data.profile;

        try {
          const response = await authApi.socialLogin({
            provider: "facebook" as const,
            socialId: id,
            email: email || `facebook_${id}@temp.local`,
            fullName: name,
            avatarUrl: picture?.data?.url,
          });

          sessionStorage.setItem("accessToken", response.data.accessToken);
          sessionStorage.setItem("refreshToken", response.data.refreshToken);
          sessionStorage.setItem("user", JSON.stringify(response.data.user));

          message.success("Đăng nhập Facebook thành công! 🎉");

          setTimeout(() => {
            navigate(response.data.redirectUrl, { replace: true });
          }, 500);
        } catch (err: unknown) {
          message.error(
            getApiErrorMessage(err, "Đăng nhập Facebook thất bại!"),
          );
        } finally {
          setFacebookLoading(false);
        }
      } else if (event.data?.type === "FACEBOOK_AUTH_ERROR") {
        message.error(event.data.error || "Đăng nhập thất bại!");
        setFacebookLoading(false);
      }

      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);

    const timeout = setTimeout(() => {
      setFacebookLoading(false);
      window.removeEventListener("message", handleMessage);
    }, 60000);

    const originalRemoveListener = window.removeEventListener.bind(window);
    window.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      clearTimeout(timeout);
      return originalRemoveListener(type, listener);
    };
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center py-12 px-4"
      style={
        backgroundUrl
          ? {
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!backgroundUrl ? (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
      ) : null}
      <Card className="relative z-10 w-full max-w-md shadow-2xl rounded-2xl border-0">
        <div className="text-center mb-6">
          <Title
            level={2}
            className="text-blue-600 font-extrabold"
            style={{ marginBottom: 0 }}
          >
            Đăng Nhập
          </Title>
          <Text type="secondary" className="text-gray-400">
            Chào mừng bạn trở lại!
          </Text>
        </div>

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Vui lòng nhập Email!" },
              { type: "email", message: "Email không đúng định dạng!" },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="Email"
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập Mật khẩu!" }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="Mật khẩu"
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item>
            <div className="flex justify-between items-center">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>Ghi nhớ đăng nhập</Checkbox>
              </Form.Item>
              <Link to="/forgot-password" className="text-blue-500">
                Quên mật khẩu?
              </Link>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="rounded-lg h-12 text-lg"
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div className="flex items-center my-4">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-gray-400 px-4">Hoặc đăng nhập với</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            icon={<GoogleOutlined />}
            onClick={handleGoogleLogin}
            loading={googleLoading}
            block
            className="rounded-lg h-12"
          >
            Đăng nhập với Google
          </Button>

          <Button
            icon={<FacebookOutlined />}
            onClick={handleFacebookLogin}
            loading={facebookLoading}
            block
            className="rounded-lg h-12"
          >
            Đăng nhập với Facebook
          </Button>
        </div>

        <div className="text-center mt-6">
          <Text className="text-gray-500">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-blue-500 font-semibold">
              Đăng ký ngay
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
