import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined } from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatDateVi } from "../../utils/formatDateVi";

type VoucherStatus = "active" | "inactive" | "expired";
type DiscountType = "percent" | "amount";
type ServiceScope = "all" | "room" | "food" | "ticket" | "other";
type LocationScope =
  | "all"
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

interface SystemVoucher {
  voucher_id: number;
  code: string;
  campaign_name?: string | null;
  campaign_description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  apply_to_service_type: ServiceScope;
  apply_to_location_type?: LocationScope;
  min_order_value: number;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  usage_limit: number;
  max_uses_per_user?: number;
  used_count: number;
  status: VoucherStatus;
  created_at: string;
  // Backend tự động tính trạng thái 'expired' dựa trên end_date; website chỉ render
  computed_status?: VoucherStatus;
}

const statusColor: Record<VoucherStatus, string> = {
  active: "green",
  inactive: "orange",
  expired: "red",
};

const discountLabel = (v: SystemVoucher) => {
  if (v.discount_type === "percent") return `${v.discount_value}%`;
  return `${Number(v.discount_value).toLocaleString("vi-VN")}₫`;
};

const formatDateTimeDisplay = (value?: string | null) => {
  if (!value) return "";
  let match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return String(value);
};

const normalizeDateTimeInput = (
  value: unknown,
  opts?: {
    defaultTime?: string;
  },
) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  const defaultTime = opts?.defaultTime ?? "00:00:00";

  let match = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
  }

  match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd} ${defaultTime}`;
  }

  match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const [, yyyy, mm, dd, hh, min, ss] = match;
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
  }

  match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${yyyy}-${mm}-${dd} ${defaultTime}`;
  }

  match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    const [, yyyy, mm, dd, hh, min, ss] = match;
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
  }

  return value;
};

const SystemVouchers = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SystemVoucher[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemVoucher | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, statusFilter, search]);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const params: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await adminApi.getSystemVouchers(params);
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
        e.response?.data?.message ||
          e.message ||
          "Lỗi lấy danh sách voucher hệ thống",
      );
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      campaign_name: "",
      campaign_description: "",
      discount_type: "percent",
      apply_to_service_type: "all",
      apply_to_location_type: "all",
      usage_limit: 100,
      max_uses_per_user: 1,
      min_order_value: 0,
      status: "active",
    });
    setModalOpen(true);
  };

  const openEdit = (row: SystemVoucher) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      ...row,
      max_discount_amount: row.max_discount_amount ?? undefined,
      apply_to_location_type: row.apply_to_location_type ?? "all",
      max_uses_per_user: row.max_uses_per_user ?? 1,
      start_date: formatDateTimeDisplay(row.start_date),
      end_date: formatDateTimeDisplay(row.end_date),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      start_date: normalizeDateTimeInput(values.start_date, {
        defaultTime: "00:00:00",
      }),
      end_date: normalizeDateTimeInput(values.end_date, {
        defaultTime: "23:59:59",
      }),
    };
    try {
      if (editing) {
        const res = await adminApi.updateSystemVoucher(
          editing.voucher_id,
          payload,
        );
        if (res.success) {
          message.success("Cập nhật voucher thành công");
          setModalOpen(false);
          fetchVouchers();
        }
      } else {
        const res = await adminApi.createSystemVoucher(payload);
        if (res.success) {
          message.success("Tạo voucher hệ thống thành công");
          setModalOpen(false);
          fetchVouchers();
        }
      }
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      message.error(
        e.response?.data?.message || e.message || "Lỗi lưu voucher",
      );
    }
  };

  const handleDeleteVoucher = async (voucherId: number) => {
    try {
      const res = await adminApi.deleteSystemVoucher(voucherId);
      message.success(res?.message || "Đã xóa voucher");
      fetchVouchers();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      message.error(
        e.response?.data?.message || e.message || "Không thể xóa voucher",
      );
    }
  };

  const columns: ColumnsType<SystemVoucher> = [
    { title: "ID", dataIndex: "voucher_id", key: "voucher_id", width: 80 },
    {
      title: "Tên chiến dịch",
      dataIndex: "campaign_name",
      key: "campaign_name",
      width: 220,
      render: (v: string | null | undefined) => v || "-",
    },
    { title: "Code", dataIndex: "code", key: "code" },
    {
      title: "Mức giảm",
      key: "discount",
      render: (_, r) => discountLabel(r),
    },
    {
      title: "Phạm vi",
      dataIndex: "apply_to_service_type",
      key: "apply_to_service_type",
      render: (v: ServiceScope) => <Tag>{v}</Tag>,
    },
    {
      title: "Loại địa điểm",
      dataIndex: "apply_to_location_type",
      key: "apply_to_location_type",
      width: 140,
      render: (v: LocationScope | undefined) => <Tag>{v || "all"}</Tag>,
    },
    {
      title: "Hiệu lực",
      key: "duration",
      render: (_, r) => (
        <span>
          {formatDateVi(r.start_date)} → {formatDateVi(r.end_date)}
        </span>
      ),
    },
    {
      title: "Đã dùng",
      key: "used",
      align: "right",
      render: (_, r) => (
        <span>
          {r.used_count}/{r.usage_limit}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (s: VoucherStatus, r: SystemVoucher) => {
        // Website chỉ render computed_status do backend trả về (tự động tính expired)
        const displayStatus = r.computed_status || s;
        return (
          <Tag color={statusColor[displayStatus]}>
            {displayStatus.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right",
      width: 160,
      render: (_, r) => {
        // Website chỉ dùng computed_status backend trả về, không tự kiểm tra expired
        const displayStatus = r.computed_status || r.status;
        return (
          <Space>
            <Button type="link" onClick={() => openEdit(r)}>
              Sửa
            </Button>

            <Popconfirm
              title="Xóa voucher hệ thống này?"
              description="Voucher đang hoạt động sẽ không thể xóa. Vui lòng tạm dừng hoặc đợi hết hạn."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={displayStatus === "active"}
              onConfirm={() => handleDeleteVoucher(r.voucher_id)}
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                disabled={displayStatus === "active"}
              >
                Xóa
              </Button>
            </Popconfirm>

            <Button
              type="link"
              danger={displayStatus === "active"}
              disabled={displayStatus === "expired"}
              onClick={async () => {
                try {
                  const next =
                    displayStatus === "active" ? "inactive" : "active";
                  const res = await adminApi.updateSystemVoucher(r.voucher_id, {
                    status: next,
                  });
                  if (res.success) {
                    message.success("Cập nhật trạng thái thành công");
                    fetchVouchers();
                  }
                } catch (err: unknown) {
                  const maybe = err as {
                    response?: { data?: { message?: unknown } };
                    message?: unknown;
                  };
                  const msg = maybe.response?.data?.message;
                  message.error(
                    (typeof msg === "string" && msg.trim() ? msg : undefined) ||
                      (typeof maybe.message === "string" && maybe.message.trim()
                        ? maybe.message
                        : undefined) ||
                      "Lỗi cập nhật trạng thái",
                  );
                }
              }}
            >
              {displayStatus === "active"
                ? "Tạm dừng"
                : displayStatus === "expired"
                  ? "Hết hạn"
                  : "Kích hoạt"}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Voucher hệ thống</h2>
        <p className="text-gray-500">
          Tạo và quản lý voucher do Admin phát hành
        </p>
      </div>

      <Card className="mb-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-3">
            <Input
              placeholder="Tìm theo code hoặc tên chiến dịch..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              allowClear
              style={{ width: 280 }}
            />
            <Select
              placeholder="Lọc trạng thái"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              allowClear
              style={{ width: 180 }}
            >
              <Select.Option value="active">Đang hoạt động</Select.Option>
              <Select.Option value="inactive">Ngừng hoạt động</Select.Option>
              <Select.Option value="expired">Hết hạn</Select.Option>
            </Select>
          </div>
          <Button type="primary" onClick={openCreate}>
            Tạo voucher
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="voucher_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `Tổng ${t} voucher`,
            onChange: (page, pageSize) =>
              setPagination((p) => ({
                ...p,
                current: page,
                pageSize: pageSize || 20,
              })),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={
          editing ? `Sửa voucher: ${editing.code}` : "Tạo voucher hệ thống"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editing ? "Lưu" : "Tạo"}
        cancelText="Hủy"
        width={720}
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item
              label="Mã Code"
              name="code"
              rules={[{ required: true, message: "Vui lòng nhập code" }]}
            >
              <Input placeholder="VD: TET2026" />
            </Form.Item>
          )}

          <Form.Item label="Tên chiến dịch" name="campaign_name">
            <Input
              placeholder="VD: Tết 2026 - Giảm giá toàn sàn"
              maxLength={255}
            />
          </Form.Item>

          <Form.Item label="Mô tả chiến dịch" name="campaign_description">
            <Input.TextArea
              rows={2}
              placeholder="Ghi chú nội dung chiến dịch (tuỳ chọn)"
            />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="Loại giảm"
              name="discount_type"
              rules={[{ required: true, message: "Chọn loại giảm" }]}
            >
              <Select>
                <Select.Option value="percent">Phần trăm (%)</Select.Option>
                <Select.Option value="amount">Số tiền (VND)</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="Giá trị giảm"
              name="discount_value"
              rules={[{ required: true, message: "Nhập giá trị giảm" }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item label="Phạm vi áp dụng" name="apply_to_service_type">
              <Select>
                <Select.Option value="all">Tất cả</Select.Option>
                <Select.Option value="room">Phòng / Lưu trú</Select.Option>
                <Select.Option value="food">Ăn uống</Select.Option>
                <Select.Option value="ticket">Vé / Tham quan</Select.Option>
                <Select.Option value="other">Khác</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Áp dụng cho loại địa điểm"
              name="apply_to_location_type"
            >
              <Select>
                <Select.Option value="all">Tất cả</Select.Option>
                <Select.Option value="hotel">Khách sạn</Select.Option>
                <Select.Option value="restaurant">Nhà hàng</Select.Option>
                <Select.Option value="tourist">
                  Du lịch / Tham quan
                </Select.Option>
                <Select.Option value="cafe">Quán cà phê</Select.Option>
                <Select.Option value="resort">Resort</Select.Option>
                <Select.Option value="other">Khác</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Trạng thái" name="status">
              <Select>
                <Select.Option value="active">Đang hoạt động</Select.Option>
                <Select.Option value="inactive">Ngừng hoạt động</Select.Option>
                <Select.Option value="expired">Hết hạn</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Giá trị đơn tối thiểu" name="min_order_value">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item label="Giảm tối đa (nếu %) " name="max_discount_amount">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item
              label="Ngày bắt đầu (DD/MM/YYYY)"
              name="start_date"
              rules={[{ required: true, message: "Nhập ngày bắt đầu" }]}
            >
              <Input placeholder="20/01/2026" />
            </Form.Item>
            <Form.Item
              label="Ngày kết thúc (DD/MM/YYYY)"
              name="end_date"
              rules={[{ required: true, message: "Nhập ngày kết thúc" }]}
            >
              <Input placeholder="05/02/2026" />
            </Form.Item>
            <Form.Item label="Giới hạn lượt dùng" name="usage_limit">
              <InputNumber className="w-full" min={1} />
            </Form.Item>

            <Form.Item label="Tối đa mỗi user" name="max_uses_per_user">
              <InputNumber className="w-full" min={1} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </MainLayout>
  );
};

export default SystemVouchers;
