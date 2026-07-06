import { useState } from "react";
import { Form, Input, Button, Typography, message, Checkbox } from "antd";
import {
  UserOutlined,
  LockOutlined,
  GoogleOutlined,
  FacebookOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import authApi from "../../api/authApi";
import { WavyDivider } from "../../components/WavyDivider";

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

    let checkClosedInterval: any;
    let timeout: any;

    const cleanUp = () => {
      if (checkClosedInterval) clearInterval(checkClosedInterval);
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        cleanUp();
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
        cleanUp();
        message.error(event.data.error || "Đăng nhập thất bại!");
        setGoogleLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);

    checkClosedInterval = setInterval(() => {
      try {
        if (popup && popup.closed) {
          cleanUp();
          setGoogleLoading(false);
        }
      } catch (err) {
        // Cross-Origin-Opener-Policy could block access to popup.closed
      }
    }, 500);

    timeout = setTimeout(() => {
      cleanUp();
      setGoogleLoading(false);
    }, 60000);
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

    let checkClosedInterval: any;
    let timeout: any;

    const cleanUp = () => {
      if (checkClosedInterval) clearInterval(checkClosedInterval);
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "FACEBOOK_AUTH_SUCCESS") {
        cleanUp();
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
        cleanUp();
        message.error(event.data.error || "Đăng nhập thất bại!");
        setFacebookLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);

    checkClosedInterval = setInterval(() => {
      try {
        if (popup && popup.closed) {
          cleanUp();
          setFacebookLoading(false);
        }
      } catch (err) {
        // Cross-Origin-Opener-Policy could block access to popup.closed
      }
    }, 500);

    timeout = setTimeout(() => {
      cleanUp();
      setFacebookLoading(false);
    }, 60000);
  };

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden">
      {/* Left Pane (Image/Brand) */}
      <div className="relative hidden md:flex md:w-5/12 lg:w-[45%] bg-gradient-to-br from-blue-600 to-cyan-500 flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />

        {/* Brand Content */}
        <div className="relative z-10 flex flex-col items-center p-8 text-center mt-[-10%]">
          <div className="w-48 h-48 mb-6 rounded-full bg-white/10 backdrop-blur-md shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden flex items-center justify-center">
            <img src="/logo-transparent.png" alt="Logo" className="w-full h-full object-cover scale-[1.05] translate-x-2" />
          </div>
          <Title level={1} className="!text-white !mb-2 drop-shadow-md uppercase tracking-wider font-extrabold text-3xl">Dấu Ấn Hành Trình</Title>
          <Text className="text-blue-50 text-xl opacity-95 max-w-md drop-shadow-md italic font-semibold text-center">
            Hành trình hôm nay - Kỷ niệm mai sau.
          </Text>
        </div>

        {/* Wavy Divider */}
        <WavyDivider position="left" className="!text-white z-20 left-full" />
      </div>

      {/* Right Pane (Form) */}
      <div className="relative flex-1 flex flex-col justify-center items-center p-6 sm:p-12 z-30 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo Header */}
          <div className="md:hidden flex flex-col items-center mb-8">
            <div className="w-24 h-24 mb-4 rounded-full bg-blue-50 shadow-sm overflow-hidden flex items-center justify-center">
              <img src="/logo-transparent.png" alt="Logo" className="w-full h-full object-cover scale-[1.05] translate-x-1" />
            </div>
            <Title level={2} className="!text-blue-600 !m-0 font-extrabold tracking-wide uppercase text-xl">Dấu Ấn Hành Trình</Title>
          </div>

          <div className="mb-10">
            <Title level={2} className="!text-slate-800 !font-extrabold !mb-1">
              Đăng Nhập
            </Title>
            <Text className="text-slate-500 text-base">
              Chào mừng bạn trở lại! Vui lòng nhập thông tin.
            </Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} size="large" className="space-y-4">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập Email!" },
                { type: "email", message: "Email không đúng định dạng!" },
              ]}
              className="mb-4"
            >
              <Input
                prefix={<UserOutlined className="text-slate-400 mr-2" />}
                placeholder="Nhập email của bạn"
                className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "Vui lòng nhập Mật khẩu!" }]}
              className="mb-2"
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                placeholder="Nhập mật khẩu"
                className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item className="mb-6">
              <div className="flex justify-between items-center">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox className="text-slate-600">Ghi nhớ đăng nhập</Checkbox>
                </Form.Item>
                <Link to="/forgot-password" className="text-blue-600 font-medium hover:text-blue-700">
                  Quên mật khẩu?
                </Link>
              </div>
            </Form.Item>

            <Form.Item className="mb-6">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="rounded-xl h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
              >
                Đăng Nhập
              </Button>
            </Form.Item>
          </Form>

          <div className="flex items-center my-6">
            <div className="flex-1 h-[1px] bg-slate-200"></div>
            <span className="text-slate-400 px-4 text-sm font-medium">HOẶC TIẾP TỤC VỚI</span>
            <div className="flex-1 h-[1px] bg-slate-200"></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Button
              icon={<GoogleOutlined />}
              onClick={handleGoogleLogin}
              loading={googleLoading}
              block
              className="rounded-xl h-12 font-bold border-red-500 bg-red-500 hover:!bg-red-600 text-white hover:!text-white hover:!border-red-600 shadow-sm"
            >
              Google
            </Button>

            <Button
              icon={<FacebookOutlined />}
              onClick={handleFacebookLogin}
              loading={facebookLoading}
              block
              className="rounded-xl h-12 font-bold border-[#1877F2] bg-[#1877F2] hover:!bg-[#166FE5] text-white hover:!text-white hover:!border-[#166FE5] shadow-sm"
            >
              Facebook
            </Button>
          </div>

          <div className="text-center">
            <Text className="text-slate-500">
              Chưa có tài khoản?{" "}
              <Link to="/register" className="text-blue-600 font-bold hover:text-blue-700 hover:underline">
                Đăng ký ngay
              </Link>
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
