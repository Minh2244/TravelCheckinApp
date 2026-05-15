import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
  Tooltip,
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
type LocationScopeMode = "all" | "single" | "multiple";

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

const discountLabel = (v: {
  discount_type: DiscountType;
  discount_value: number;
}) => {
  if (v.discount_type === "percent") return `${v.discount_value}%`;
  return `${Number(v.discount_value).toLocaleString("vi-VN")}₫`;
};

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
    pageSize: 20,
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
    pageSize: 20,
    total: 0,
  });
  const [ownStatusFilter, setOwnStatusFilter] = useState<
    VoucherStatus | undefined
  >("inactive");
  const [ownSearch, setOwnSearch] = useState("");

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

  const previewApplyText = useMemo(() => {
    const scope = (watchLocationScope || "all") as LocationScopeMode;

    if (scope === "all") return "Toàn quốc";

    if (scope === "single") {
      if (watchLocationId == null) return "(Chưa chọn)";
      const id = Number(watchLocationId);
      const found = locOptions.find((l) => l.location_id === id);
      return found?.location_name || `#${id}`;
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
    const v = String((watchStatus as string) || "inactive");
    return v.toUpperCase();
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
    void fetchSystemVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sysPagination.current,
    sysPagination.pageSize,
    sysStatusFilter,
    sysSearch,
  ]);

  useEffect(() => {
    void fetchOwnerVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ownPagination.current,
    ownPagination.pageSize,
    ownStatusFilter,
    ownSearch,
  ]);

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
      status: "active",
      min_order_value: 0,
      max_discount_amount: undefined,
      usage_limit: 100,
      max_uses_per_user: 1,
      start_date: null,
      end_date: null,
    });
    await fetchLocationsForScope("all");
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
      max_discount_amount: row.max_discount_amount ?? undefined,
      max_uses_per_user: row.max_uses_per_user ?? 1,
      start_date: toDayjs(row.start_date),
      end_date: toDayjs(row.end_date),
    });
    await fetchLocationsForScope(row.apply_to_service_type || "all");

    try {
      const locRes = await adminApi.getVoucherLocations(row.voucher_id);
      const data = locRes?.data as
        | { location_scope?: LocationScopeMode; location_ids?: number[] }
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

  const openOwnerEdit = async (row: OwnerVoucherRow) => {
    setEditing(null);
    setEditingOwner(row);
    form.resetFields();
    form.setFieldsValue({
      ...row,
      location_scope: "all",
      location_id: row.location_id ?? null,
      location_ids: [],
      max_discount_amount: row.max_discount_amount ?? undefined,
      max_uses_per_user: row.max_uses_per_user ?? 1,
      start_date: toDayjs(row.start_date),
      end_date: toDayjs(row.end_date),
      // owner voucher is not directly controlled via this form
      status: row.status,
    });

    await fetchOwnerLocationsForVoucher(
      row.owner_id,
      row.apply_to_service_type || "all",
    );

    try {
      const locRes = await adminApi.getVoucherLocations(row.voucher_id);
      const data = locRes?.data as
        | { location_scope?: LocationScopeMode; location_ids?: number[] }
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
          scope === "multiple" && Array.isArray(values.location_ids)
            ? values.location_ids
            : [],
        start_date: values.start_date
          ? dayjs(values.start_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
        end_date: values.end_date
          ? dayjs(values.end_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
      };

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

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectVoucher, setRejectVoucher] = useState<OwnerVoucherRow | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const reviewOwnerVoucher = async (
    voucherId: number,
    action: "approve" | "reject" | "hide" | "activate" | "deactivate",
    reason?: string,
  ) => {
    try {
      const res = await adminApi.reviewOwnerVoucher(voucherId, {
        action,
        ...(reason ? { reason } : {}),
      });
      if (res?.success) {
        message.success(res?.message || "Đã cập nhật voucher");
        fetchOwnerVouchers();
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể cập nhật voucher"));
    }
  };

  const openReject = (row: OwnerVoucherRow) => {
    setRejectVoucher(row);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    const row = rejectVoucher;
    if (!row) return;
    const reason = rejectReason.trim();
    if (!reason) {
      message.error("Vui lòng nhập lý do từ chối");
      return;
    }
    await reviewOwnerVoucher(row.voucher_id, "reject", reason);
    setRejectModalOpen(false);
    setRejectVoucher(null);
  };

  const handleDeleteOwnerVoucher = async (voucherId: number) => {
    try {
      const res = await adminApi.deleteOwnerVoucher(voucherId);
      message.success(res?.message || "Đã xóa voucher của owner");
      fetchOwnerVouchers();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xóa voucher"));
    }
  };

  const sysColumns: ColumnsType<SystemVoucher> = [
    { title: "ID", dataIndex: "voucher_id", key: "voucher_id", width: 80 },
    {
      title: "Tên chiến dịch",
      dataIndex: "campaign_name",
      key: "campaign_name",
    },
    { title: "Code", dataIndex: "code", key: "code", width: 140 },
    {
      title: "Phạm vi",
      key: "scope",
      width: 160,
      render: (_, r) => scopeLabel[r.apply_to_service_type || "all"],
    },
    {
      title: "Địa điểm",
      key: "location",
      render: (_, r) =>
        r.location_name ||
        (r.location_id
          ? `#${r.location_id}`
          : Number(r.location_count || 0) > 0
            ? `${Number(r.location_count || 0)} địa điểm`
            : "Tất cả"),
    },
    {
      title: "Mức giảm",
      key: "discount",
      width: 140,
      render: (_, r) => discountLabel(r),
    },
    {
      title: "Đã dùng",
      key: "used",
      width: 120,
      render: (_, r) =>
        `${Number(r.used_count || 0)}/${Number(r.usage_limit || 0)}`,
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
      title: "Hiệu lực",
      key: "time",
      width: 220,
      render: (_, r) => (
        <div className="text-xs text-gray-600">
          <div>{formatDateVi(r.start_date)}</div>
          <div>{formatDateVi(r.end_date)}</div>
        </div>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 220,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa voucher này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteSystemVoucher(r.voucher_id)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ownColumns: ColumnsType<OwnerVoucherRow> = [
    { title: "ID", dataIndex: "voucher_id", key: "voucher_id", width: 80 },
    { title: "Code", dataIndex: "code", key: "code", width: 140 },
    {
      title: "Owner",
      key: "owner",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.owner_name || `#${r.owner_id}`}</div>
          <div className="text-xs text-gray-500">{r.owner_email || ""}</div>
        </div>
      ),
    },
    {
      title: "Phạm vi",
      key: "scope",
      width: 160,
      render: (_, r) => scopeLabel[r.apply_to_service_type || "all"],
    },
    {
      title: "Địa điểm",
      key: "location",
      render: (_, r) =>
        r.location_name ||
        (r.location_id
          ? `#${r.location_id}`
          : Number(r.location_count || 0) > 0
            ? `${Number(r.location_count || 0)} địa điểm`
            : "Tất cả"),
    },
    {
      title: "Giảm",
      key: "discount",
      width: 120,
      render: (_, r) => discountLabel(r),
    },
    {
      title: "Đã dùng",
      key: "used",
      width: 120,
      render: (_, r) =>
        `${Number(r.used_count || 0)}/${Number(r.usage_limit || 0)}`,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 140,
      render: (_: VoucherStatus, r) => {
        const s = (r.computed_status || r.status) as VoucherStatus;
        const approval = (r.approval_status || "pending") as
          | "pending"
          | "approved"
          | "rejected";

        const approvalMeta: Record<
          typeof approval,
          { color: string; label: string }
        > = {
          pending: { color: "orange", label: "CHỜ DUYỆT" },
          approved: { color: "blue", label: "ĐÃ DUYỆT" },
          rejected: { color: "red", label: "TỪ CHỐI" },
        };
        const approvalTag = (
          <Tag color={approvalMeta[approval].color}>
            {approvalMeta[approval].label}
          </Tag>
        );
        const statusTag = (
          <Tag color={statusColor[s]}>{String(s).toUpperCase()}</Tag>
        );

        const reason = String(r.rejection_reason || "").trim();
        return (
          <div>
            <div>{approvalTag}</div>
            <div className="mt-1">
              {approval === "rejected" && reason ? (
                <Tooltip title={reason}>{statusTag}</Tooltip>
              ) : (
                statusTag
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Hiệu lực",
      key: "time",
      width: 220,
      render: (_, r) => (
        <div className="text-xs text-gray-600">
          <div>{formatDateVi(r.start_date)}</div>
          <div>{formatDateVi(r.end_date)}</div>
        </div>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 220,
      render: (_, r) => {
        const effective = (r.computed_status || r.status) as VoucherStatus;
        const approval = (r.approval_status || "pending") as
          | "pending"
          | "approved"
          | "rejected";

        const canApprove = effective !== "expired" && approval !== "approved";
        const canReject = effective !== "expired" && approval !== "approved";
        const canHide =
          effective !== "expired" &&
          approval === "approved" &&
          r.status === "active";
        const canActivate =
          effective !== "expired" &&
          approval === "approved" &&
          r.status === "inactive";

        const showEditDelete = approval === "approved";

        return (
          <Space>
            <Popconfirm
              title="Duyệt voucher này?"
              okText="Duyệt"
              cancelText="Hủy"
              disabled={!canApprove}
              onConfirm={() => reviewOwnerVoucher(r.voucher_id, "approve")}
            >
              <Button type="primary" size="small" disabled={!canApprove}>
                Duyệt
              </Button>
            </Popconfirm>

            <Button
              size="small"
              danger
              disabled={!canReject}
              onClick={() => openReject(r)}
            >
              Từ chối
            </Button>

            {canHide ? (
              <Popconfirm
                title="Ẩn voucher này?"
                okText="Ẩn"
                cancelText="Hủy"
                onConfirm={() => reviewOwnerVoucher(r.voucher_id, "hide")}
              >
                <Button size="small">Ẩn</Button>
              </Popconfirm>
            ) : null}

            {canActivate ? (
              <Popconfirm
                title="Bật voucher này?"
                okText="Bật"
                cancelText="Hủy"
                onConfirm={() => reviewOwnerVoucher(r.voucher_id, "activate")}
              >
                <Button size="small">Bật</Button>
              </Popconfirm>
            ) : null}

            {showEditDelete ? (
              <>
                <Button size="small" onClick={() => openOwnerEdit(r)}>
                  Sửa
                </Button>

                <Popconfirm
                  title="Xóa voucher này?"
                  description="Xóa sẽ ẩn khỏi danh sách (xóa mềm)."
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => handleDeleteOwnerVoucher(r.voucher_id)}
                >
                  <Button size="small" danger>
                    Xóa
                  </Button>
                </Popconfirm>
              </>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <Card
        title="Voucher"
        extra={
          <Space>
            <Segmented
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
              loading={sysLoading}
              rowKey="voucher_id"
              dataSource={sysData}
              columns={sysColumns}
              pagination={{
                current: sysPagination.current,
                pageSize: sysPagination.pageSize,
                total: sysPagination.total,
                showSizeChanger: true,
                onChange: (page, pageSize) =>
                  setSysPagination((p) => ({ ...p, current: page, pageSize })),
              }}
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
                    { value: "inactive", label: "Ngừng hoạt động (chờ duyệt)" },
                    { value: "active", label: "Đang hoạt động" },
                    { value: "expired", label: "Hết hạn" },
                  ]}
                />
                <Button onClick={fetchOwnerVouchers}>Tải lại</Button>
              </Space>
            </div>

            <Table
              loading={ownLoading}
              rowKey="voucher_id"
              dataSource={ownData}
              columns={ownColumns}
              pagination={{
                current: ownPagination.current,
                pageSize: ownPagination.pageSize,
                total: ownPagination.total,
                showSizeChanger: true,
                onChange: (page, pageSize) =>
                  setOwnPagination((p) => ({ ...p, current: page, pageSize })),
              }}
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
                    name="code"
                    label="Mã Code"
                    rules={[{ required: true, message: "Vui lòng nhập mã" }]}
                  >
                    <Input
                      placeholder="VD: TET2026"
                      disabled={Boolean(editingOwner)}
                    />
                  </Form.Item>

                  <Form.Item
                    name="campaign_name"
                    label="Tên chiến dịch"
                    rules={[{ required: true, message: "Vui lòng nhập tên" }]}
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
                            label: "Inactive (tạm tắt)",
                          },
                          {
                            value: "active",
                            label: "Active (đang hoạt động)",
                          },
                          { value: "expired", label: "Expired (hết hạn)" },
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
                        { value: "percent", label: "Percent (%)" },
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
                    label="Áp dụng cho địa điểm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "all", label: "Tất cả địa điểm" },
                        { value: "single", label: "Chọn 1 địa điểm" },
                        { value: "multiple", label: "Chọn nhiều địa điểm" },
                      ]}
                    />
                  </Form.Item>

                  {(watchLocationScope || "all") === "single" ? (
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

                  {(watchLocationScope || "all") === "multiple" ? (
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

      <Modal
        title="Từ chối voucher"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectVoucher(null);
        }}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <div className="text-sm text-gray-600 mb-2">
          Nhập lý do từ chối để owner chỉnh sửa lại.
        </div>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="VD: Voucher thiếu thông tin, ngày không hợp lệ, ..."
        />
      </Modal>
    </MainLayout>
  );
};

export default AdminVouchers;
