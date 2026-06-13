import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarOutlined,
  GiftOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PercentageOutlined,
  SaveOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Row,
  Space,
  Table,
  Tag,
  DatePicker,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import dayjs from "dayjs";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type ServiceScope = "all" | "room" | "food" | "ticket" | "other";
type VoucherStatus = "active" | "inactive" | "expired";

type LocationType =
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

type OwnerLocationOption = {
  location_id: number;
  location_name: string;
  location_type: LocationType;
};

type OwnerVoucherRow = {
  voucher_id: number;
  code: string;
  campaign_name: string;
  campaign_description?: string | null;
  discount_type: "percent" | "amount";
  discount_value: number;
  start_date?: string | null;
  end_date?: string | null;
  usage_limit?: number | null;
  used_count?: number | null;
  status?: VoucherStatus;
  computed_status?: string;
  apply_to_service_type?: ServiceScope;
  location_id?: number | null;
  location_name?: string | null;
};

const scopeLabel: Record<ServiceScope, string> = {
  all: "Tất cả",
  room: "Khách sạn",
  food: "Ăn uống",
  ticket: "Du lịch",
  other: "Khác",
};

const locationTypesForScope = (
  scope: ServiceScope,
): Set<LocationType> | null => {
  if (scope === "all") return null;
  if (scope === "room") return new Set(["hotel", "resort"]);
  if (scope === "food") return new Set(["restaurant", "cafe"]);
  if (scope === "ticket") return new Set(["tourist"]);
  return new Set(["other"]);
};

const OwnerVouchers = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OwnerVoucherRow[]>([]);
  const [locations, setLocations] = useState<OwnerLocationOption[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<
    OwnerLocationOption[]
  >([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    | "all"
    | VoucherStatus
    | "computed_active"
    | "computed_inactive"
    | "computed_expired"
  >("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerVoucherRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Restored States
  const [stats, setStats] = useState<any>(null);
  const [adminVouchers, setAdminVouchers] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [searchAdmin, setSearchAdmin] = useState("");

  const watchCode = Form.useWatch("code", form);
  const watchCampaignName = Form.useWatch("campaign_name", form);
  const watchCampaignDesc = Form.useWatch("campaign_description", form);
  const watchDiscountType = Form.useWatch("discount_type", form);
  const watchDiscountValue = Form.useWatch("discount_value", form);
  const watchLocationId = Form.useWatch("location_id", form);
  const watchLocationScope = Form.useWatch("location_scope", form);
  const watchLocationIds = Form.useWatch("location_ids", form);
  const watchUsageLimit = Form.useWatch("usage_limit", form);
  const watchStatus = Form.useWatch("status", form);
  const watchStart = Form.useWatch("start_date", form);
  const watchEnd = Form.useWatch("end_date", form);

  const previewApplyText = useMemo(() => {
    const scope = (watchLocationScope || "all");
    if (scope === "all") return "Tất cả chi nhánh";
    if (scope === "single") {
      if (watchLocationId == null) return "Chưa chọn";
      const id = Number(watchLocationId);
      const found = locations.find((l) => l.location_id === id);
      return found?.location_name ?? `#${id}`;
    }
    const ids = Array.isArray(watchLocationIds) ? watchLocationIds : [];
    if (ids.length === 0) return "Chưa chọn";
    if (ids.length === 1) {
      const id = Number(ids[0]);
      const found = locations.find((l) => l.location_id === id);
      return found?.location_name ?? `#${id}`;
    }
    return `${ids.length} địa điểm`;
  }, [watchLocationId, watchLocationIds, watchLocationScope, locations]);

  const previewStatusText = useMemo(() => {
    const v = String((watchStatus as string) || "inactive");
    return v === "active" ? "ĐANG HOẠT ĐỘNG" : v === "inactive" ? "TẠM TẮT" : "HẾT HẠN";
  }, [watchStatus]);

  const previewStatusStyle = useMemo(() => {
    const s = (watchStatus as VoucherStatus) || "inactive";
    if (s === "active") return { backgroundColor: "#2ecc71" };
    if (s === "expired") return { backgroundColor: "#e74c3c" };
    return { backgroundColor: "#f39c12" };
  }, [watchStatus]);

  // Load Stats & Top Vouchers
  const loadStats = useCallback(async () => {
    try {
      const res = await ownerApi.getVoucherStats();
      if (res.success) {
        setStats(res.data?.summary || null);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshVouchers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const vRes = await ownerApi.getVouchers();
      setItems((vRes?.data || []) as OwnerVoucherRow[]);
      setAdminVouchers((vRes?.adminVouchers || []) as any[]);
      await loadStats();
    } catch (err: unknown) {
      if (!silent) {
        message.error(getErrorMessage(err, "Lỗi tải vouchers"));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, lRes] = await Promise.all([
        ownerApi.getVouchers(),
        ownerApi.getLocations(),
      ]);
      const locs = (lRes?.data || []) as OwnerLocationOption[];
      setItems((vRes?.data || []) as OwnerVoucherRow[]);
      setAdminVouchers((vRes?.adminVouchers || []) as any[]);
      setLocations(locs);
      setFilteredLocations(locs);
      await loadStats();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải vouchers"));
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: SSE để Owner thấy trạng thái mới ngay sau khi Admin duyệt/xóa
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) return;

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as { type?: string };
        if (
          data?.type === "owner_voucher_updated" ||
          data?.type === "owner_voucher_deleted"
        ) {
          void refreshVouchers(true);
        }
      } catch {
        // ignore
      }
    };

    // Fallback: khi quay lại tab thì refresh 1 lần
    const onVisibility = () => {
      if (!document.hidden) void refreshVouchers(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      es.close();
    };
  }, []);

  const onCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      location_scope: "all",
      location_id: null,
      location_ids: [],
      discount_type: "percent",
      apply_to_service_type: "all",
      min_order_value: 0,
      usage_limit: 100,
      max_uses_per_user: 1,
      target_group: "all",
      loyalty_min_spend: undefined,
      status: "active",
    });
    setFilteredLocations(locations);
    setOpen(true);
  };

  const onEdit = useCallback(
    (row: OwnerVoucherRow) => {
      setEditing(row);
      const locScope = (row as any).location_ids && (row as any).location_ids.length > 0 ? "multiple" : row.location_id ? "single" : "all";
      form.setFieldsValue({
        ...row,
        location_scope: locScope,
        location_id: row.location_id ?? null,
        location_ids: (row as any).location_ids ?? undefined,
        start_date: row.start_date ? dayjs(row.start_date) : null,
        end_date: row.end_date ? dayjs(row.end_date) : null,
        apply_to_service_type: (row.apply_to_service_type ||
          "all") as ServiceScope,
        status: row.status || "active",
        target_group: (row as any).target_group ?? "all",
        loyalty_min_spend: (row as any).loyalty_min_spend ?? undefined,
      });
      const scope = (row.apply_to_service_type || "all") as ServiceScope;
      const typeSet = locationTypesForScope(scope);
      const list = typeSet
        ? locations.filter((l) =>
            typeSet.has((l.location_type || "other") as LocationType),
          )
        : locations;
      setFilteredLocations(list);
      setOpen(true);
    },
    [form, locations],
  );

  const onSave = async () => {
    try {
      const valuesRaw = await form.validateFields();
      const { location_scope, ...rest } = valuesRaw;
      let locationPayload: Record<string, unknown> = {};
      if (location_scope === "all") {
        locationPayload = { location_id: null, location_ids: [] };
      } else if (location_scope === "single") {
        locationPayload = { location_id: rest.location_id, location_ids: [] };
      } else if (location_scope === "multiple") {
        locationPayload = { location_id: null, location_ids: rest.location_ids };
      }
      const values = {
        ...rest,
        ...locationPayload,
        start_date: valuesRaw.start_date
          ? dayjs(valuesRaw.start_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
        end_date: valuesRaw.end_date
          ? dayjs(valuesRaw.end_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
      };
      setSaving(true);
      if (editing) {
        await ownerApi.updateVoucher(editing.voucher_id, values);
        message.success("Đã cập nhật voucher");
      } else {
        await ownerApi.createVoucher(values);
        message.success("Đã tạo voucher thành công");
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const record = asRecord(err);
      if (Array.isArray(record.errorFields)) return;
      message.error(getErrorMessage(err, "Lỗi lưu voucher"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = useCallback(
    async (row: OwnerVoucherRow) => {
      try {
        await ownerApi.deleteVoucher(row.voucher_id);
        message.success("Đã xóa voucher");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa voucher"));
      }
    },
    [load],
  );

  const loadUsageHistory = async (voucherId: number) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await ownerApi.getVoucherUsageHistory(voucherId);
      setHistoryData(res.data || []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = (items || [])
      .filter((row) => {
        if (statusFilter === "all") return true;
        const s = String(row.computed_status || row.status || "inactive");
        if (statusFilter === "computed_active") return s === "active";
        if (statusFilter === "computed_inactive") return s === "inactive";
        if (statusFilter === "computed_expired") return s === "expired";
        return s === statusFilter;
      })
      .filter((row) => {
        if (!normalizedSearch) return true;
        const hay = [
          row.code,
          row.campaign_name,
          row.campaign_description,
          row.location_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(normalizedSearch);
      });
    return [...result].sort((a, b) => b.voucher_id - a.voucher_id);
  }, [items, search, statusFilter]);

  const filteredAdminItems = useMemo(() => {
    const normalizedSearch = searchAdmin.trim().toLowerCase();
    const result = (adminVouchers || [])
      .filter((row) => {
        if (!normalizedSearch) return true;
        const hay = [
          row.code,
          row.campaign_name,
          row.campaign_description,
          row.location_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(normalizedSearch);
      });
    return [...result].sort((a, b) => b.voucher_id - a.voucher_id);
  }, [adminVouchers, searchAdmin]);

  const columns: ColumnsType<OwnerVoucherRow> = useMemo(
    () => [
      {
        title: "Số thứ tự",
        width: 90,
        align: "center",
        render: (_: any, __: any, index: number) => filteredItems.length - index,
      },
      {
        title: "Mã voucher",
        dataIndex: "code",
        width: 110,
        render: (code: string) => (
          <span className="font-mono bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
            {code}
          </span>
        ),
      },
      {
        title: "Tên voucher",
        dataIndex: "campaign_name",
        width: 200,
        render: (v: string, row) => (
          <div>
            <div className="font-semibold text-slate-800">{v}</div>
            {row.campaign_description && (
              <div className="text-xs text-slate-500">{row.campaign_description}</div>
            )}
          </div>
        )
      },
      {
        title: "Phạm vi",
        width: 90,
        align: "center",
        render: (_: unknown, row) =>
          scopeLabel[(row.apply_to_service_type || "all") as ServiceScope],
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        width: 130,
        render: (v: unknown, row) => {
          if (typeof v === "string" && v.trim()) return v;
          return row.location_id != null ? "" : "Tất cả";
        },
      },
      {
        title: "Giảm",
        width: 100,
        align: "center",
        render: (_: unknown, row) => {
          const val = Number(row.discount_value || 0);
          if (row.discount_type === "percent" && val <= 100) {
            return (
              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
                {val}%
              </span>
            );
          }
          return (
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
              {val.toLocaleString("vi-VN")}₫
            </span>
          );
        },
      },
      {
        title: "Đã dùng",
        width: 100,
        align: "center",
        render: (_: unknown, row) => {
          const used = Number(row.used_count || 0);
          const limit = Number(row.usage_limit || 0);
          const percent = limit > 0 ? (used / limit) * 100 : 0;
          return (
            <div className="flex flex-col items-center justify-center w-full">
              <span className="font-semibold text-slate-700 text-xs">{used}/{limit}</span>
              <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "computed_status",
        width: 100,
        align: "center",
        render: (s: string) => {
          const statusText = s === "active" ? "Còn hạn" : s === "inactive" ? "Tạm tắt" : "Hết hạn";
          return (
            <Tag
              color={
                s === "active" ? "success" : s === "inactive" ? "warning" : "error"
              }
              className="rounded-full px-2.5 font-semibold text-xs border-0"
            >
              {statusText}
            </Tag>
          );
        },
      },
      {
        title: "Hiệu lực",
        width: 150,
        align: "center",
        render: (_: unknown, row) => (
          <div className="text-xs text-gray-600">
            <div>{row.start_date ? formatDateTimeVi(row.start_date) : ""}</div>
            <div>{row.end_date ? formatDateTimeVi(row.end_date) : ""}</div>
          </div>
        ),
      },
      {
        title: "Hành động",
        width: 190,
        align: "center",
        render: (_: unknown, row) => (
          <Space>
            <Button
              size="small"
              shape="round"
              style={{
                color: "#2563eb",
                borderColor: "#bfdbfe",
                backgroundColor: "#eff6ff",
                fontWeight: 600,
              }}
              onClick={() => onEdit(row)}
            >
              Sửa
            </Button>
            <Button
              size="small"
              shape="round"
              style={{
                color: "#4f46e5",
                borderColor: "#c7d2fe",
                backgroundColor: "#f5f3ff",
                fontWeight: 600,
              }}
              onClick={() => loadUsageHistory(row.voucher_id)}
            >
              Lịch sử
            </Button>
            <Popconfirm
              title="Xóa voucher?"
              description="Owner sẽ không còn thấy voucher này."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => onDelete(row)}
            >
              <Button
                size="small"
                shape="round"
                style={{
                  color: "#dc2626",
                  borderColor: "#fecaca",
                  backgroundColor: "#fef2f2",
                  fontWeight: 600,
                }}
              >
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onDelete, onEdit, filteredItems],
  );

  const adminColumns: ColumnsType<any> = useMemo(
    () => [
      {
        title: "Số thứ tự",
        width: 90,
        align: "center",
        render: (_: any, __: any, index: number) => filteredAdminItems.length - index,
      },
      {
        title: "Mã voucher",
        dataIndex: "code",
        width: 110,
        render: (code: string) => (
          <span className="font-mono bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
            {code}
          </span>
        ),
      },
      {
        title: "Tên voucher",
        dataIndex: "campaign_name",
        width: 200,
        render: (v: string, row: any) => (
          <div>
            <div className="font-semibold text-slate-800">{v}</div>
            {row.campaign_description && (
              <div className="text-xs text-slate-500">{row.campaign_description}</div>
            )}
          </div>
        )
      },
      {
        title: "Phạm vi",
        width: 90,
        align: "center",
        render: (_: unknown, row: any) =>
          scopeLabel[(row.apply_to_service_type || "all") as ServiceScope],
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        width: 130,
        render: (v: unknown) => {
          if (typeof v === "string" && v.trim()) return v;
          return "Tất cả";
        },
      },
      {
        title: "Giảm",
        width: 100,
        align: "center",
        render: (_: unknown, row: any) => {
          const val = Number(row.discount_value || 0);
          if (row.discount_type === "percent" && val <= 100) {
            return (
              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
                {val}%
              </span>
            );
          }
          return (
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
              {val.toLocaleString("vi-VN")}₫
            </span>
          );
        },
      },
      {
        title: "Đã dùng",
        width: 100,
        align: "center",
        render: (_: unknown, row: any) => {
          const used = Number(row.used_count || 0);
          const limit = Number(row.usage_limit || 0);
          const percent = limit > 0 ? (used / limit) * 100 : 0;
          return (
            <div className="flex flex-col items-center justify-center w-full">
              <span className="font-semibold text-slate-700 text-xs">{used}/{limit}</span>
              <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "computed_status",
        width: 100,
        align: "center",
        render: (s: string) => {
          const statusText = s === "active" ? "Còn hạn" : s === "inactive" ? "Tạm tắt" : "Hết hạn";
          return (
            <Tag
              color={
                s === "active" ? "success" : s === "inactive" ? "warning" : "error"
              }
              className="rounded-full px-2.5 font-semibold text-xs border-0"
            >
              {statusText}
            </Tag>
          );
        },
      },
      {
        title: "Hiệu lực",
        width: 150,
        align: "center",
        render: (_: unknown, row: any) => (
          <div className="text-xs text-gray-600">
            <div>{row.start_date ? formatDateTimeVi(row.start_date) : ""}</div>
            <div>{row.end_date ? formatDateTimeVi(row.end_date) : ""}</div>
          </div>
        ),
      },
    ],
    [filteredAdminItems],
  );

  const historyColumns = [
    {
      title: "Mã Booking",
      dataIndex: "booking_id",
      key: "booking_id",
      width: 110,
      align: "center" as const,
      render: (id: number) => `#${id}`,
    },
    {
      title: "Khách hàng",
      key: "user",
      width: 200,
      render: (_: any, record: any) => (
        <div>
          <div className="font-semibold text-slate-800">{record.user_full_name}</div>
          <div className="text-xs text-slate-500">{record.user_email}</div>
        </div>
      ),
    },
    {
      title: "Thời gian sử dụng",
      dataIndex: "used_at",
      key: "used_at",
      width: 160,
      align: "center" as const,
      render: (v: string) => formatDateTimeVi(v),
    },
    {
      title: "Tổng tiền đơn",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 130,
      align: "center" as const,
      render: (v: number) => `${Number(v || 0).toLocaleString("vi-VN")}₫`,
    },
    {
      title: "Tiền giảm giá",
      dataIndex: "discount_amount",
      key: "discount_amount",
      width: 130,
      align: "center" as const,
      render: (v: number) => (
        <span className="font-bold text-emerald-600">
          -{Number(v || 0).toLocaleString("vi-VN")}₫
        </span>
      ),
    },
    {
      title: "Thực thanh toán",
      dataIndex: "final_amount",
      key: "final_amount",
      width: 140,
      align: "center" as const,
      render: (v: number) => `${Number(v || 0).toLocaleString("vi-VN")}₫`,
    },
  ];

  return (
    <MainLayout>
      <Card
        title={
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-extrabold text-xl">
            Voucher của tôi
          </span>
        }
        loading={loading}
        extra={
          <Space>
            <Button onClick={() => refreshVouchers(false)}>Tải lại</Button>
            <Button type="primary" onClick={onCreate}>
              Tạo voucher
            </Button>
          </Space>
        }
      >
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-blue-100 font-semibold uppercase tracking-wider">Tổng số voucher</div>
              <div className="mt-2 text-3xl font-extrabold">{Number(stats.total || 0)}</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Đang hoạt động</div>
              <div className="mt-2 text-3xl font-extrabold">{Number(stats.active_count || 0)}</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-violet-100 font-semibold uppercase tracking-wider">Đã sử dụng</div>
              <div className="mt-2 text-3xl font-extrabold">{Number(stats.total_uses || 0)} lượt</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Space>
            <Input
              allowClear
              placeholder="Tìm theo code / tên voucher / địa điểm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 320 }}
            />
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 160 }}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "computed_active", label: "Còn hạn" },
                { value: "computed_expired", label: "Hết hạn" },
              ]}
            />
          </Space>
        </div>

        <Table
          size="middle"
          loading={loading}
          rowKey="voucher_id"
          dataSource={filteredItems}
          columns={columns}
          pagination={false}
          scroll={{ x: "max-content", y: 480 }}
        />
      </Card>

      <Card
        title={
          <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent font-extrabold text-xl">
            Voucher nổi bật từ hệ thống
          </span>
        }
        className="mt-6 shadow-sm border-slate-100"
        loading={loading}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Space>
            <Input
              allowClear
              placeholder="Tìm theo code hoặc tên voucher..."
              value={searchAdmin}
              onChange={(e) => setSearchAdmin(e.target.value)}
              style={{ width: 320 }}
            />
          </Space>
        </div>

        <Table
          size="middle"
          loading={loading}
          rowKey="voucher_id"
          dataSource={filteredAdminItems}
          columns={adminColumns}
          pagination={false}
          scroll={{ x: "max-content", y: 480 }}
        />
      </Card>

      <Modal
        title={null}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={980}
      >
        <div className="bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-900 text-lg font-semibold">
              <GiftOutlined />
              <span>{editing ? "Cập nhật Voucher" : "Tạo Voucher Mới"}</span>
            </div>
            <div className="text-slate-500 text-sm">
              Thiết kế và quản lý voucher khuyến mãi cho chiến dịch của bạn
            </div>
          </div>

          <div className="h-px bg-slate-100 my-5" />

          <Form
            form={form}
            layout="vertical"
            onValuesChange={(changed) => {
              if (changed.apply_to_service_type) {
                const scope = changed.apply_to_service_type as ServiceScope;
                const typeSet = locationTypesForScope(scope);
                const list = typeSet
                  ? locations.filter((l) =>
                      typeSet.has((l.location_type || "other") as LocationType),
                    )
                  : locations;
                setFilteredLocations(list);
                const current = form.getFieldValue("location_id") as
                  | number
                  | null;
                if (
                  current != null &&
                  !list.some((l) => l.location_id === current)
                ) {
                  form.setFieldsValue({ location_id: null });
                }
              }
            }}
          >
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <InfoCircleOutlined className="text-sky-500" />
                    <div className="font-semibold">Thông tin cơ bản</div>
                  </div>

                  <Form.Item
                    name="code"
                    label="Mã Code"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="VD: TET2026" />
                  </Form.Item>

                  <Form.Item
                    name="campaign_name"
                    label="Tên chiến dịch"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="VD: Tết 2026 - Giảm giá toàn sản phẩm" />
                  </Form.Item>

                  <Form.Item
                    name="campaign_description"
                    label={
                      <span>
                        Mô tả chiến dịch{" "}
                        <span className="text-slate-400 font-normal">
                          (tùy chọn)
                        </span>
                      </span>
                    }
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Ghi chú nội dung chiến dịch"
                    />
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <CalendarOutlined className="text-sky-500" />
                    <div className="font-semibold">Thời gian áp dụng</div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="start_date"
                        label="Ngày bắt đầu"
                        rules={[{ required: true }]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="end_date"
                        label="Ngày kết thúc"
                        rules={[{ required: true }]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="status"
                    label="Trạng thái"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "inactive", label: "Tạm tắt" },
                        { value: "active", label: "Đang hoạt động" },
                        { value: "expired", label: "Hết hạn" },
                      ]}
                    />
                  </Form.Item>
                </div>
              </Col>

              <Col xs={24} md={12}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <PercentageOutlined className="text-sky-500" />
                    <div className="font-semibold">Cài đặt chiết khấu</div>
                  </div>

                  <Form.Item
                    name="discount_type"
                    label="Loại giảm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "percent", label: "Phần trăm (%)" },
                        { value: "amount", label: "Số tiền" },
                      ]}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="discount_value"
                        label="Giá trị giảm"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_discount_amount"
                        label="Giảm tối đa (nếu %)"
                      >
                        <InputNumber style={{ width: "100%" }} min={0} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="min_order_value"
                    label="Giá trị đơn tối thiểu"
                    rules={[{ required: true }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={0} />
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <GlobalOutlined className="text-sky-500" />
                    <div className="font-semibold">Phạm vi áp dụng</div>
                  </div>

                  <Form.Item
                    name="apply_to_service_type"
                    label="Phạm vi áp dụng"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={(
                        [
                          "all",
                          "room",
                          "food",
                          "ticket",
                          "other",
                        ] as ServiceScope[]
                      ).map((v) => ({ value: v, label: scopeLabel[v] }))}
                    />
                  </Form.Item>

                  <Form.Item
                    name="location_scope"
                    label="Phạm vi áp dụng địa điểm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "all", label: "Tất cả địa điểm của tôi" },
                        { value: "single", label: "Chọn 1 địa điểm" },
                        { value: "multiple", label: "Chọn nhiều địa điểm" },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => prev.location_scope !== cur.location_scope}
                  >
                    {({ getFieldValue }) => {
                      const scope = getFieldValue("location_scope") || "all";
                      return (
                        <>
                          {scope === "single" ? (
                            <Form.Item
                              name="location_id"
                              label="Địa điểm"
                              rules={[
                                { required: true, message: "Vui lòng chọn địa điểm" },
                              ]}
                            >
                              <Select
                                allowClear
                                placeholder="Chọn địa điểm"
                                options={filteredLocations.map((l) => ({
                                  value: l.location_id,
                                  label: `${l.location_name} (#${l.location_id})`,
                                }))}
                              />
                            </Form.Item>
                          ) : null}

                          {scope === "multiple" ? (
                            <Form.Item
                              name="location_ids"
                              label="Danh sách địa điểm"
                              rules={[
                                {
                                  validator: async (_, value) => {
                                    const arr = Array.isArray(value) ? value : [];
                                    if (arr.length === 0) {
                                      throw new Error(
                                        "Vui lòng chọn ít nhất 1 địa điểm",
                                      );
                                    }
                                  },
                                },
                              ]}
                            >
                              <Select
                                mode="multiple"
                                allowClear
                                placeholder="Chọn 1 hoặc nhiều địa điểm"
                                options={filteredLocations.map((l) => ({
                                  value: l.location_id,
                                  label: `${l.location_name} (#${l.location_id})`,
                                }))}
                              />
                            </Form.Item>
                          ) : null}
                        </>
                      );
                    }}
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <TeamOutlined className="text-sky-500" />
                    <div className="font-semibold">Giới hạn & Đối tượng sử dụng</div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="usage_limit"
                        label="Giới hạn lượt dùng"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={1} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_uses_per_user"
                        label="Tối đa mỗi user"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={1} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="target_group" label="Nhóm đối tượng" initialValue="all">
                    <Select
                      options={[
                        { value: "all", label: "Tất cả người dùng" },
                        { value: "loyal", label: "Khách hàng thân thiết" },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => prev.target_group !== cur.target_group}
                  >
                    {({ getFieldValue }) =>
                      getFieldValue("target_group") === "loyal" ? (
                        <Form.Item name="loyalty_min_spend" label="Chi tiêu tối thiểu (VNĐ)">
                          <InputNumber
                            min={0}
                            step={100000}
                            style={{ width: "100%" }}
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            parser={(v) => Number((v || "").replace(/,/g, "")) as any}
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                </div>
              </Col>
            </Row>

            <div className="mt-2">
              <div className="rounded-xl p-5 text-white bg-gradient-to-r from-indigo-600 to-purple-700 shadow-[0_5px_15px_rgba(52,152,219,0.3)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-bold tracking-wide bg-white/20 px-3 py-2 rounded-md">
                    {(watchCode as string) || "MÃ VOUCHER"}
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={previewStatusStyle}
                  >
                    {previewStatusText}
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold">
                  {(watchCampaignName as string) || "Tên chiến dịch"}
                </div>
                <div className="opacity-90 mt-1">
                  {(watchCampaignDesc as string) || "Mô tả chiến dịch"}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Giảm giá</div>
                    <div className="text-base font-semibold">
                      {watchDiscountType === "amount"
                        ? `${Number(watchDiscountValue || 0).toLocaleString("vi-VN")}₫`
                        : `${Number(watchDiscountValue || 0)}%`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Giới hạn</div>
                    <div className="text-base font-semibold">
                      {Number(watchUsageLimit || 0)} lượt
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Thời gian</div>
                    <div className="text-base font-semibold">
                      {watchStart
                        ? dayjs(watchStart).format("DD/MM/YYYY")
                        : "--"}{" "}
                      - {watchEnd ? dayjs(watchEnd).format("DD/MM/YYYY") : "--"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Áp dụng</div>
                    <div className="text-base font-semibold">
                      {previewApplyText}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <Button
                  onClick={() => setOpen(false)}
                  style={{
                    backgroundColor: "#ecf0f1",
                    borderColor: "#ecf0f1",
                    color: "#7f8c8d",
                  }}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  onClick={onSave}
                  loading={saving}
                  icon={<SaveOutlined />}
                  style={{ backgroundColor: "#2ecc71", borderColor: "#2ecc71" }}
                >
                  Lưu Voucher
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <InfoCircleOutlined className="text-indigo-600" />
            <span>Lịch sử sử dụng Voucher</span>
          </div>
        }
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={800}
        centered
      >
        <Table
          size="middle"
          loading={historyLoading}
          dataSource={historyData}
          columns={historyColumns}
          rowKey="usage_id"
          pagination={{ pageSize: 5 }}
          scroll={{ x: "max-content" }}
          className="mt-4"
        />
      </Modal>
    </MainLayout>
  );
};

export default OwnerVouchers;
