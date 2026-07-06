import React, { useState } from "react";
import { Form, Input, Button, Typography, message, Steps } from "antd";
import {
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import authApi from "../../api/authApi";
import { WavyDivider } from "../../components/WavyDivider";

const { Title, Text } = Typography;

type ForgotInfoValues = {
  email: string;
  phone: string;
};

type OtpValues = {
  otp: string;
};

type ResetValues = {
  newPassword: string;
  confirmPassword: string;
};

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

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", otp: "" });

  // BƯỚC 1: Gửi yêu cầu lấy mã OTP
  const onFinishInfo = async (values: ForgotInfoValues) => {
    setLoading(true);
    try {
      await authApi.forgotPassword({
        email: values.email,
        phone: values.phone,
      });

      message.success("Mã OTP đã được gửi tới email của bạn!");
      setFormData({ ...formData, email: values.email });
      setCurrentStep(1);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Thông tin không đúng!"));
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: Nhập OTP
  const onFinishOTP = async (values: OtpValues) => {
    setLoading(true);
    try {
      await authApi.verifyResetOTP({
        email: formData.email,
        otp: values.otp,
      });

      setFormData({ ...formData, otp: values.otp });
      message.success("Mã OTP chính xác!");
      setCurrentStep(2);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Mã OTP không đúng!"));
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 3: Đổi mật khẩu
  const onFinishReset = async (values: ResetValues) => {
    setLoading(true);
    try {
      if (values.newPassword !== values.confirmPassword) {
        message.error("Mật khẩu xác nhận không khớp!");
        setLoading(false);
        return;
      }

      await authApi.resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: values.newPassword,
      });

      message.success("Đổi mật khẩu thành công! Hãy đăng nhập lại.");
      navigate("/login");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Mã OTP sai hoặc hết hạn!"));
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };

  const stepsItems = [
    { title: "Xác minh", icon: <MailOutlined /> },
    { title: "Nhập OTP", icon: <SafetyOutlined /> },
    { title: "Đổi mật khẩu", icon: <LockOutlined /> },
  ];

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden">
      {/* Left Pane (Image/Brand) */}
      <div className="relative hidden md:flex md:w-5/12 lg:w-[45%] bg-gradient-to-br from-blue-600 to-purple-600 flex-col justify-center items-center overflow-hidden">
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

          <div className="mb-8">
            <Title level={2} className="!text-slate-800 !font-extrabold !mb-1">
              Khôi Phục Mật Khẩu
            </Title>
            <Text className="text-slate-500 text-base">
              Vui lòng thực hiện các bước dưới đây
            </Text>
          </div>

          <Steps
            current={currentStep}
            className="mb-8"
            items={stepsItems}
            size="small"
          />

          {/* STEP 1: NHẬP EMAIL & SĐT */}
          {currentStep === 0 && (
            <Form<ForgotInfoValues>
              layout="vertical"
              onFinish={onFinishInfo}
              size="large"
              className="space-y-4"
            >
              <Text type="secondary" className="block mb-4 text-center text-slate-500">
                Vui lòng nhập Email và Số điện thoại đã đăng ký.
              </Text>

              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: "Email không hợp lệ!",
                  },
                ]}
                className="mb-4"
              >
                <Input 
                  prefix={<MailOutlined className="text-slate-400 mr-2" />} 
                  placeholder="Địa chỉ Email" 
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item
                name="phone"
                rules={[{ required: true, message: "Vui lòng nhập SĐT!" }]}
                className="mb-6"
              >
                <Input 
                  prefix={<PhoneOutlined className="text-slate-400 mr-2" />} 
                  placeholder="Số điện thoại" 
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="rounded-xl h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                >
                  TIẾP TỤC
                </Button>
              </Form.Item>
            </Form>
          )}

          {/* STEP 2: NHẬP MÃ OTP */}
          {currentStep === 1 && (
            <Form<OtpValues>
              layout="vertical"
              onFinish={onFinishOTP}
              size="large"
            >
              <Text className="block mb-6 text-center text-slate-500">
                Mã OTP đã gửi tới:{" "}
                <strong className="text-blue-600">{formData.email}</strong>
              </Text>

              <Form.Item
                name="otp"
                rules={[{ required: true, len: 6, message: "OTP gồm 6 số" }]}
              >
                <Input
                  prefix={<SafetyOutlined className="text-green-600" />}
                  placeholder="Nhập mã OTP (6 số)"
                  maxLength={6}
                  className="rounded-xl h-14 border-slate-200"
                  style={{
                    textAlign: "center",
                    letterSpacing: "4px",
                    fontWeight: "bold",
                    fontSize: "18px",
                  }}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="bg-green-600 hover:bg-green-700 border-none font-bold h-12 rounded-xl text-lg shadow-md transition-all mt-2"
                >
                  XÁC NHẬN OTP
                </Button>
              </Form.Item>
              <Button type="link" block onClick={() => setCurrentStep(0)} className="text-slate-500 hover:text-blue-600">
                Gửi lại mã?
              </Button>
            </Form>
          )}

          {/* STEP 3: ĐẶT MẬT KHẨU MỚI */}
          {currentStep === 2 && (
            <Form<ResetValues>
              layout="vertical"
              onFinish={onFinishReset}
              size="large"
              className="space-y-4"
            >
              <Text className="block mb-4 text-center text-green-600 font-medium">
                Mã OTP hợp lệ. Vui lòng đặt mật khẩu mới.
              </Text>

              <Form.Item
                name="newPassword"
                rules={[
                  { required: true, min: 6, message: "Mật khẩu > 6 ký tự" },
                ]}
                className="mb-4"
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400 mr-2" />}
                  placeholder="Mật khẩu mới"
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                rules={[{ required: true, message: "Vui lòng xác nhận lại" }]}
                className="mb-6"
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400 mr-2" />}
                  placeholder="Nhập lại mật khẩu mới"
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="bg-green-600 hover:bg-green-700 border-none font-bold h-12 rounded-xl text-lg shadow-md transition-all"
                >
                  HOÀN TẤT
                </Button>
              </Form.Item>
            </Form>
          )}

          <div className="text-center mt-8">
            <Link to="/login" className="text-slate-500 font-medium hover:text-blue-600 hover:underline">
              Quay lại Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
