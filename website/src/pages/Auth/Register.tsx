import React, { useState } from "react";
import { Form, Input, Button, Typography, message, Steps } from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  SafetyOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import authApi from "../../api/authApi";
import { WavyDivider } from "../../components/WavyDivider";

const { Title, Text } = Typography;

type RegisterInfoValues = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
};

type OtpValues = {
  otp: string;
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

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const stepsItems = [
    {
      title: "Thông tin",
      icon: <UserOutlined />,
    },
    {
      title: "Xác thực OTP",
      icon: <SafetyOutlined />,
    },
  ];

  // BƯỚC 1: GỬI THÔNG TIN ĐĂNG KÝ
  const onFinishInfo = async (values: RegisterInfoValues) => {
    setLoading(true);
    try {
      await authApi.register({
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone,
      });

      message.success(
        "Đăng ký thành công! Vui lòng kiểm tra Email để lấy OTP.",
      );
      setRegisteredEmail(values.email);
      setCurrentStep(1);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Đăng ký thất bại!"));
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: XÁC THỰC OTP
  const onFinishOTP = async (values: OtpValues) => {
    setLoading(true);
    try {
      await authApi.verifyOTP({
        email: registeredEmail,
        otp: values.otp,
      });

      message.success("Kích hoạt tài khoản thành công! Hãy đăng nhập ngay.");
      navigate("/login");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Mã OTP không đúng!"));
    } finally {
      setLoading(false);
    }
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

          <div className="mb-8">
            <Title level={2} className="!text-slate-800 !font-extrabold !mb-1">
              Đăng Ký
            </Title>
            <Text className="text-slate-500 text-base">
              Tham gia cùng chúng tôi ngay hôm nay!
            </Text>
          </div>

          <Steps current={currentStep} items={stepsItems} className="mb-8" />

          {/* FORM NHẬP THÔNG TIN (BƯỚC 1) */}
          {currentStep === 0 && (
            <Form<RegisterInfoValues>
              layout="vertical"
              onFinish={onFinishInfo}
              size="large"
              className="space-y-3"
            >
              <Form.Item
                name="fullName"
                rules={[{ required: true, message: "Vui lòng nhập họ tên!" }]}
                className="mb-4"
              >
                <Input
                  prefix={<UserOutlined className="text-slate-400 mr-2" />}
                  placeholder="Họ và tên"
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item
                name="phone"
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại!" },
                  {
                    pattern: /^[0-9]{10}$/,
                    message: "Số điện thoại không hợp lệ (10 số)!",
                  },
                ]}
                className="mb-4"
              >
                <Input
                  prefix={<PhoneOutlined className="text-slate-400 mr-2" />}
                  placeholder="Số điện thoại"
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: "Vui lòng nhập Email!" },
                  { type: "email", message: "Email không đúng định dạng!" },
                ]}
                className="mb-4"
              >
                <Input
                  prefix={<MailOutlined className="text-slate-400 mr-2" />}
                  placeholder="Email"
                  className="rounded-xl h-12 border-slate-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu!" },
                  { min: 6, message: "Mật khẩu phải lớn hơn 6 ký tự!" },
                ]}
                className="mb-6"
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400 mr-2" />}
                  placeholder="Mật khẩu"
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

          {/* FORM NHẬP OTP (BƯỚC 2) */}
          {currentStep === 1 && (
            <div className="text-center animate-fade-in">
              <Text className="block mb-6 text-slate-500">
                Mã xác thực (OTP) đã được gửi tới email:
                <br />
                <strong className="text-blue-600 text-lg">
                  {registeredEmail}
                </strong>
              </Text>

              <Form layout="vertical" onFinish={onFinishOTP} size="large">
                <Form.Item
                  name="otp"
                  rules={[
                    { required: true, message: "Vui lòng nhập mã OTP!" },
                    { len: 6, message: "Mã OTP gồm 6 chữ số" },
                  ]}
                >
                  <Input
                    prefix={<SafetyOutlined className="text-green-600" />}
                    placeholder="******"
                    maxLength={6}
                    className="rounded-xl text-center font-bold text-2xl tracking-[8px] h-14 border-slate-200"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}
                    className="bg-green-600 hover:bg-green-700 border-none font-bold h-12 rounded-xl text-lg shadow-md transition-all mb-4"
                  >
                    KÍCH HOẠT TÀI KHOẢN
                  </Button>
                </Form.Item>

                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setCurrentStep(0)}
                  className="text-slate-500 hover:text-blue-600"
                >
                  Quay lại bước trước
                </Button>
              </Form>
            </div>
          )}

          <div className="text-center mt-8">
            <Text className="text-slate-500">
              Đã có tài khoản?{" "}
              <Link
                to="/login"
                className="text-blue-600 font-bold hover:text-blue-700 hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
