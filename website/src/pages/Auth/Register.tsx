import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, message, Steps } from "antd";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-400 py-12 px-4">
      <Card className="w-full max-w-lg shadow-2xl rounded-2xl border-0">
        <div className="text-center mb-6">
          <div className="mb-2 text-4xl">✈️</div>
          <Title
            level={2}
            className="text-blue-600 font-extrabold"
            style={{ marginBottom: 0 }}
          >
            Đăng Ký Tài Khoản
          </Title>
          <Text type="secondary" className="text-gray-400">
            Tham gia cùng chúng tôi ngay hôm nay
          </Text>
        </div>

        <Steps current={currentStep} items={stepsItems} className="mb-8 px-4" />

        {/* FORM NHẬP THÔNG TIN (BƯỚC 1) */}
        {currentStep === 0 && (
          <Form<RegisterInfoValues>
            layout="vertical"
            onFinish={onFinishInfo}
            size="large"
          >
            <Form.Item
              name="fullName"
              rules={[{ required: true, message: "Vui lòng nhập họ tên!" }]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="Họ và tên"
                className="rounded-lg"
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
            >
              <Input
                prefix={<PhoneOutlined className="text-gray-400" />}
                placeholder="Số điện thoại"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập Email!" },
                { type: "email", message: "Email không đúng định dạng!" },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-gray-400" />}
                placeholder="Email"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu!" },
                { min: 6, message: "Mật khẩu phải lớn hơn 6 ký tự!" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Mật khẩu"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="bg-blue-600 hover:bg-blue-700 border-none font-bold h-12 rounded-lg text-lg shadow-md transition-transform active:scale-95"
              >
                TIẾP TỤC
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* FORM NHẬP OTP (BƯỚC 2) */}
        {currentStep === 1 && (
          <div className="text-center animate-fade-in">
            <Text className="block mb-6 text-gray-500">
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
                  className="rounded-lg text-center font-bold text-2xl tracking-[8px] h-14"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="bg-green-600 hover:bg-green-700 border-none font-bold h-12 rounded-lg text-lg shadow-md transition-transform active:scale-95"
                >
                  KÍCH HOẠT TÀI KHOẢN
                </Button>
              </Form.Item>

              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => setCurrentStep(0)}
                className="text-gray-500 hover:text-blue-600"
              >
                Quay lại bước trước
              </Button>
            </Form>
          </div>
        )}

        <div className="text-center mt-6">
          <Text className="text-gray-500">
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-bold hover:underline ml-1"
            >
              Đăng nhập ngay
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;
