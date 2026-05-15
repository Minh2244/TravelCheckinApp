import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, message, Steps } from "antd";
import {
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import authApi from "../../api/authApi";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md shadow-lg rounded-xl">
        <div className="text-center mb-6">
          <Title level={3} className="text-blue-600">
            Khôi phục mật khẩu
          </Title>
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
          >
            <Text type="secondary" className="block mb-4 text-center">
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
            >
              <Input prefix={<MailOutlined />} placeholder="Địa chỉ Email" />
            </Form.Item>

            <Form.Item
              name="phone"
              rules={[{ required: true, message: "Vui lòng nhập SĐT!" }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="Số điện thoại" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="bg-blue-600 font-bold h-10"
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
            <Text className="block mb-4 text-center">
              Mã OTP đã gửi tới:{" "}
              <strong className="text-blue-600">{formData.email}</strong>
            </Text>

            <Form.Item
              name="otp"
              rules={[{ required: true, len: 6, message: "OTP gồm 6 số" }]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder="Nhập mã OTP (6 số)"
                maxLength={6}
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
                className="bg-blue-600 font-bold h-10"
              >
                XÁC NHẬN OTP
              </Button>
            </Form.Item>
            <Button type="link" block onClick={() => setCurrentStep(0)}>
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
          >
            <Text className="block mb-4 text-center text-green-600 font-medium">
              Mã OTP hợp lệ. Vui lòng đặt mật khẩu mới.
            </Text>

            <Form.Item
              name="newPassword"
              rules={[
                { required: true, min: 6, message: "Mật khẩu > 6 ký tự" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Mật khẩu mới"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: "Vui lòng xác nhận lại" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập lại mật khẩu mới"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="bg-green-600 font-bold h-10"
              >
                HOÀN TẤT
              </Button>
            </Form.Item>
          </Form>
        )}

        <div className="text-center mt-4">
          <Link to="/login" className="text-gray-500 hover:text-blue-600">
            Quay lại Đăng nhập
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
