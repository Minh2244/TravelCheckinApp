import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Input,
  Space,
  message,
  Tabs,
} from "antd";
import {
  SaveOutlined,
  PercentageOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  HistoryOutlined,
  PhoneOutlined,
  MailOutlined,
  CustomerServiceOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import AnalyticsTab from "../../components/admin/AnalyticsTab";
import SystemLogs from "../../components/admin/SystemLogs";
import AppThemeSettings from "../../components/admin/AppThemeSettings";

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

  const items = [
    {
      key: "settings",
      label: (
        <span className="font-bold text-lg px-2 py-1 flex items-center gap-2">
          <SettingOutlined /> Cài đặt chung
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
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

            <Card
              title={
                <Space>
                  <CustomerServiceOutlined style={{ color: "#10b981" }} />
                  <span>Thông tin Liên hệ & Hỗ trợ</span>
                </Space>
              }
              bordered={false}
              style={{
                marginTop: 24,
                borderRadius: 16,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
                border: "1px solid #f1f5f9",
              }}
            >
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Số điện thoại Hotline
                  </label>
                  <Input
                    prefix={<PhoneOutlined style={{ color: "#94a3b8" }} />}
                    value={settings.support_hotline || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        support_hotline: e.target.value,
                      })
                    }
                    placeholder="VD: 1900 1234"
                    size="large"
                    style={{ borderRadius: 8 }}
                  />
                  <div className="mt-2 text-xs text-gray-400">
                    Hiển thị trên toàn bộ các nền tảng (Web, App)
                  </div>
                </div>

                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Địa chỉ Email hỗ trợ
                  </label>
                  <Input
                    prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                    value={settings.support_email || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        support_email: e.target.value,
                      })
                    }
                    placeholder="VD: support@travelcheckin.com"
                    size="large"
                    style={{ borderRadius: 8 }}
                  />
                  <div className="mt-2 text-xs text-gray-400">
                    Kênh hỗ trợ chính thức qua thư điện tử
                  </div>
                </div>
              </div>

              <Divider className="my-6" />

              <div className="flex justify-end">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveSettings}
                  loading={loading}
                  size="large"
                  style={{
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    boxShadow: "0 4px 10px rgba(16,185,129,0.2)",
                    padding: "0 32px",
                  }}
                >
                  Lưu Thông tin Hỗ trợ
                </Button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <AppThemeSettings 
              currentBackground={settings.app_background_url || undefined}
              currentPrimaryColor={settings.app_primary_color || undefined}
              currentSecondaryColor={settings.app_secondary_color || undefined}
              currentTextColor={settings.app_text_color || undefined}
            />
          </div>
        </div>
      ),
    },
    {
      key: "analytics",
      label: (
        <span className="font-bold text-lg px-2 py-1 flex items-center gap-2">
          <BarChartOutlined /> Thống kê dữ liệu
        </span>
      ),
      children: (
        <div className="pt-4">
          <AnalyticsTab />
        </div>
      ),
    },
    {
      key: "logs",
      label: (
        <span className="font-bold text-lg px-2 py-1 flex items-center gap-2">
          <HistoryOutlined /> Nhật ký hệ thống
        </span>
      ),
      children: (
        <div className="pt-4">
          <SystemLogs />
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <Card 
        bordered={false}
        bodyStyle={{ paddingTop: 8 }}
        style={{
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        }}
      >
        <Tabs 
          defaultActiveKey="settings" 
          items={items}
          size="large"
          tabBarStyle={{ marginBottom: 0 }}
        />
      </Card>
    </MainLayout>
  );
};

export default Settings;
