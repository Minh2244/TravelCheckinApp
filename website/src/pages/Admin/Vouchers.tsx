import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
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
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import locationApi from "../../api/locationApi";
import dayjs, { Dayjs } from "dayjs";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { formatDateVi } from "../../utils/formatDateVi";

type VoucherStatus = "active" | "inactive" | "expired";
type DiscountType = "percent" | "amount";
type ServiceScope = "all" | "room" | "food" | "ticket" | "other";
type LocationScopeMode = "all" | "single" | "multiple" | "owner_single" | "owner_multiple";

type LocationType =
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

type LocationRow = {
  location_id: number;
  location_name: string;
  location_type: LocationType;
};

interface SystemVoucher {
  voucher_id: number;
  location_id: number | null;
  location_name?: string | null;
  location_count?: number | null;
  code: string;
  campaign_name?: string | null;
  campaign_description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  apply_to_service_type: ServiceScope;
  apply_to_location_type?: string;
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
}

interface OwnerVoucherRow {
  voucher_id: number;
  owner_id: number;
  location_id: number | null;
  location_count?: number | null;
  code: string;
  campaign_name?: string | null;
  campaign_description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  apply_to_service_type: ServiceScope;
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
  approval_status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
}

type TabKey = "system" | "owner";

const ALL_FILTER = "__all__" as const;

const statusColor: Record<VoucherStatus, string> = {
  active: "green",
  inactive: "orange",
  expired: "red",
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

const toDayjs = (value?: string | null): Dayjs | null => {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? d : null;
};

const renderCodeBadge = (code: string) => (
  <span className="font-mono bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
    {code}
  </span>
);

const renderDiscountBadge = (type: DiscountType, value: number) => {
  const val = Number(value || 0);
  if (type === "percent") {
    return (
      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
        {val % 1 === 0 ? val : val.toFixed(0)}%
      </span>
    );
  }

  return (
    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
      {val.toLocaleString("vi-VN")}đ
    </span>
  );
};

const renderUsedProgress = (usedValue: number, limitValue: number) => {
  const used = Number(usedValue || 0);
  const limit = Number(limitValue || 0);
  const percent = limit > 0 ? (used / limit) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <span className="font-semibold text-slate-700 text-xs">
        {used}/{limit}
      </span>
      <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
        <div
          className="bg-sky-500 h-full rounded-full"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
};

const renderStatusPill = (status: VoucherStatus) => {
  const statusLabel =
    status === "active"
      ? "Đang hoạt động"
      : status === "inactive"
        ? "Tạm tắt"
        : "Hết hạn";

  return (
    <Tag
      color={statusColor[status]}
      className="rounded-full px-2.5 font-semibold text-xs border-0"
    >
      {statusLabel}
    </Tag>
  );
};

const renderLocationSummary = (
  locationName?: string | null,
  locationCount?: number | null,
) =>
  locationName ||
  (Number(locationCount || 0) > 0
    ? `${Number(locationCount || 0)} địa điểm`
    : "Tất cả");

const AdminVouchers = () => {
  const location = useLocation();

  const initialTab: TabKey = useMemo(() => {
    if (location.pathname.includes("/admin/owner-vouchers")) return "owner";
    return "system";
  }, [location.pathname]);

  const [tab, setTab] = useState<TabKey>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  // System vouchers list
  const [sysLoading, setSysLoading] = useState(false);
  const [sysData, setSysData] = useState<SystemVoucher[]>([]);
  const [sysPagination, setSysPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [sysStatusFilter, setSysStatusFilter] = useState<
    VoucherStatus | undefined
  >(undefined);
  const [sysSearch, setSysSearch] = useState("");

  // Owner vouchers (approval) list
  const [ownLoading, setOwnLoading] = useState(false);
  const [ownData, setOwnData] = useState<OwnerVoucherRow[]>([]);
  const [ownPagination, setOwnPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [ownStatusFilter, setOwnStatusFilter] = useState<
    VoucherStatus | undefined
  >(undefined);
  const [ownSearch, setOwnSearch] = useState("");
  const [sysStats, setSysStats] = useState<any>(null);
  const [ownStats, setOwnStats] = useState<any>(null);

  // Modal form (system voucher create/edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemVoucher | null>(null);
  const [editingOwner, setEditingOwner] = useState<OwnerVoucherRow | null>(
    null,
  );
  const [form] = Form.useForm();

  const watchCode = Form.useWatch("code", form);
  const watchCampaignName = Form.useWatch("campaign_name", form);
  const watchCampaignDesc = Form.useWatch("campaign_description", form);
  const watchDiscountType = Form.useWatch("discount_type", form);
  const watchDiscountValue = Form.useWatch("discount_value", form);
  const watchLocationScope = Form.useWatch("location_scope", form) as
    | LocationScopeMode
    | undefined;
  const watchLocationId = Form.useWatch("location_id", form);
  const watchLocationIds = Form.useWatch("location_ids", form) as
    | number[]
    | undefined;
  const watchUsageLimit = Form.useWatch("usage_limit", form);
  const watchStatus = Form.useWatch("status", form);
  const watchStart = Form.useWatch("start_date", form);
  const watchEnd = Form.useWatch("end_date", form);
  const [locOptions, setLocOptions] = useState<LocationRow[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<Array<{ value: number; label: string }>>([]);
  const [ownerLocOptions, setOwnerLocOptions] = useState<LocationRow[]>([]);
  const [ownerLocLoading, setOwnerLocLoading] = useState(false);

  const previewApplyText = useMemo(() => {
    const scope = (watchLocationScope || "all") as LocationScopeMode;

    if (scope === "all") return "Toàn quốc";

    if (scope === "single") {
      if (watchLocationId == null) return "(Chưa chọn)";
      const id = Number(watchLocationId);
      const found = locOptions.find((l) => l.location_id === id);
      return found?.location_name || `#${id}`;
    }

    if (scope === "owner_single") {
      return "Theo owner";
    }

    if (scope === "owner_multiple") {
      return "Nhiều owner";
    }

    const ids = Array.isArray(watchLocationIds) ? watchLocationIds : [];
    if (ids.length === 0) return "(Chưa chọn)";
    if (ids.length === 1) {
      const id = Number(ids[0]);
      const found = locOptions.find((l) => l.location_id === id);
      return found?.location_name || `#${id}`;
    }
    return `${ids.length} địa điểm`;
  }, [watchLocationId, watchLocationIds, watchLocationScope, locOptions]);

  const previewStatusText = useMemo(() => {
    const v = String((watchStatus as string) || "inactive").toLowerCase();
    if (v === "active") return "ĐANG HOẠT ĐỘNG";
    if (v === "expired") return "HẾT HẠN";
    return "TẠM TẮT";
  }, [watchStatus]);

  const previewStatusStyle = useMemo(() => {
    const s = (watchStatus as VoucherStatus) || "inactive";
    if (s === "active") return { backgroundColor: "#2ecc71" };
    if (s === "expired") return { backgroundColor: "#e74c3c" };
    return { backgroundColor: "#f39c12" };
  }, [watchStatus]);

  const fetchLocationsForScope = async (scope: ServiceScope) => {
    setLocLoading(true);
    try {
      const res = await locationApi.getLocations({ source: "web" });
      const list = (res?.data || []) as Array<{
        location_id: number;
        location_name: string;
        location_type: LocationType;
      }>;
      const typeSet = locationTypesForScope(scope);
      const filtered = typeSet
        ? list.filter((l) => typeSet.has(l.location_type))
        : list;
      setLocOptions(filtered);
    } catch {
      setLocOptions([]);
    } finally {
      setLocLoading(false);
    }
  };

  const fetchOwnerLocationsForVoucher = async (
    ownerId: number,
    scope: ServiceScope,
  ) => {
    setLocLoading(true);
    try {
      const res = await adminApi.getOwnerLocations(ownerId);
      const list = (res?.data || []) as Array<{
        location_id: number;
        location_name: string;
        location_type: LocationType;
      }>;
      const typeSet = locationTypesForScope(scope);
      const filtered = typeSet
        ? list.filter((l) => typeSet.has(l.location_type))
        : list;
      setLocOptions(filtered);
    } catch {
      setLocOptions([]);
    } finally {
      setLocLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "VC-";
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    form.setFieldsValue({ code: result });
  };

  const fetchOwners = async () => {
    try {
      const res = await adminApi.getOwners({ limit: 500 });
      if (res?.data) {
        setOwnerOptions(res.data.map((o: any) => ({ value: o.user_id, label: `${o.full_name || o.email} (#${o.user_id})` })));
      }
    } catch { /* ignore */ }
  };

  const fetchOwnerLocations = async (ownerId: number) => {
    setOwnerLocLoading(true);
    try {
      const res = await adminApi.getOwnerLocations(ownerId);
      if (res?.data) setOwnerLocOptions(res.data);
    } catch { setOwnerLocOptions([]); }
    finally { setOwnerLocLoading(false); }
  };

  const fetchSystemVouchers = async () => {
    setSysLoading(true);
    try {
      const params: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        page: sysPagination.current,
        limit: sysPagination.pageSize,
      };
      if (sysStatusFilter) params.status = sysStatusFilter;
      if (sysSearch) params.search = sysSearch;

      const res = await adminApi.getSystemVouchers(params);
      if (res?.success) {
        setSysData(res.data || []);
        setSysPagination((p) => ({ ...p, total: res.pagination?.total || 0 }));
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi lấy danh sách voucher hệ thống"));
    } finally {
      setSysLoading(false);
    }
  };

  const fetchOwnerVouchers = async () => {
    setOwnLoading(true);
    try {
      const params: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        page: ownPagination.current,
        limit: ownPagination.pageSize,
      };
      if (ownStatusFilter) params.status = ownStatusFilter;
      if (ownSearch) params.search = ownSearch;

      const res = await adminApi.getOwnerVouchers(params);
      if (res?.success) {
        setOwnData(res.data || []);
        setOwnPagination((p) => ({ ...p, total: res.pagination?.total || 0 }));
      }
    } catch (err: unknown) {
      message.error(
        getErrorMessage(err, "Lỗi lấy danh sách voucher của owner"),
      );
    } finally {
      setOwnLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "system") void fetchSystemVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sysPagination.current,
    sysPagination.pageSize,
    sysStatusFilter,
    sysSearch,
    tab,
  ]);

  useEffect(() => {
    if (tab === "owner") void fetchOwnerVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ownPagination.current,
    ownPagination.pageSize,
    ownStatusFilter,
    ownSearch,
    tab,
  ]);

  useEffect(() => {
    adminApi.getVoucherStats().then((res) => {
      if (res.success) {
        setSysStats(res.data?.system || null);
        setOwnStats(res.data?.owner || null);
      }
    }).catch(() => { });
  }, []);

  const openCreate = async () => {
    setEditing(null);
    setEditingOwner(null);
    form.resetFields();
    form.setFieldsValue({
      code: "",
      campaign_name: "",
      campaign_description: "",
      discount_type: "percent",
      discount_value: undefined,
      apply_to_service_type: "all",
      location_scope: "all",
      location_id: null,
      location_ids: [],
      owner_id: null,
      owner_ids: [],
      status: "active",
      min_order_value: 0,
      max_discount_amount: undefined,
      usage_limit: 100,
      max_uses_per_user: 1,
      target_group: "all",
      loyalty_min_spend: undefined,
      start_date: null,
      end_date: null,
    });
    await fetchLocationsForScope("all");
    void fetchOwners();
    setModalOpen(true);
  };

  const openEdit = async (row: SystemVoucher) => {
    setEditing(row);
    setEditingOwner(null);
    form.resetFields();
    form.setFieldsValue({
      ...row,
      location_scope: "all",
      location_id: row.location_id ?? null,
      location_ids: [],
      owner_id: null,
      owner_ids: [],
      max_discount_amount: row.max_discount_amount ?? undefined,
      max_uses_per_user: row.max_uses_per_user ?? 1,
      target_group: (row as any).target_group ?? "all",
      loyalty_min_spend: (row as any).loyalty_min_spend ?? undefined,
      start_date: toDayjs(row.start_date),
      end_date: toDayjs(row.end_date),
    });
    await fetchLocationsForScope(row.apply_to_service_type || "all");
    void fetchOwners();

    try {
      const locRes = await adminApi.getVoucherLocations(row.voucher_id);
      const data = locRes?.data as
        | { location_scope?: LocationScopeMode; location_ids?: number[]; owner_id?: number; owner_ids?: number[] }
        | undefined;
      const scope = (data?.location_scope || "all") as LocationScopeMode;
      const ids = Array.isArray(data?.location_ids) ? data?.location_ids : [];
      if (scope === "single") {
        form.setFieldsValue({
          location_scope: "single",
          location_id: ids[0] ?? row.location_id ?? null,
          location_ids: [],
        });
      } else if (scope === "multiple") {
        form.setFieldsValue({
          location_scope: "multiple",
          location_id: null,
          location_ids: ids,
        });
      } else if (scope === "owner_single") {
        form.setFieldsValue({
          location_scope: "owner_single",
          owner_id: data?.owner_id ?? null,
          location_id: ids[0] ?? null,
        });
        if (data?.owner_id) void fetchOwnerLocations(data.owner_id);
      } else if (scope === "owner_multiple") {
        const oids = Array.isArray(data?.owner_ids) ? data?.owner_ids : [];
        form.setFieldsValue({
          location_scope: "owner_multiple",
          owner_ids: oids,
          location_ids: ids,
        });
        const all: LocationRow[] = [];
        for (const oid of oids) {
          try { const res = await adminApi.getOwnerLocations(oid); if (res?.data) all.push(...res.data); } catch { }
        }
        setOwnerLocOptions(all);
      } else {
        form.setFieldsValue({
          location_scope: "all",
          location_id: null,
          location_ids: [],
        });
      }
    } catch {
      // ignore
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setEditingOwner(null);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const scope = (values.location_scope || "all") as LocationScopeMode;
      const payload: Record<string, unknown> = {
        ...values,
        location_scope: scope,
        location_id: scope === "single" ? (values.location_id ?? null) : null,
        location_ids:
          (scope === "multiple" || scope === "owner_multiple") && Array.isArray(values.location_ids)
            ? values.location_ids
            : [],
        owner_id: scope === "owner_single" ? (values.owner_id ?? null) : null,
        owner_ids:
          scope === "owner_multiple" && Array.isArray(values.owner_ids)
            ? values.owner_ids
            : [],
        start_date: values.start_date
          ? dayjs(values.start_date).startOf('day').format("YYYY-MM-DD HH:mm:ss")
          : null,
        end_date: values.end_date
          ? dayjs(values.end_date).endOf('day').format("YYYY-MM-DD HH:mm:ss")
          : null,
      };

      // Auto-map apply_to_location_type from apply_to_service_type since they are 1-to-1 conceptually
      const serviceToLocationMap: Record<string, string> = {
        all: "all",
        room: "hotel",
        food: "restaurant",
        ticket: "tourist",
        other: "other",
      };
      if (!payload.apply_to_location_type) {
        payload.apply_to_location_type = serviceToLocationMap[values.apply_to_service_type] || "all";
      }

      if (editingOwner) {
        // Owner voucher: don't allow changing status directly via form
        delete payload.status;

        const res = await adminApi.updateOwnerVoucher(
          editingOwner.voucher_id,
          payload,
        );
        if (res?.success) {
          message.success(res?.message || "Cập nhật voucher thành công");
          setModalOpen(false);
          setEditingOwner(null);
          fetchOwnerVouchers();
        }
        return;
      }

      if (editing) {
        const res = await adminApi.updateSystemVoucher(
          editing.voucher_id,
          payload,
        );
        if (res?.success) {
          message.success("Cập nhật voucher thành công");
          setModalOpen(false);
          fetchSystemVouchers();
        }
      } else {
        const res = await adminApi.createSystemVoucher(payload);
        if (res?.success) {
          message.success("Tạo voucher hệ thống thành công");
          setModalOpen(false);
          fetchSystemVouchers();
        }
      }
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi lưu voucher"));
    }
  };

  const handleDeleteSystemVoucher = async (voucherId: number) => {
    try {
      const res = await adminApi.deleteSystemVoucher(voucherId);
      message.success(res?.message || "Đã xóa voucher");
      fetchSystemVouchers();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xóa voucher"));
    }
  };

  const sysColumns: ColumnsType<SystemVoucher> = [
    {
      title: "STT",
      key: "index",
      width: 52,
      align: "center",
      render: (_: unknown, __: SystemVoucher, index: number) => {
        const offset = (sysPagination.current - 1) * sysPagination.pageSize;
        return Number(sysPagination.total || 0) > 0
          ? Math.max(sysPagination.total - offset - index, 1)
          : sysData.length - index;
      },
    },
    {
      title: "Voucher",
      key: "voucher",
      width: 230,
      render: (_, r) => (
        <div className="min-w-0">
          {renderCodeBadge(r.code)}
          <div className="mt-1 font-semibold text-slate-800 truncate">
            {r.campaign_name || "Voucher hệ thống"}
          </div>
          {r.campaign_description ? (
            <div className="text-xs text-slate-500 truncate">
              {r.campaign_description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Áp dụng",
      key: "apply",
      width: 190,
      render: (_, r) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-700">
            {scopeLabel[r.apply_to_service_type || "all"]}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {renderLocationSummary(r.location_name, r.location_count)}
          </div>
        </div>
      ),
    },
    {
      title: "Giảm",
      key: "discount",
      width: 84,
      align: "center",
      render: (_, r) => renderDiscountBadge(r.discount_type, r.discount_value),
    },
    {
      title: "Đã dùng",
      key: "used",
      width: 84,
      align: "center",
      render: (_, r) => renderUsedProgress(r.used_count, r.usage_limit),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 104,
      align: "center",
      render: (_: VoucherStatus, r) =>
        renderStatusPill((r.computed_status || r.status) as VoucherStatus),
    },
    {
      title: "Hiệu lực",
      key: "time",
      width: 104,
      align: "center",
      render: (_, r) => (
        <div className="text-xs text-gray-600 leading-5 whitespace-nowrap">
          <div>{formatDateVi(r.start_date)}</div>
          <div>{formatDateVi(r.end_date)}</div>
        </div>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 82,
      align: "center",
      render: (_, r) => (
        <Space size={4} className="whitespace-nowrap">
          <Button
            size="small"
            shape="circle"
            icon={<EditOutlined />}
            title="Sửa"
            style={{
              color: "#2563eb",
              borderColor: "#bfdbfe",
              backgroundColor: "#eff6ff",
              fontWeight: 600,
            }}
            onClick={() => openEdit(r)}
          />
          <Popconfirm
            title="Xóa voucher này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteSystemVoucher(r.voucher_id)}
          >
            <Button
              size="small"
              shape="circle"
              icon={<DeleteOutlined />}
              title="Xóa"
              style={{
                color: "#dc2626",
                borderColor: "#fecaca",
                backgroundColor: "#fef2f2",
                fontWeight: 600,
              }}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ownColumns: ColumnsType<OwnerVoucherRow> = [
    {
      title: "STT",
      key: "index",
      width: 52,
      align: "center",
      render: (_: unknown, __: OwnerVoucherRow, index: number) => {
        const offset = (ownPagination.current - 1) * ownPagination.pageSize;
        return Number(ownPagination.total || 0) > 0
          ? Math.max(ownPagination.total - offset - index, 1)
          : ownData.length - index;
      },
    },
    {
      title: "Voucher",
      key: "voucher",
      width: 220,
      render: (_, r) => (
        <div className="min-w-0">
          {renderCodeBadge(r.code)}
          <div className="mt-1 font-semibold text-slate-800 truncate">
            {r.campaign_name || "Voucher Owner"}
          </div>
          {r.campaign_description ? (
            <div className="text-xs text-slate-500 truncate">
              {r.campaign_description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      width: 170,
      render: (_, r) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 truncate">
            {r.owner_name || `#${r.owner_id}`}
          </div>
          <div className="text-xs text-slate-500 truncate">{r.owner_email || ""}</div>
        </div>
      ),
    },
    {
      title: "Áp dụng",
      key: "apply",
      width: 170,
      render: (_, r) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-700">
            {scopeLabel[r.apply_to_service_type || "all"]}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {renderLocationSummary(r.location_name, r.location_count)}
          </div>
        </div>
      ),
    },
    {
      title: "Giảm",
      key: "discount",
      width: 84,
      align: "center",
      render: (_, r) => renderDiscountBadge(r.discount_type, r.discount_value),
    },
    {
      title: "Đã dùng",
      key: "used",
      width: 84,
      align: "center",
      render: (_, r) => renderUsedProgress(r.used_count, r.usage_limit),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 104,
      align: "center",
      render: (_: VoucherStatus, r) =>
        renderStatusPill((r.computed_status || r.status) as VoucherStatus),
    },
    {
      title: "Hiệu lực",
      key: "time",
      width: 104,
      align: "center",
      render: (_, r) => (
        <div className="text-xs text-gray-600 leading-5 whitespace-nowrap">
          <div>{formatDateVi(r.start_date)}</div>
          <div>{formatDateVi(r.end_date)}</div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <Card
        title="Voucher"
        extra={
          <Space>
            <Segmented
              className="!rounded-lg !bg-rose-50 !p-1 [&_.ant-segmented-item]:!rounded-md [&_.ant-segmented-item]:!px-2 [&_.ant-segmented-item-label]:!font-semibold [&_.ant-segmented-item-label]:!text-slate-600 [&_.ant-segmented-item-selected]:!bg-white [&_.ant-segmented-item-selected]:!shadow-sm [&_.ant-segmented-item-selected_.ant-segmented-item-label]:!text-rose-600 [&_.ant-segmented-thumb]:!rounded-md"
              value={tab}
              onChange={(v) => setTab(v as TabKey)}
              options={[
                { label: "Voucher hệ thống", value: "system" },
                { label: "Voucher Owner", value: "owner" },
              ]}
            />
            {tab === "system" ? (
              <Button type="primary" onClick={openCreate}>
                Tạo voucher
              </Button>
            ) : null}
          </Space>
        }
      >
        {tab === "system" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-rose-100 font-semibold uppercase tracking-wider">Tổng voucher hệ thống</div>
              <div className="mt-2 text-3xl font-extrabold">{Number(sysStats?.total || sysPagination.total || 0)}</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-cyan-100 font-semibold uppercase tracking-wider">Đang hoạt động</div>
              <div className="mt-2 text-3xl font-extrabold">
                {Number(sysStats?.active_count || sysData.filter((v) => (v.computed_status || v.status) === "active").length || 0)}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Tổng lượt dùng</div>
              <div className="mt-2 text-3xl font-extrabold">
                {Number(sysStats?.total_uses || sysData.reduce((acc, v) => acc + (v.used_count || 0), 0) || 0)} lượt
              </div>
            </div>
          </div>
        )}

        {tab === "owner" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-rose-100 font-semibold uppercase tracking-wider">Tổng voucher owner</div>
              <div className="mt-2 text-3xl font-extrabold">{Number(ownStats?.total || ownPagination.total || 0)}</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-cyan-100 font-semibold uppercase tracking-wider">Đang hoạt động</div>
              <div className="mt-2 text-3xl font-extrabold">
                {Number(ownStats?.active_count || ownData.filter((v) => (v.computed_status || v.status) === "active").length || 0)}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 shadow-md border-0 text-white transition-all duration-300 hover:scale-[1.02]">
              <div className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Tổng lượt dùng</div>
              <div className="mt-2 text-3xl font-extrabold">
                {Number(ownStats?.total_uses || ownData.reduce((acc, v) => acc + (v.used_count || 0), 0) || 0)} lượt
              </div>
            </div>
          </div>
        )}

        {tab === "system" ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <Space>
                <Input
                  allowClear
                  placeholder="Tìm theo code hoặc tên chiến dịch..."
                  value={sysSearch}
                  onChange={(e) => {
                    setSysPagination((p) => ({ ...p, current: 1 }));
                    setSysSearch(e.target.value);
                  }}
                  style={{ width: 320 }}
                />
                <Select
                  value={sysStatusFilter ?? ALL_FILTER}
                  onChange={(v) => {
                    setSysPagination((p) => ({ ...p, current: 1 }));
                    setSysStatusFilter(
                      v === ALL_FILTER ? undefined : (v as VoucherStatus),
                    );
                  }}
                  style={{ width: 180 }}
                  options={[
                    { value: ALL_FILTER, label: "Tất cả" },
                    { value: "active", label: "Đang hoạt động" },
                    { value: "inactive", label: "Ngừng hoạt động" },
                    { value: "expired", label: "Hết hạn" },
                  ]}
                />
                <Button onClick={fetchSystemVouchers}>Tải lại</Button>
              </Space>
            </div>

            <Table
              size="middle"
              tableLayout="fixed"
              className="[&_.ant-table-cell]:!px-1.5 [&_.ant-table-cell]:!py-3"
              loading={sysLoading}
              rowKey="voucher_id"
              dataSource={sysData}
              columns={sysColumns}
              pagination={false}
              scroll={{ y: 480 }}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <Space>
                <Input
                  allowClear
                  placeholder="Tìm theo code / campaign / owner"
                  value={ownSearch}
                  onChange={(e) => {
                    setOwnPagination((p) => ({ ...p, current: 1 }));
                    setOwnSearch(e.target.value);
                  }}
                  style={{ width: 320 }}
                />
                <Select
                  value={ownStatusFilter ?? ALL_FILTER}
                  onChange={(v) => {
                    setOwnPagination((p) => ({ ...p, current: 1 }));
                    setOwnStatusFilter(
                      v === ALL_FILTER ? undefined : (v as VoucherStatus),
                    );
                  }}
                  style={{ width: 200 }}
                  options={[
                    { value: ALL_FILTER, label: "Tất cả" },
                    { value: "inactive", label: "Tạm tắt" },
                    { value: "active", label: "Đang hoạt động" },
                    { value: "expired", label: "Hết hạn" },
                  ]}
                />
                <Button onClick={fetchOwnerVouchers}>Tải lại</Button>
              </Space>
            </div>

            <Table
              size="middle"
              tableLayout="fixed"
              className="[&_.ant-table-cell]:!px-1.5 [&_.ant-table-cell]:!py-3"
              loading={ownLoading}
              rowKey="voucher_id"
              dataSource={ownData}
              columns={ownColumns}
              pagination={false}
              scroll={{ y: 480 }}
            />
          </>
        )}
      </Card>

      <Modal
        title={null}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        centered
        width={980}
      >
        <div className="bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-900 text-lg font-semibold">
              <GiftOutlined />
              <span>
                {editingOwner
                  ? "Cập nhật Voucher Owner"
                  : editing
                    ? "Cập nhật Voucher"
                    : "Tạo Voucher Mới"}
              </span>
            </div>
            <div className="text-slate-500 text-sm">
              Thiết kế và quản lý voucher khuyến mãi cho chiến dịch của bạn
            </div>
          </div>

          <div className="h-px bg-slate-100 my-5" />

          <Form
            form={form}
            layout="vertical"
            onValuesChange={async (changed) => {
              if (changed.location_scope) {
                form.setFieldsValue({ location_id: null, location_ids: [] });
              }

              if (changed.apply_to_service_type) {
                const next = changed.apply_to_service_type as ServiceScope;
                if (editingOwner) {
                  await fetchOwnerLocationsForVoucher(
                    editingOwner.owner_id,
                    next,
                  );
                } else {
                  await fetchLocationsForScope(next);
                }
                form.setFieldsValue({ location_id: null, location_ids: [] });
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
                    label="Mã Code"
                    rules={[{ required: true, message: "Vui lòng nhập mã" }]}
                  >
                    <Space.Compact style={{ width: "100%" }}>
                      <Form.Item name="code" noStyle rules={[{ required: true }]}>
                        <Input placeholder="VD: VC-A3B7K9" disabled={Boolean(editingOwner)} />
                      </Form.Item>
                      {!editingOwner ? (
                        <Button onClick={generateRandomCode}>Tạo ngẫu nhiên</Button>
                      ) : null}
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="campaign_name"
                    label="Tên Voucher"
                    rules={[{ required: true, message: "Vui lòng nhập tên" }]}
                  >
                    <Input placeholder="VD: Tết 2026 - Giảm giá toàn sản phẩm" />
                  </Form.Item>

                  <Form.Item
                    name="campaign_description"
                    label={
                      <span>
                        Mô tả Voucher{" "}
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

                <div className="mb-2">
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

                  {editingOwner ? null : (
                    <Form.Item
                      name="status"
                      label="Trạng thái"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          {
                            value: "inactive",
                            label: "Tạm tắt",
                          },
                          {
                            value: "active",
                            label: "Đang hoạt động",
                          },
                          { value: "expired", label: "Hết hạn" },
                        ]}
                      />
                    </Form.Item>
                  )}
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
                        { value: "percent", label: "Phần trăm hóa đơn" },
                        { value: "amount", label: "Số tiền cố định" },
                      ]}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) => prev.discount_type !== cur.discount_type}
                      >
                        {({ getFieldValue }) => (
                          <Form.Item
                            name="discount_value"
                            label={getFieldValue("discount_type") === "percent" ? "Phần trăm giảm (%)" : "Số tiền giảm (đ)"}
                            rules={[{ required: true }]}
                          >
                            <InputNumber style={{ width: "100%" }} min={0} />
                          </Form.Item>
                        )}
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) => prev.discount_type !== cur.discount_type}
                      >
                        {({ getFieldValue }) =>
                          getFieldValue("discount_type") === "percent" ? (
                            <Form.Item
                              name="max_discount_amount"
                              label="Giảm tối đa (áp dụng cho %)"
                            >
                              <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                          ) : (
                            <div className="invisible" aria-hidden="true">&nbsp;</div>
                          )
                        }
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="min_order_value"
                    label="Đơn hàng tối thiểu để áp dụng"
                    rules={[
                      { required: true, message: "Vui lòng nhập giá trị" },
                      { transform: (v) => v === '' || v === null ? undefined : Number(v), type: 'number', min: 0, message: 'Phải >= 0' }
                    ]}
                  >
                    <InputNumber style={{ width: "100%" }} />
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
                    label="Phạm vi áp dụng (Dịch vụ)"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={(
                        [
                          "all",
                          "room",
                          "food",
                          "ticket"
                        ] as ServiceScope[]
                      ).map((v) => ({ value: v, label: scopeLabel[v] }))}
                    />
                  </Form.Item>





                  <Form.Item
                    name="location_scope"
                    label="Áp dụng cho địa điểm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "all", label: "Tất cả địa điểm (Mọi owner)" },
                        { value: "owner_multiple", label: "Chọn địa điểm theo Owner (1 hoặc nhiều)" },
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
                                { required: true, message: "Vui lòng chọn 1 địa điểm" },
                              ]}
                            >
                              <Select
                                loading={locLoading}
                                allowClear
                                placeholder="Chọn địa điểm"
                                options={locOptions.map((l) => ({
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
                                loading={locLoading}
                                allowClear
                                placeholder="Chọn 1 hoặc nhiều địa điểm"
                                options={locOptions.map((l) => ({
                                  value: l.location_id,
                                  label: `${l.location_name} (#${l.location_id})`,
                                }))}
                              />
                            </Form.Item>
                          ) : null}

                          {scope === "owner_single" ? (
                            <>
                              <Form.Item name="owner_id" label="Owner" rules={[{ required: true, message: "Vui lòng chọn owner" }]}>
                                <Select options={ownerOptions} placeholder="Chọn owner" onChange={(v: number) => { form.setFieldsValue({ location_id: null, location_ids: [] }); fetchOwnerLocations(v); }} />
                              </Form.Item>
                              <Form.Item name="location_id" label="Địa điểm">
                                <Select loading={ownerLocLoading} allowClear placeholder="Tất cả địa điểm của owner" options={ownerLocOptions.map(l => ({ value: l.location_id, label: `${l.location_name} (#${l.location_id})` }))} />
                              </Form.Item>
                            </>
                          ) : null}

                          {scope === "owner_multiple" ? (
                            <>
                              <Form.Item name="owner_ids" label="Chọn Owner" rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 owner" }]}>
                                <Select mode="multiple" options={ownerOptions} placeholder="Chọn owner" onChange={async (ids: number[]) => { form.setFieldsValue({ location_ids: [] }); const all: LocationRow[] = []; for (const id of ids) { try { const res = await adminApi.getOwnerLocations(id); if (res?.data) all.push(...res.data); } catch { } } setOwnerLocOptions(all); }} />
                              </Form.Item>
                              <Form.Item name="location_ids" label="Địa điểm (để trống là áp dụng tất cả địa điểm của owner)">
                                <Select mode="multiple" loading={ownerLocLoading} allowClear placeholder="Tất cả địa điểm" options={ownerLocOptions.map(l => ({ value: l.location_id, label: `${l.location_name} (#${l.location_id})` }))} />
                              </Form.Item>
                            </>
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
                    <div className="font-semibold">Giới hạn sử dụng</div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="usage_limit"
                        label="Số voucher"
                        rules={[
                          { required: true, message: "Vui lòng nhập giới hạn" },
                          { type: 'number', min: 1, message: 'Phải >= 1' }
                        ]}
                      >
                        <InputNumber style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_uses_per_user"
                        label="Lần dùng tối đa mỗi user"
                        rules={[
                          { required: true, message: "Vui lòng nhập tối đa" },
                          { type: 'number', min: 1, message: 'Phải >= 1' }
                        ]}
                      >
                        <InputNumber style={{ width: "100%" }} />
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
                        <Form.Item
                          name="loyalty_min_spend"
                          label="Chi tiêu tối thiểu (VNĐ)"
                          rules={[{ transform: (v) => v === '' || v === null ? undefined : Number(v), type: 'number', min: 0, message: 'Phải >= 0' }]}
                        >
                          <InputNumber
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
                  onClick={closeModal}
                  style={{
                    backgroundColor: "#ecf0f1",
                    borderColor: "#ecf0f1",
                    color: "#7f8c8d",
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={sysLoading}
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
    </MainLayout>
  );
};

export default AdminVouchers;
