import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
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

interface OwnerVoucherRow {
  voucher_id: number;
  owner_id: number;
  location_id: number | null;
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
  computed_status?: VoucherStatus;
  created_at: string;

  owner_name?: string | null;
  owner_email?: string | null;
  location_name?: string | null;
}

const statusColor: Record<VoucherStatus, string> = {
  active: "green",
  inactive: "orange",
  expired: "red",
};

const discountLabel = (v: OwnerVoucherRow) => {
  if (v.discount_type === "percent") return `${v.discount_value}%`;
  return `${Number(v.discount_value).toLocaleString("vi-VN")}₫`;
};

const OwnerVouchers = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OwnerVoucherRow[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | undefined>(
    "inactive",
  );
  const [search, setSearch] = useState("");

  const { current, pageSize } = pagination;

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        page: current,
        limit: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await adminApi.getOwnerVouchers(params);
      if (res?.success) {
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
          "Lỗi lấy danh sách voucher của owner",
      );
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, search, statusFilter]);

  useEffect(() => {
    void fetchVouchers();
  }, [fetchVouchers]);

  const updateStatus = useCallback(
    async (voucherId: number, status: "active" | "inactive") => {
      try {
        const res = await adminApi.updateOwnerVoucherStatus(voucherId, {
          status,
        });
        if (res?.success) {
          message.success(res?.message || "Đã cập nhật trạng thái voucher");
          void fetchVouchers();
        }
      } catch (err: unknown) {
        const e = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        message.error(
          e.response?.data?.message ||
            e.message ||
            "Không thể cập nhật trạng thái",
        );
      }
    },
    [fetchVouchers],
  );

  const columns: ColumnsType<OwnerVoucherRow> = useMemo(
    () => [
      { title: "ID", dataIndex: "voucher_id", key: "voucher_id", width: 80 },
      { title: "Code", dataIndex: "code", key: "code", width: 140 },
      {
        title: "Owner",
        key: "owner",
        render: (_, r) => (
          <div>
            <div className="font-medium">
              {r.owner_name || `#${r.owner_id}`}
            </div>
            <div className="text-xs text-gray-500">{r.owner_email || ""}</div>
          </div>
        ),
      },
      {
        title: "Địa điểm",
        key: "location",
        render: (_, r) =>
          r.location_name || (r.location_id ? `#${r.location_id}` : "Tất cả"),
      },
      {
        title: "Giảm",
        key: "discount",
        width: 120,
        render: (_, r) => discountLabel(r),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (_: VoucherStatus, r) => {
          const s = (r.computed_status || r.status) as VoucherStatus;
          return <Tag color={statusColor[s]}>{String(s).toUpperCase()}</Tag>;
        },
      },
      {
        title: "Thời gian",
        key: "time",
        width: 220,
        render: (_, r) => (
          <div className="text-xs text-gray-600">
            <div>From: {formatDateVi(r.start_date)}</div>
            <div>To: {formatDateVi(r.end_date)}</div>
          </div>
        ),
      },
      {
        title: "Hành động",
        key: "actions",
        width: 220,
        render: (_, r) => {
          const effective = (r.computed_status || r.status) as VoucherStatus;
          const canApprove = effective !== "expired" && r.status === "inactive";
          const canDeactivate =
            effective !== "expired" && r.status === "active";

          return (
            <Space>
              <Popconfirm
                title="Duyệt voucher này?"
                okText="Duyệt"
                cancelText="Hủy"
                disabled={!canApprove}
                onConfirm={() => updateStatus(r.voucher_id, "active")}
              >
                <Button type="primary" size="small" disabled={!canApprove}>
                  Duyệt
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Chuyển voucher về INACTIVE?"
                okText="Xác nhận"
                cancelText="Hủy"
                disabled={!canDeactivate}
                onConfirm={() => updateStatus(r.voucher_id, "inactive")}
              >
                <Button size="small" disabled={!canDeactivate}>
                  Tắt
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [updateStatus],
  );

  return (
    <MainLayout>
      <Card
        title="Voucher Owner (Duyệt)"
        extra={
          <Space>
            <Input
              allowClear
              placeholder="Tìm theo code / campaign / owner"
              value={search}
              onChange={(e) => {
                setPagination((p) => ({ ...p, current: 1 }));
                setSearch(e.target.value);
              }}
              style={{ width: 300 }}
            />
            <Select
              value={statusFilter}
              onChange={(v) => {
                setPagination((p) => ({ ...p, current: 1 }));
                setStatusFilter(v);
              }}
              style={{ width: 160 }}
              options={[
                { value: undefined, label: "Tất cả" },
                { value: "inactive", label: "INACTIVE (chờ duyệt)" },
                { value: "active", label: "ACTIVE" },
                { value: "expired", label: "EXPIRED" },
              ]}
            />
            <Button onClick={fetchVouchers}>Tải lại</Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          rowKey="voucher_id"
          dataSource={data}
          columns={columns}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setPagination((p) => ({ ...p, current: page, pageSize })),
          }}
        />
      </Card>
    </MainLayout>
  );
};

export default OwnerVouchers;
