import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined } from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatDateVi } from "../../utils/formatDateVi";

type Audience = "all_users" | "all_owners" | "specific_user";

interface PushNotificationRow {
  notification_id: number;
  title: string;
  body: string;
  target_audience: Audience;
  sent_by: number | null;
  sent_by_name?: string | null;
  sent_by_email?: string | null;
  created_at: string;
}

const audienceLabel: Record<Audience, string> = {
  all_users: "Tất cả User",
  all_owners: "Tất cả Owner",
  specific_user: "User cụ thể (chỉ lưu DB)",
};

const audienceColor: Record<Audience, string> = {
  all_users: "blue",
  all_owners: "purple",
  specific_user: "orange",
};

const PushNotifications = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PushNotificationRow[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const watchedValues = Form.useWatch([], form);

  const preview = useMemo(() => {
    const v = watchedValues || {};
    return {
      title: v.title || "Tiêu đề thông báo",
      body: v.body || "Nội dung thông báo sẽ hiển thị ở đây để bạn xem trước…",
      target_audience: (v.target_audience || "all_users") as Audience,
    };
  }, [watchedValues]);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPushNotifications({
        page: pagination.current,
        limit: pagination.pageSize,
      });
      if (res.success) {
        setData(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0 }));
      }
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      message.error(
        e.response?.data?.message || e.message || "Lỗi lấy danh sách thông báo",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        target_user_id:
          values.target_audience === "specific_user"
            ? Number(values.target_user_id)
            : undefined,
      };
      const res = await adminApi.createPushNotification(payload);
      if (res.success) {
        const fcmSent = Boolean(res.data?.fcm?.sent);
        const messageId = res.data?.fcm?.message_id as string | undefined;

        if (values.target_audience === "specific_user") {
          message.success("Đã tạo thông báo (đã lưu DB)");
        } else if (fcmSent) {
          message.success(
            messageId
              ? `Đã tạo thông báo và gửi FCM (messageId: ${messageId})`
              : "Đã tạo thông báo và gửi FCM",
          );
        } else {
          message.warning(
            "Đã tạo thông báo (đã lưu DB) nhưng gửi FCM chưa thành công",
          );
        }

        form.resetFields();
        form.setFieldsValue({ target_audience: "all_users" });
        fetchNotifications();
      }
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      message.error(
        e.response?.data?.message || e.message || "Lỗi gửi thông báo",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotification = async (record: PushNotificationRow) => {
    try {
      const res = await adminApi.deletePushNotification(record.notification_id);
      if (res?.success) {
        message.success("Đã xóa thông báo");
        fetchNotifications();
      }
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      message.error(
        e.response?.data?.message || e.message || "Lỗi xóa thông báo",
      );
    }
  };

  const columns: ColumnsType<PushNotificationRow> = [
    {
      title: "ID",
      dataIndex: "notification_id",
      key: "notification_id",
      width: 80,
    },
    { title: "Tiêu đề", dataIndex: "title", key: "title" },
    {
      title: "Đối tượng",
      dataIndex: "target_audience",
      key: "target_audience",
      width: 160,
      render: (a: Audience) => (
        <Tag color={audienceColor[a]}>{audienceLabel[a]}</Tag>
      ),
    },
    {
      title: "Người gửi",
      key: "sent_by",
      width: 220,
      render: (_, r) =>
        r.sent_by_name ||
        r.sent_by_email ||
        (r.sent_by ? `ID ${r.sent_by}` : "System"),
    },
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (v: string) => formatDateVi(v),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Space size={6}>
          <Popconfirm
            title="Xóa thông báo này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteNotification(record)}
          >
            <Tooltip title="Xóa">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gửi thông báo đẩy</h2>
        <p className="text-gray-500">
          Soạn thông báo (trái) và xem trước hiển thị trên mobile (phải)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* LEFT: FORM */}
        <Card title="Soạn thông báo" className="shadow-sm">
          <Form
            form={form}
            layout="vertical"
            initialValues={{ target_audience: "all_users" }}
          >
            <Form.Item
              label="Đối tượng nhận"
              name="target_audience"
              rules={[{ required: true, message: "Chọn đối tượng nhận" }]}
            >
              <Select>
                <Select.Option value="all_users">Tất cả User</Select.Option>
                <Select.Option value="all_owners">Tất cả Owner</Select.Option>
                <Select.Option value="specific_user">
                  User cụ thể (chỉ lưu DB)
                </Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              shouldUpdate={(prev, curr) =>
                prev.target_audience !== curr.target_audience
              }
              noStyle
            >
              {({ getFieldValue }) =>
                getFieldValue("target_audience") === "specific_user" ? (
                  <Form.Item
                    label="User ID"
                    name="target_user_id"
                    rules={[{ required: true, message: "Nhập user ID" }]}
                  >
                    <Input type="number" placeholder="VD: 123" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item
              label="Tiêu đề"
              name="title"
              rules={[{ required: true, message: "Nhập tiêu đề" }]}
            >
              <Input maxLength={255} placeholder="VD: Ưu đãi Tết 2026" />
            </Form.Item>

            <Form.Item
              label="Nội dung"
              name="body"
              rules={[{ required: true, message: "Nhập nội dung" }]}
            >
              <Input.TextArea
                rows={6}
                placeholder="VD: Giảm 20% cho tất cả dịch vụ trong tuần này..."
              />
            </Form.Item>

            <Button type="primary" onClick={handleSend} loading={submitting}>
              Gửi (lưu thông báo)
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              Lưu ý: backend luôn lưu vào bảng <code>push_notifications</code>.
              Với <b>all_users</b>/<b>all_owners</b> backend sẽ gửi FCM tới
              Topic tương ứng; với <b>specific_user</b> hiện chỉ lưu DB.
            </p>
          </Form>
        </Card>

        {/* RIGHT: PREVIEW */}
        <Card title="Xem trước trên mobile" className="shadow-sm">
          <div className="flex justify-center">
            <div
              className="bg-black rounded-[36px] p-4 w-[340px]"
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
            >
              <div className="bg-white rounded-[28px] p-4 h-[520px] relative overflow-hidden">
                <div className="text-xs text-gray-500 mb-3">
                  Màn hình khóa • {audienceLabel[preview.target_audience]}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600" />
                      <div>
                        <div className="text-sm font-semibold">
                          TravelCheckin
                        </div>
                        <div className="text-xs text-gray-500">Now</div>
                      </div>
                    </div>
                    <Tag color={audienceColor[preview.target_audience]}>
                      {audienceLabel[preview.target_audience]}
                    </Tag>
                  </div>

                  <div className="text-base font-semibold">{preview.title}</div>
                  <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                    {preview.body}
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-400">
                  Preview UI (không phải push thật)
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Lịch sử thông báo đã tạo">
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="notification_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `Tổng ${t} thông báo`,
            onChange: (page, pageSize) =>
              setPagination((p) => ({
                ...p,
                current: page,
                pageSize: pageSize || 20,
              })),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </MainLayout>
  );
};

export default PushNotifications;
