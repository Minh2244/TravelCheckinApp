import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Input,
  Space,
  message,
} from "antd";
import {
  SaveOutlined,
  PercentageOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";

type SystemSettings = Record<string, string | null | undefined>;

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSystemSettings();
      if (response.success) {
        setSettings(response.data || {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await adminApi.updateSystemSettings(settings);
      if (response.success) {
        message.success("Cập nhật cài đặt thành công");
        window.dispatchEvent(new CustomEvent("tc-settings-updated"));
      }
    } catch {
      message.error("Lỗi cập nhật cài đặt");
    }
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cài đặt Hệ thống</h2>
        <p className="text-gray-500">
          Cấu hình tỷ lệ hoa hồng mặc định của hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cột trái: Cấu hình Hoa hồng */}
        <div className="lg:col-span-1">
          <Card
            title={
              <Space>
                <PercentageOutlined style={{ color: "#6366f1" }} />
                <span>Cấu hình hoa hồng</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              border: "1px solid #f1f5f9",
            }}
          >
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">
                % hoa hồng mặc định
              </label>
              <Input
                type="number"
                prefix={<PercentageOutlined style={{ color: "#94a3b8" }} />}
                value={settings.default_commission_rate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_commission_rate: e.target.value,
                  })
                }
                placeholder="2.5"
                size="large"
                style={{ borderRadius: 8 }}
              />
              <div className="mt-2 text-xs text-gray-400 flex items-start gap-1">
                <InfoCircleOutlined style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Áp dụng tự động cho các địa điểm đăng ký mới trước khi được Admin duyệt tỷ lệ riêng.
                </span>
              </div>
            </div>

            <Divider className="my-4" />

            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSettings}
              loading={loading}
              size="large"
              block
              style={{
                borderRadius: 8,
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                border: "none",
                boxShadow: "0 4px 10px rgba(99,102,241,0.2)",
              }}
            >
              Lưu Cài đặt
            </Button>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
